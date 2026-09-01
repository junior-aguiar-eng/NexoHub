//! Operações de texto que geram novas revisões sem alterar o artifact de origem.

use crate::domain::{Artifact, Operation};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::storage::ProjectStore;
use serde::{Deserialize, Serialize};
use serde_json::json;

const MAX_TEXT_BYTES: usize = 16 * 1024 * 1024;
const SUPPORTED_TEXT_TYPES: &[&str] = &["text/plain", "text/markdown"];

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTextRevisionRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
    pub content: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TextToolResult {
    pub artifact: Artifact,
    pub operation: Operation,
}

pub fn create_text_revision(request: CreateTextRevisionRequest) -> CoreResult<TextToolResult> {
    if request.content.len() > MAX_TEXT_BYTES {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O texto excede o limite de 16 MiB por revisão.",
        ));
    }

    let mut store = ProjectStore::open(&request.project_path)?;
    let input = store.get_artifact(&request.artifact_id)?;
    if input.document_id != request.document_id {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O artifact de entrada não pertence ao documento informado.",
        ));
    }
    if !SUPPORTED_TEXT_TYPES.contains(&input.mime_type.as_str()) {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A revisão aceita somente artifacts de texto ou Markdown.",
        ));
    }

    let bytes = request.content.as_bytes();
    let (artifact, operation) = store.create_derived_artifact(
        &request.document_id,
        &request.artifact_id,
        &input.mime_type,
        bytes,
        "text-edit",
        json!({ "encoding": "utf-8", "byteLength": bytes.len() }),
    )?;
    Ok(TextToolResult {
        artifact,
        operation,
    })
}
