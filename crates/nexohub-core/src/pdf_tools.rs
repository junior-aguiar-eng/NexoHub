//! Executores PDF nativos que preservam o original e produzem artifacts derivados.

use crate::domain::{Artifact, Operation};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::storage::ProjectStore;
use lopdf::{Document, LoadOptions, SaveOptions};
use serde::{Deserialize, Serialize};
use serde_json::json;

const PDF_MIME_TYPE: &str = "application/pdf";
const MAX_DECOMPRESSED_STREAM_SIZE: usize = 256 * 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressPdfRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
    pub compression_level: u8,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfToolResult {
    pub artifact: Artifact,
    pub operation: Operation,
}

pub fn compress_pdf(request: CompressPdfRequest) -> CoreResult<PdfToolResult> {
    if !(1..=9).contains(&request.compression_level) {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O nível de compressão deve estar entre 1 e 9.",
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
    if input.mime_type != PDF_MIME_TYPE {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A ferramenta aceita somente artifacts PDF.",
        ));
    }

    let source = store.read_artifact_bytes(&request.artifact_id)?;
    let options = LoadOptions::with_max_decompressed_size(MAX_DECOMPRESSED_STREAM_SIZE);
    let mut document = Document::load_mem_with_options(&source, options)
        .map_err(|_| CoreError::pdf("Não foi possível interpretar o PDF de entrada."))?;
    document.compress();

    let save_options = SaveOptions::builder()
        .use_object_streams(true)
        .use_xref_streams(true)
        .compression_level(u32::from(request.compression_level))
        .build();
    let mut output = Vec::new();
    document
        .save_with_options(&mut output, save_options)
        .map_err(|_| CoreError::pdf("Não foi possível gerar o PDF comprimido."))?;

    let (artifact, operation) = store.create_derived_artifact(
        &request.document_id,
        &request.artifact_id,
        PDF_MIME_TYPE,
        &output,
        "pdf-compress",
        json!({ "compressionLevel": request.compression_level }),
    )?;
    Ok(PdfToolResult {
        artifact,
        operation,
    })
}
