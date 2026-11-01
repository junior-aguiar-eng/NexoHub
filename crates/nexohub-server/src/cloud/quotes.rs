//! Orçamento preliminar (metadados) e definitivo (conteúdo inspecionado). Sem I/O nem chamada paga.
use super::{CloudError, ledger::Units, policy::CloudPolicy, pricing::PriceBook};
use serde::{Deserialize, Serialize};

/// Razão máxima de expansão aceita na inspeção (proteção contra bombas de descompressão).
const MAX_EXPANSION_RATIO: u64 = 100;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CloudTool {
    Ocr,
    TranslateText,
    OfficeToPdf,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct QuoteRequest {
    pub tool: CloudTool,
    pub mime: String,
    pub declared_bytes: u64,
    pub pages: u64,
    pub characters: u64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Quote {
    pub tool: CloudTool,
    pub mime: String,
    pub units: Units,
    pub expires_at: u64,
    pub maximum_usd_micros: u64,
    pub policy_version: String,
    pub price_version: String,
    pub requires_upload: bool,
    pub requires_confirmation: bool,
}

/// Resultado da inspeção do objeto armazenado, nunca do que o cliente declarou.
#[derive(Clone, Debug)]
pub struct Inspected {
    pub mime: String,
    pub bytes: u64,
    pub expanded_bytes: u64,
    pub pages: u64,
    pub characters: u64,
    pub object_generation: u64,
}
impl Inspected {
    /// Contagem por escalares Unicode, não por bytes.
    pub fn from_text(text: &str, object_generation: u64) -> Self {
        let bytes = text.len() as u64;
        Self {
            mime: "text/plain".into(),
            bytes,
            expanded_bytes: bytes,
            pages: 0,
            characters: text.chars().count() as u64,
            object_generation,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Finalized {
    pub units: Units,
    pub maximum_usd_micros: u64,
    pub object_generation: u64,
}

pub struct QuoteService {
    policy: CloudPolicy,
    prices: PriceBook,
}

fn mime_allowed(tool: CloudTool, mime: &str) -> bool {
    match tool {
        CloudTool::Ocr => matches!(mime, "application/pdf" | "image/png" | "image/jpeg"),
        CloudTool::TranslateText => mime == "text/plain",
        CloudTool::OfficeToPdf => matches!(
            mime,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                | "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
    }
}

impl QuoteService {
    pub fn new(policy: CloudPolicy, prices: PriceBook) -> Self {
        Self { policy, prices }
    }

    fn max_bytes(&self, tool: CloudTool) -> u64 {
        match tool {
            CloudTool::Ocr => self.policy.ocr.max_bytes,
            CloudTool::OfficeToPdf => self.policy.office.max_input_bytes,
            CloudTool::TranslateText => self.policy.translation.max_characters * 4,
        }
    }

    fn units(&self, tool: CloudTool, pages: u64, characters: u64) -> Units {
        match tool {
            CloudTool::Ocr => Units {
                ocr_pages: pages,
                ..Units::default()
            },
            CloudTool::TranslateText => Units {
                characters,
                ..Units::default()
            },
            CloudTool::OfficeToPdf => Units {
                office_files: 1,
                ..Units::default()
            },
        }
    }

    pub fn quote(&self, req: &QuoteRequest, now: u64) -> Result<Quote, CloudError> {
        if !mime_allowed(req.tool, &req.mime) || req.declared_bytes > self.max_bytes(req.tool) {
            return Err(CloudError::InvalidRequest);
        }
        let units = self.units(req.tool, req.pages, req.characters);
        units.validate(&self.policy)?;
        let maximum = self.prices.estimate(&units, &self.policy, now)?;
        Ok(Quote {
            tool: req.tool,
            mime: req.mime.clone(),
            units,
            expires_at: now + self.policy.timing.quote_seconds,
            maximum_usd_micros: maximum,
            policy_version: self.policy.version.clone(),
            price_version: self.prices.version.clone(),
            requires_upload: req.tool != CloudTool::TranslateText || req.declared_bytes > 0,
            requires_confirmation: true,
        })
    }

    pub fn finalize(
        &self,
        quote: &Quote,
        found: &Inspected,
        now: u64,
    ) -> Result<Finalized, CloudError> {
        if now >= quote.expires_at {
            return Err(CloudError::QuoteExpired);
        }
        if quote.policy_version != self.policy.version {
            return Err(CloudError::QuoteExpired);
        }
        if found.bytes > self.max_bytes(quote.tool)
            || found.expanded_bytes > found.bytes.max(1).saturating_mul(MAX_EXPANSION_RATIO)
        {
            return Err(CloudError::InvalidRequest);
        }
        if found.mime != quote.mime {
            return Err(CloudError::InputChanged);
        }
        let units = self.units(quote.tool, found.pages, found.characters);
        units
            .validate(&self.policy)
            .map_err(|_| CloudError::InvalidRequest)?;
        if units != quote.units {
            return Err(CloudError::InputChanged);
        }
        let maximum = self.prices.estimate(&units, &self.policy, now)?;
        if maximum > quote.maximum_usd_micros {
            return Err(CloudError::InputChanged);
        }
        Ok(Finalized {
            units,
            maximum_usd_micros: maximum,
            object_generation: found.object_generation,
        })
    }
}
