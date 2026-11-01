//! Estado e regras das rotas de orçamento/envio. Não reserva saldo nem chama provedor pago:
//! a confirmação em `/jobs` pertence à máquina de estados da Tarefa 5.
use super::{
    CloudError,
    ledger::Units,
    policy::CloudPolicy,
    pricing::PriceBook,
    quotes::{Finalized, Inspected, Quote, QuoteRequest, QuoteService},
    storage::{MemoryObjects, Storage},
};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    io::Cursor,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

#[derive(Clone, Debug, PartialEq, Eq)]
enum Stage {
    Quoted,
    UploadAuthorized,
    Uploaded(u64),
    Inspected(Finalized),
    Confirmed(Finalized),
}

/// Dados para reservar a execução; o custo vem do orçamento definitivo, nunca do cliente.
#[derive(Debug)]
pub struct Confirmed {
    pub key: String,
    pub input_digest: String,
    pub units: Units,
    pub maximum_usd_micros: u64,
}
struct Record {
    owner: String,
    quote: Quote,
    stage: Stage,
}

pub struct QuoteApi {
    service: QuoteService,
    storage: Storage<MemoryObjects>,
    records: Mutex<HashMap<String, Record>>,
    max_upload: u64,
    upload_seconds: u64,
}

impl QuoteApi {
    pub fn new(policy: &CloudPolicy) -> Result<Self, CloudError> {
        Self::with_prices(policy, PriceBook::pilot()?)
    }
    pub fn with_prices(policy: &CloudPolicy, prices: PriceBook) -> Result<Self, CloudError> {
        Ok(Self {
            service: QuoteService::new(policy.clone(), prices),
            storage: Storage::new(Arc::new(MemoryObjects::default()), policy.clone()),
            records: Mutex::default(),
            max_upload: policy.ocr.max_bytes.max(policy.office.max_input_bytes),
            upload_seconds: policy.transfer.upload_timeout_seconds,
        })
    }
    pub fn max_upload(&self) -> u64 {
        self.max_upload
    }
    fn with<T>(
        &self,
        owner: &str,
        id: &str,
        f: impl FnOnce(&mut Record) -> Result<T, CloudError>,
    ) -> Result<T, CloudError> {
        let mut records = self.records.lock().map_err(|_| CloudError::Unavailable)?;
        // Quem não é dono vê o mesmo erro de orçamento inexistente.
        let record = records
            .get_mut(id)
            .filter(|r| r.owner == owner)
            .ok_or(CloudError::InvalidRequest)?;
        f(record)
    }

    pub fn create(
        &self,
        owner: &str,
        request: &QuoteRequest,
        now: u64,
    ) -> Result<(String, Quote), CloudError> {
        let quote = self.service.quote(request, now)?;
        let id = uuid::Uuid::new_v4().simple().to_string();
        let mut records = self.records.lock().map_err(|_| CloudError::Unavailable)?;
        // Orçamentos vencidos são descartados; limite evita crescimento sem fim.
        records.retain(|_, r| r.quote.expires_at > now);
        if records.len() >= 4096 {
            return Err(CloudError::Busy);
        }
        records.insert(
            id.clone(),
            Record {
                owner: owner.into(),
                quote: quote.clone(),
                stage: Stage::Quoted,
            },
        );
        Ok((id, quote))
    }

    pub fn authorize_upload(&self, owner: &str, id: &str, now: u64) -> Result<(), CloudError> {
        self.with(owner, id, |r| {
            if now >= r.quote.expires_at {
                return Err(CloudError::QuoteExpired);
            }
            if r.stage != Stage::Quoted {
                return Err(CloudError::Conflict);
            }
            r.stage = Stage::UploadAuthorized;
            Ok(())
        })
    }

    pub fn upload(&self, owner: &str, id: &str, body: &[u8], now: u64) -> Result<(), CloudError> {
        let max = self.with(owner, id, |r| {
            if now >= r.quote.expires_at {
                return Err(CloudError::QuoteExpired);
            }
            // Reenvio é permitido antes da inspeção; a geração muda e invalida inspeção anterior.
            if !matches!(r.stage, Stage::UploadAuthorized | Stage::Uploaded(_)) {
                return Err(CloudError::Conflict);
            }
            Ok(self.service.max_input_bytes(r.quote.tool))
        })?;
        let deadline = Instant::now() + Duration::from_secs(self.upload_seconds);
        let generation = self
            .storage
            .put_input(id, Cursor::new(body), max, deadline)?;
        self.with(owner, id, |r| {
            r.stage = Stage::Uploaded(generation);
            Ok(())
        })
    }

    /// Orçamento definitivo. Só texto é inspecionado por ora; PDF/Office exigem inspetor próprio.
    pub fn inspect(&self, owner: &str, id: &str, now: u64) -> Result<Finalized, CloudError> {
        let (quote, generation) = self.with(owner, id, |r| match r.stage {
            Stage::Uploaded(g) => Ok((r.quote.clone(), g)),
            _ => Err(CloudError::Conflict),
        })?;
        self.storage.check_generation(id, generation)?;
        if quote.mime != "text/plain" {
            return Err(CloudError::Unavailable);
        }
        let bytes = self.storage.read_input(id)?;
        let text = std::str::from_utf8(&bytes).map_err(|_| CloudError::InvalidRequest)?;
        let inspected = Inspected::from_text(text, generation);
        let done = self.service.finalize(&quote, &inspected, now)?;
        self.with(owner, id, |r| {
            r.stage = Stage::Inspected(done.clone());
            Ok(())
        })?;
        Ok(done)
    }

    /// Confirma o orçamento definitivo. Idempotente: repetir devolve os mesmos dados (mesma chave).
    pub fn confirm(&self, owner: &str, id: &str, now: u64) -> Result<Confirmed, CloudError> {
        let (finalized, first) = self.with(owner, id, |r| match &r.stage {
            Stage::Inspected(f) => {
                if now >= r.quote.expires_at {
                    return Err(CloudError::QuoteExpired);
                }
                Ok((f.clone(), true))
            }
            Stage::Confirmed(f) => Ok((f.clone(), false)),
            _ => Err(CloudError::Conflict),
        })?;
        // O objeto precisa ser exatamente o inspecionado, mesmo se algo o trocou depois.
        self.storage
            .check_generation(id, finalized.object_generation)?;
        let digest = format!("{:x}", Sha256::digest(self.storage.read_input(id)?));
        if first {
            self.with(owner, id, |r| {
                r.stage = Stage::Confirmed(finalized.clone());
                Ok(())
            })?;
        }
        Ok(Confirmed {
            key: id.into(),
            input_digest: digest,
            units: finalized.units,
            maximum_usd_micros: finalized.maximum_usd_micros,
        })
    }
}
