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
    fn purge_expired(&self, records: &mut HashMap<String, Record>, now: u64) {
        let expired_ids: Vec<String> = records
            .iter()
            .filter(|(_, r)| r.quote.expires_at <= now)
            .map(|(id, _)| id.clone())
            .collect();
        for id in expired_ids {
            records.remove(&id);
            let _ = self.storage.abandon(&id);
        }
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
        // Orçamentos vencidos são descartados junto com seus objetos em memória; limite evita crescimento sem fim.
        self.purge_expired(&mut records, now);
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
        let mut records = self.records.lock().map_err(|_| CloudError::Unavailable)?;
        let expired = records
            .get(id)
            .filter(|r| r.owner == owner)
            .is_some_and(|r| now >= r.quote.expires_at);
        self.purge_expired(&mut records, now);
        if expired {
            return Err(CloudError::QuoteExpired);
        }
        let r = records
            .get_mut(id)
            .filter(|r| r.owner == owner)
            .ok_or(CloudError::InvalidRequest)?;
        if r.stage != Stage::Quoted {
            return Err(CloudError::Conflict);
        }
        r.stage = Stage::UploadAuthorized;
        Ok(())
    }

    pub fn upload(&self, owner: &str, id: &str, body: &[u8], now: u64) -> Result<(), CloudError> {
        let max = {
            let mut records = self.records.lock().map_err(|_| CloudError::Unavailable)?;
            let expired = records
                .get(id)
                .filter(|r| r.owner == owner)
                .is_some_and(|r| now >= r.quote.expires_at);
            self.purge_expired(&mut records, now);
            if expired {
                return Err(CloudError::QuoteExpired);
            }
            let r = records
                .get_mut(id)
                .filter(|r| r.owner == owner)
                .ok_or(CloudError::InvalidRequest)?;
            // Reenvio é permitido antes da inspeção; a geração muda e invalida inspeção anterior.
            if !matches!(r.stage, Stage::UploadAuthorized | Stage::Uploaded(_)) {
                return Err(CloudError::Conflict);
            }
            self.service.max_input_bytes(r.quote.tool)
        };
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
        let (finalized, first) = {
            let mut records = self.records.lock().map_err(|_| CloudError::Unavailable)?;
            let expired = records
                .get(id)
                .filter(|r| r.owner == owner && matches!(r.stage, Stage::Inspected(_)))
                .is_some_and(|r| now >= r.quote.expires_at);
            if expired {
                self.purge_expired(&mut records, now);
                return Err(CloudError::QuoteExpired);
            }
            self.purge_expired(&mut records, now);
            let r = records
                .get(id)
                .filter(|r| r.owner == owner)
                .ok_or(CloudError::InvalidRequest)?;
            match &r.stage {
                Stage::Inspected(f) => (f.clone(), true),
                Stage::Confirmed(f) => (f.clone(), false),
                _ => return Err(CloudError::Conflict),
            }
        };
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
