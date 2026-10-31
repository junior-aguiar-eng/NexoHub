//! Política versionada do piloto. Falhas de configuração recusam a ativação.

use serde::{Deserialize, Serialize};

const PILOT_JSON: &str = include_str!("../../../../scripts/cloud/hybrid-policy.json");

macro_rules! policy_section {
    ($name:ident { $($field:ident),+ $(,)? }) => {
        #[derive(Clone, Debug, Deserialize, Serialize)]
        #[serde(rename_all = "camelCase", deny_unknown_fields)]
        pub struct $name { $(pub $field: u64),+ }
    };
}

policy_section!(Budget {
    tasks_usd_micros,
    operations_usd_micros,
    safety_usd_micros,
    participant_usd_micros
});
policy_section!(Ocr {
    monthly_pages,
    max_pages,
    max_bytes,
    max_megapixels,
    timeout_seconds
});
policy_section!(Translation {
    monthly_characters,
    max_characters,
    max_target_languages,
    timeout_seconds
});
policy_section!(Office {
    monthly_files,
    max_input_bytes,
    max_output_pages,
    timeout_seconds
});
policy_section!(Concurrency {
    global_running,
    global_queued,
    participant_running,
    participant_queued
});
policy_section!(Inspection {
    participant_daily,
    participant_monthly,
    global_monthly
});
policy_section!(Transfer {
    upload_timeout_seconds,
    max_output_bytes,
    max_downloads,
    max_download_bytes_per_job,
    global_stored_bytes
});
policy_section!(Retention {
    result_seconds,
    cleanup_interval_seconds,
    lifecycle_fallback_seconds,
    audit_days
});

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Timing {
    pub quote_seconds: u64,
    pub queue_seconds: u64,
    pub unknown_provider_quarantine_seconds: u64,
    pub month_guard_seconds: u64,
    pub max_price_age_seconds: u64,
    pub billing_time_zone: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CloudPolicy {
    pub version: String,
    pub cloud_enabled: bool,
    pub max_participants: u64,
    pub budget: Budget,
    pub ocr: Ocr,
    pub translation: Translation,
    pub office: Office,
    pub concurrency: Concurrency,
    pub inspection: Inspection,
    pub transfer: Transfer,
    pub retention: Retention,
    pub timing: Timing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PolicyError(pub &'static str);

impl std::fmt::Display for PolicyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.0)
    }
}

impl std::error::Error for PolicyError {}

fn bounded(value: u64, maximum: u64) -> Result<(), PolicyError> {
    if value == 0 || value > maximum {
        return Err(PolicyError("Limite de nuvem fora da política aprovada."));
    }
    Ok(())
}

impl CloudPolicy {
    pub fn pilot() -> Result<Self, PolicyError> {
        Self::from_json(PILOT_JSON)
    }

    pub fn from_json(json: &str) -> Result<Self, PolicyError> {
        let policy: Self = serde_json::from_str(json)
            .map_err(|_| PolicyError("Configuração de nuvem inválida."))?;
        policy.validate()?;
        Ok(policy)
    }

    pub fn validate(&self) -> Result<(), PolicyError> {
        // Este primeiro estágio não dispõe de identidade/ledger/motores homologados.
        if self.cloud_enabled {
            return Err(PolicyError(
                "Nuvem desativada até concluir os gates de ativação.",
            ));
        }
        if self.version.trim().is_empty() {
            return Err(PolicyError("Versão da política ausente."));
        }
        bounded(self.max_participants, 300)?;
        bounded(self.budget.tasks_usd_micros, 60_000_000)?;
        bounded(self.budget.operations_usd_micros, 15_000_000)?;
        bounded(self.budget.participant_usd_micros, 200_000)?;
        if self.budget.safety_usd_micros < 25_000_000 {
            return Err(PolicyError("Margem financeira abaixo do mínimo aprovado."));
        }
        let total = self
            .budget
            .tasks_usd_micros
            .checked_add(self.budget.operations_usd_micros)
            .and_then(|v| v.checked_add(self.budget.safety_usd_micros))
            .ok_or(PolicyError("Orçamento fora do intervalo permitido."))?;
        let allocations = self
            .max_participants
            .checked_mul(self.budget.participant_usd_micros)
            .ok_or(PolicyError(
                "Saldo dos participantes fora do intervalo permitido.",
            ))?;
        if total > 100_000_000 || allocations > self.budget.tasks_usd_micros {
            return Err(PolicyError("Distribuição excede o orçamento aprovado."));
        }
        for (value, maximum) in [
            (self.ocr.monthly_pages, 50),
            (self.ocr.max_pages, 15),
            (self.ocr.max_bytes, 20 * 1024 * 1024),
            (self.ocr.max_megapixels, 25),
            (self.ocr.timeout_seconds, 120),
            (self.translation.monthly_characters, 5_000),
            (self.translation.max_characters, 5_000),
            (self.translation.max_target_languages, 1),
            (self.translation.timeout_seconds, 60),
            (self.office.monthly_files, 10),
            (self.office.max_input_bytes, 10 * 1024 * 1024),
            (self.office.max_output_pages, 50),
            (self.office.timeout_seconds, 120),
            (self.concurrency.global_running, 2),
            (self.concurrency.global_queued, 20),
            (self.concurrency.participant_running, 1),
            (self.concurrency.participant_queued, 1),
            (self.inspection.participant_daily, 5),
            (self.inspection.participant_monthly, 60),
            (self.inspection.global_monthly, 6_000),
            (self.transfer.upload_timeout_seconds, 120),
            (self.transfer.max_output_bytes, 30 * 1024 * 1024),
            (self.transfer.max_downloads, 3),
            (self.transfer.max_download_bytes_per_job, 90 * 1024 * 1024),
            (self.transfer.global_stored_bytes, 2 * 1024 * 1024 * 1024),
            (self.retention.result_seconds, 3_600),
            (self.retention.cleanup_interval_seconds, 900),
            (self.retention.lifecycle_fallback_seconds, 86_400),
            (self.retention.audit_days, 90),
            (self.timing.quote_seconds, 300),
            (self.timing.queue_seconds, 300),
            (self.timing.unknown_provider_quarantine_seconds, 600),
            (self.timing.max_price_age_seconds, 604_800),
        ] {
            bounded(value, maximum)?;
        }
        // A janela de proteção não pode diminuir ao customizar a configuração.
        if self.timing.month_guard_seconds < 900 || self.timing.month_guard_seconds > 86_400 {
            return Err(PolicyError("Janela de proteção mensal inválida."));
        }
        if self.timing.billing_time_zone != "America/Los_Angeles" {
            return Err(PolicyError("Competência financeira não homologada."));
        }
        Ok(())
    }
}
