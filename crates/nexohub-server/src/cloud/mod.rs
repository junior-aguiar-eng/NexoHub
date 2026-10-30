//! Contratos internos da nuvem opcional. Nenhum motor ou rota paga é habilitado aqui.

pub mod admission;
pub mod auth;
pub mod firestore;
pub mod ledger;
pub mod policy;
pub mod pricing;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CloudError {
    Unauthorized,
    Unverified,
    Revoked,
    Disabled,
    NotAdmitted,
    InvalidRequest,
    QuotaExceeded,
    BudgetExceeded,
    Busy,
    Conflict,
    PriceUnavailable,
    Unavailable,
}

impl std::fmt::Display for CloudError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        // Nunca incluir token, documento, endereço, URL autenticada ou erro HTTP bruto.
        f.write_str(match self {
            Self::Unauthorized => "Autenticação inválida.",
            Self::Unverified => "Confirme seu e-mail para acessar a nuvem.",
            Self::Revoked => "Sessão revogada. Entre novamente.",
            Self::Disabled => "Conta suspensa.",
            Self::NotAdmitted => "Participante não admitido no piloto.",
            Self::InvalidRequest => "Solicitação de nuvem inválida.",
            Self::QuotaExceeded => "Franquia individual insuficiente.",
            Self::BudgetExceeded => "Orçamento global insuficiente.",
            Self::Busy => "Limite de tarefas simultâneas atingido.",
            Self::Conflict => "Conflito na operação de nuvem.",
            Self::PriceUnavailable => "Preço indisponível ou desatualizado.",
            Self::Unavailable => "Serviço de nuvem indisponível.",
        })
    }
}
impl std::error::Error for CloudError {}
