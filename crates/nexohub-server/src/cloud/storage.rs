//! Armazenamento limitado de entradas/saídas. O backend concreto (Cloud Storage) entra depois do
//! trait; contadores e limites ficam aqui, sempre antes de gravar ou enviar bytes. Sem URLs diretas.
use super::{CloudError, policy::CloudPolicy};
use std::{
    collections::HashMap,
    io::Read,
    sync::{Arc, Mutex},
    time::Instant,
};

pub trait ObjectBackend: Send + Sync {
    /// Grava o objeto e devolve uma nova geração (sempre diferente da anterior).
    fn put(&self, name: &str, bytes: Vec<u8>) -> Result<u64, CloudError>;
    fn get(&self, name: &str) -> Result<Vec<u8>, CloudError>;
    fn delete(&self, name: &str) -> Result<(), CloudError>;
}

type Objects = HashMap<String, (u64, Vec<u8>)>;

#[derive(Default)]
pub struct MemoryObjects {
    inner: Mutex<(u64, Objects)>,
}
impl ObjectBackend for MemoryObjects {
    fn put(&self, name: &str, bytes: Vec<u8>) -> Result<u64, CloudError> {
        let mut g = self.inner.lock().map_err(|_| CloudError::Unavailable)?;
        g.0 += 1;
        let generation = g.0;
        g.1.insert(name.into(), (generation, bytes));
        Ok(generation)
    }
    fn get(&self, name: &str) -> Result<Vec<u8>, CloudError> {
        let g = self.inner.lock().map_err(|_| CloudError::Unavailable)?;
        g.1.get(name)
            .map(|(_, b)| b.clone())
            .ok_or(CloudError::InvalidRequest)
    }
    fn delete(&self, name: &str) -> Result<(), CloudError> {
        let mut g = self.inner.lock().map_err(|_| CloudError::Unavailable)?;
        g.1.remove(name);
        Ok(())
    }
}

/// Lê no máximo `max` bytes e dentro do prazo. Excesso recusa; nunca trunca.
pub fn read_limited(
    mut reader: impl Read,
    max: u64,
    deadline: Instant,
) -> Result<Vec<u8>, CloudError> {
    let mut out = Vec::new();
    let mut chunk = [0u8; 16 * 1024];
    loop {
        if Instant::now() >= deadline {
            return Err(CloudError::Unavailable);
        }
        let n = reader
            .read(&mut chunk)
            .map_err(|_| CloudError::Unavailable)?;
        if n == 0 {
            return Ok(out);
        }
        if out.len() as u64 + n as u64 > max {
            return Err(CloudError::InvalidRequest);
        }
        out.extend_from_slice(&chunk[..n]);
    }
}

fn name_ok(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 128
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
}

#[derive(Default)]
struct State {
    stored: u64,
    sizes: HashMap<String, u64>,
    generations: HashMap<String, u64>,
    downloads: HashMap<String, (u64, u64)>,
}

pub struct Storage<B: ObjectBackend> {
    backend: Arc<B>,
    policy: CloudPolicy,
    state: Mutex<State>,
}

impl<B: ObjectBackend> Storage<B> {
    pub fn new(backend: Arc<B>, policy: CloudPolicy) -> Self {
        Self {
            backend,
            policy,
            state: Mutex::default(),
        }
    }
    fn state(&self) -> Result<std::sync::MutexGuard<'_, State>, CloudError> {
        self.state.lock().map_err(|_| CloudError::Unavailable)
    }
    pub fn stored_bytes(&self) -> u64 {
        self.state().map(|s| s.stored).unwrap_or(u64::MAX)
    }

    /// Upload binário: leitura limitada, reserva global de bytes e só então gravação.
    pub fn put_input(
        &self,
        name: &str,
        reader: impl Read,
        max_bytes: u64,
        deadline: Instant,
    ) -> Result<u64, CloudError> {
        if !name_ok(name) {
            return Err(CloudError::InvalidRequest);
        }
        let bytes = read_limited(reader, max_bytes, deadline)?;
        self.store(format!("in-{name}"), bytes)
    }

    pub fn put_output(&self, name: &str, bytes: Vec<u8>) -> Result<u64, CloudError> {
        if !name_ok(name) || bytes.len() as u64 > self.policy.transfer.max_output_bytes {
            return Err(CloudError::InvalidRequest);
        }
        self.store(format!("out-{name}"), bytes)
    }

    fn store(&self, key: String, bytes: Vec<u8>) -> Result<u64, CloudError> {
        let size = bytes.len() as u64;
        {
            let mut s = self.state()?;
            let previous = s.sizes.get(&key).copied().unwrap_or(0);
            let total = s.stored - previous + size;
            if total > self.policy.transfer.global_stored_bytes {
                return Err(CloudError::QuotaExceeded);
            }
            s.stored = total;
            s.sizes.insert(key.clone(), size);
        }
        match self.backend.put(&key, bytes) {
            Ok(generation) => {
                self.state()?.generations.insert(key, generation);
                Ok(generation)
            }
            Err(e) => {
                let mut s = self.state()?;
                if let Some(size) = s.sizes.remove(&key) {
                    s.stored -= size;
                }
                Err(e)
            }
        }
    }

    /// A geração do objeto deve ser a inspecionada/orçada; troca depois do orçamento recusa.
    pub fn check_generation(&self, name: &str, expected: u64) -> Result<(), CloudError> {
        match self.state()?.generations.get(&format!("in-{name}")) {
            Some(g) if *g == expected => Ok(()),
            _ => Err(CloudError::InputChanged),
        }
    }

    /// Libera objetos e bytes reservados de um envio abandonado ou expirado.
    pub fn abandon(&self, name: &str) -> Result<(), CloudError> {
        for key in [format!("in-{name}"), format!("out-{name}")] {
            self.backend.delete(&key)?;
            let mut s = self.state()?;
            if let Some(size) = s.sizes.remove(&key) {
                s.stored -= size;
            }
            s.generations.remove(&key);
        }
        self.state()?.downloads.remove(name);
        Ok(())
    }

    /// Download autenticado e contabilizado. `range` é inclusivo; reserva antes de ler o backend.
    pub fn download(&self, name: &str, range: Option<(u64, u64)>) -> Result<Vec<u8>, CloudError> {
        if !name_ok(name) {
            return Err(CloudError::InvalidRequest);
        }
        let key = format!("out-{name}");
        let (start, end) = {
            let mut s = self.state()?;
            let size = *s.sizes.get(&key).ok_or(CloudError::InvalidRequest)?;
            let (start, end) = range.unwrap_or((0, size.saturating_sub(1)));
            if size == 0 || start > end || end >= size {
                return Err(CloudError::InvalidRequest);
            }
            let length = end - start + 1;
            let (count, bytes) = s.downloads.get(name).copied().unwrap_or((0, 0));
            if count >= self.policy.transfer.max_downloads
                || bytes + length > self.policy.transfer.max_download_bytes_per_job
            {
                return Err(CloudError::QuotaExceeded);
            }
            s.downloads.insert(name.into(), (count + 1, bytes + length));
            (start as usize, end as usize)
        };
        // Transferência interrompida continua contada: a reserva não é devolvida.
        let data = self.backend.get(&key)?;
        data.get(start..=end)
            .map(<[u8]>::to_vec)
            .ok_or(CloudError::Unavailable)
    }
}
