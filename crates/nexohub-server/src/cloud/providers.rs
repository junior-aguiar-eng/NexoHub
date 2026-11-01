//! Contrato dos provedores de execução. Só há provedor falso: nenhum adapter real é habilitado.
use super::quotes::CloudTool;
use std::sync::atomic::{AtomicU64, Ordering};

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
