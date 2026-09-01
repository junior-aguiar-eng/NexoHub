//! Entidades persistentes do Document Artifact Graph.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Projeto local que agrega documentos e seu armazenamento.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Documento lógico pertencente a um projeto.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// Papel de um artifact no histórico do documento.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ArtifactKind {
    Original,
    Derived,
    Export,
}

impl ArtifactKind {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Original => "ORIGINAL",
            Self::Derived => "DERIVED",
            Self::Export => "EXPORT",
        }
    }

    pub(crate) fn parse(value: &str) -> Option<Self> {
        match value {
            "ORIGINAL" => Some(Self::Original),
            "DERIVED" => Some(Self::Derived),
            "EXPORT" => Some(Self::Export),
            _ => None,
        }
    }
}

/// Blob imutável que participa do grafo documental.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Artifact {
    pub id: String,
    pub document_id: String,
    pub kind: ArtifactKind,
    pub mime_type: String,
    pub hash: String,
    pub size: u64,
    pub storage_path: String,
    pub created_at: i64,
}

/// Formato lógico associado a um artifact.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RepresentationType {
    Pdf,
    Text,
    Markdown,
    Ocr,
    DoclingJson,
    LexicalJson,
}

/// Representação navegável de um artifact.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Representation {
    pub id: String,
    pub artifact_id: String,
    pub representation_type: RepresentationType,
    pub created_at: i64,
}

/// Categoria de um asset extraído ou associado.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AssetKind {
    Image,
    Table,
    Attachment,
    Font,
}

/// Asset persistente relacionado a um artifact.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub id: String,
    pub artifact_id: String,
    pub kind: AssetKind,
    pub mime_type: String,
    pub hash: String,
    pub size: u64,
    pub storage_path: String,
    pub created_at: i64,
}

/// Metadados não destrutivos sobrepostos a um artifact.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Overlay {
    pub id: String,
    pub artifact_id: String,
    pub kind: String,
    pub data: Value,
    pub created_at: i64,
}

/// Estado persistido de uma operação documental.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OperationStatus {
    Pending,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

impl OperationStatus {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Running => "RUNNING",
            Self::Succeeded => "SUCCEEDED",
            Self::Failed => "FAILED",
            Self::Cancelled => "CANCELLED",
        }
    }
}

/// Falha estruturada registrada por uma operação.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationFailure {
    pub code: String,
    pub message: String,
}

/// Transformação persistida no Operation Graph.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Operation {
    pub id: String,
    pub tool_id: String,
    pub status: OperationStatus,
    pub parameters: Value,
    pub created_at: i64,
    pub started_at: Option<i64>,
    pub finished_at: Option<i64>,
    pub error: Option<OperationFailure>,
}

/// Aresta de entrada entre uma operação e um artifact.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationInput {
    pub operation_id: String,
    pub artifact_id: String,
}

/// Aresta de saída entre uma operação e um novo artifact.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationOutput {
    pub operation_id: String,
    pub artifact_id: String,
}

/// Registro de exportação sem transformar o destino em fonte de verdade.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Export {
    pub id: String,
    pub document_id: String,
    pub artifact_id: String,
    pub destination_name: String,
    pub created_at: i64,
}

/// Resultado de uma importação original.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedDocument {
    pub document: Document,
    pub artifact: Artifact,
}
