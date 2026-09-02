//! Erros estruturados e códigos estáveis expostos pelos contratos nativos.

use serde::{Deserialize, Serialize};
use std::fmt::{Display, Formatter};

/// Código estável para tratamento entre runtimes.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    InvalidArgument,
    ProjectAlreadyExists,
    ProjectNotFound,
    DocumentNotFound,
    ArtifactNotFound,
    StorageIo,
    Database,
    ProjectCorrupted,
    IntegrityViolation,
    MigrationFailed,
    ResourceLimit,
    PdfProcessing,
    ReviewUnavailable,
    ReviewProcessing,
    SidecarTimeout,
}

/// Erro seguro para IPC, sem consultas SQL nem conteúdo documental.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoreError {
    pub code: ErrorCode,
    pub message: String,
}

impl CoreError {
    #[must_use]
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub(crate) fn io() -> Self {
        Self::new(
            ErrorCode::StorageIo,
            "Não foi possível acessar o armazenamento local.",
        )
    }

    pub(crate) fn database() -> Self {
        Self::new(
            ErrorCode::Database,
            "Não foi possível persistir os dados do projeto.",
        )
    }

    pub(crate) fn corrupted_project() -> Self {
        Self::new(
            ErrorCode::ProjectCorrupted,
            "O projeto está corrompido ou inconsistente. Restaure uma cópia válida.",
        )
    }

    pub(crate) fn integrity(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::IntegrityViolation, message)
    }

    pub(crate) fn pdf(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::PdfProcessing, message)
    }

    pub(crate) fn review_unavailable(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::ReviewUnavailable, message)
    }

    pub(crate) fn review(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::ReviewProcessing, message)
    }
}

impl Display for CoreError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for CoreError {}

pub type CoreResult<T> = Result<T, CoreError>;
