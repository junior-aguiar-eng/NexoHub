//! Contrato dos provedores de execução e adaptador opcional isolado Office/Cloud.
use super::quotes::CloudTool;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ProviderDone {
    pub cost_usd_micros: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProviderError {
    /// Recusado antes de qualquer consumo: seguro liberar a vaga.
    Rejected,
    /// Timeout, queda ou resposta perdida: a chamada pode ter sido cobrada.
    Unknown,
}

pub trait Provider: Send + Sync {
    /// `key` é estável por job; o provedor real deve usá-la como chave de idempotência.
    fn invoke(&self, key: &str, tool: CloudTool) -> Result<ProviderDone, ProviderError>;
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OfficeCloudConfig {
    pub endpoint_url: String,
    pub bearer_token: Option<String>,
    pub timeout_seconds: u64,
}

impl OfficeCloudConfig {
    #[must_use]
    pub fn from_env() -> Option<Self> {
        let endpoint = std::env::var("NEXOHUB_CLOUD_OFFICE_URL")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())?;
        let token = std::env::var("NEXOHUB_CLOUD_OFFICE_TOKEN")
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        Some(Self {
            endpoint_url: endpoint,
            bearer_token: token,
            timeout_seconds: 90,
        })
    }
}

/// Adaptador opt-in que aciona um worker isolado stateless (sem egresso público) para Office/Cloud.
pub struct OfficeCloudProvider {
    config: OfficeCloudConfig,
    client: reqwest::blocking::Client,
}

impl OfficeCloudProvider {
    pub fn new(config: OfficeCloudConfig) -> Result<Self, ProviderError> {
        if !config.endpoint_url.starts_with("https://")
            && !config.endpoint_url.starts_with("http://127.0.0.1")
            && !config.endpoint_url.starts_with("http://localhost")
        {
            return Err(ProviderError::Rejected);
        }
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds.max(5)))
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .map_err(|_| ProviderError::Rejected)?;
        Ok(Self { config, client })
    }
}

impl Provider for OfficeCloudProvider {
    fn invoke(&self, key: &str, tool: CloudTool) -> Result<ProviderDone, ProviderError> {
        if tool != CloudTool::OfficeToPdf || key.trim().is_empty() {
            return Err(ProviderError::Rejected);
        }
        let mut req = self
            .client
            .post(&self.config.endpoint_url)
            .header("Idempotency-Key", key)
            .header("X-NexoHub-Tool", "office-to-pdf");
        if let Some(ref token) = self.config.bearer_token {
            req = req.bearer_auth(token);
        }
        let response = match req.send() {
            Ok(resp) => resp,
            Err(_) => return Err(ProviderError::Unknown),
        };
        let status = response.status();
        if status.is_success() {
            let cost = response
                .headers()
                .get("x-nexohub-cost-usd-micros")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            return Ok(ProviderDone {
                cost_usd_micros: cost,
            });
        }
        if status.is_client_error() && status.as_u16() != 408 && status.as_u16() != 429 {
            Err(ProviderError::Rejected)
        } else {
            Err(ProviderError::Unknown)
        }
    }
}

/// Provedor falso com contagem de chamadas, para provar que nada é cobrado em duplicidade.
pub struct FakeProvider {
    calls: AtomicU64,
    outcome: Result<ProviderDone, ProviderError>,
}
impl FakeProvider {
    pub fn new(outcome: Result<ProviderDone, ProviderError>) -> Self {
        Self {
            calls: AtomicU64::new(0),
            outcome,
        }
    }
    pub fn calls(&self) -> u64 {
        self.calls.load(Ordering::SeqCst)
    }
}
impl Provider for FakeProvider {
    fn invoke(&self, _key: &str, _tool: CloudTool) -> Result<ProviderDone, ProviderError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.outcome
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_insecure_non_local_office_endpoint_and_wrong_tool() {
        let insecure = OfficeCloudProvider::new(OfficeCloudConfig {
            endpoint_url: "http://example.com/office".to_string(),
            bearer_token: None,
            timeout_seconds: 10,
        });
        assert!(matches!(insecure, Err(ProviderError::Rejected)));

        let valid = OfficeCloudProvider::new(OfficeCloudConfig {
            endpoint_url: "http://127.0.0.1:9/office".to_string(),
            bearer_token: Some("secret".to_string()),
            timeout_seconds: 5,
        })
        .unwrap();
        assert_eq!(
            valid.invoke("job-1", CloudTool::TranslateText),
            Err(ProviderError::Rejected)
        );
        assert_eq!(valid.invoke("   ", CloudTool::OfficeToPdf), Err(ProviderError::Rejected));
    }
}
