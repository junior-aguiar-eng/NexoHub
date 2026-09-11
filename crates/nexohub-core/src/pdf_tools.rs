//! Executores PDF nativos que preservam o original e produzem artifacts derivados.

use crate::domain::{Artifact, Operation};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::storage::ProjectStore;
use lopdf::{Document, LoadOptions, SaveOptions};
use serde::{Deserialize, Serialize};
use serde_json::json;

const PDF_MIME_TYPE: &str = "application/pdf";
const MAX_DECOMPRESSED_STREAM_SIZE: usize = 64 * 1024 * 1024;

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
    let limits = store.limits().clone();
    if input.size > limits.max_pdf_input_bytes {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} MiB para esta operação.",
                limits.max_pdf_input_bytes / (1024 * 1024)
            ),
        ));
    }

    let source = store.read_artifact_bytes(&request.artifact_id)?;
    let options = LoadOptions::with_max_decompressed_size(MAX_DECOMPRESSED_STREAM_SIZE);
    let mut document = Document::load_mem_with_options(&source, options)
        .map_err(|_| CoreError::pdf("Não foi possível interpretar o PDF de entrada."))?;
    if document.is_encrypted() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "PDF protegido por senha não é suportado pela compressão.",
        ));
    }
    let page_count = document.get_pages().len();
    if page_count == 0 || page_count > limits.max_pdf_pages {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF deve conter entre 1 e {} páginas.",
                limits.max_pdf_pages
            ),
        ));
    }
    if document.objects.len() > limits.max_pdf_objects {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} objetos internos.",
                limits.max_pdf_objects
            ),
        ));
    }
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

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizePdfRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
    pub page_order: Vec<u32>,
    pub rotation_degrees: Option<i32>,
}

pub fn organize_pdf(request: OrganizePdfRequest) -> CoreResult<PdfToolResult> {
    if request.page_order.is_empty() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A lista de páginas para organização não pode estar vazia.",
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
    let limits = store.limits().clone();
    if input.size > limits.max_pdf_input_bytes {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} MiB para esta operação.",
                limits.max_pdf_input_bytes / (1024 * 1024)
            ),
        ));
    }

    let source = store.read_artifact_bytes(&request.artifact_id)?;
    let options = LoadOptions::with_max_decompressed_size(MAX_DECOMPRESSED_STREAM_SIZE);
    let mut document = Document::load_mem_with_options(&source, options)
        .map_err(|_| CoreError::pdf("Não foi possível interpretar o PDF de entrada."))?;
    if document.is_encrypted() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "PDF protegido por senha não é suportado pela organização.",
        ));
    }

    let existing_pages = document.get_pages();
    let page_count = existing_pages.len();
    if page_count == 0 || page_count > limits.max_pdf_pages {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF deve conter entre 1 e {} páginas.",
                limits.max_pdf_pages
            ),
        ));
    }
    if document.objects.len() > limits.max_pdf_objects {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} objetos internos.",
                limits.max_pdf_objects
            ),
        ));
    }

    for &page_num in &request.page_order {
        if !existing_pages.contains_key(&page_num) {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                format!("A página {} não existe no documento.", page_num),
            ));
        }
    }

    if let Some(rot) = request.rotation_degrees {
        if ![0, 90, 180, 270].contains(&rot) {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "A rotação deve ser 0, 90, 180 ou 270 graus.",
            ));
        }
        if rot != 0 {
            for &page_num in &request.page_order {
                let page_id = existing_pages[&page_num];
                if let Ok(page_dict) = document
                    .get_object_mut(page_id)
                    .and_then(|o| o.as_dict_mut())
                {
                    let current_rot = page_dict
                        .get(b"Rotate")
                        .and_then(|r| r.as_i64())
                        .unwrap_or(0);
                    let new_rot = (current_rot + rot as i64).rem_euclid(360);
                    page_dict.set("Rotate", lopdf::Object::Integer(new_rot));
                }
            }
        }
    }

    let new_kids: Vec<lopdf::Object> = request
        .page_order
        .iter()
        .map(|page_num| lopdf::Object::Reference(existing_pages[page_num]))
        .collect();
    let new_count = new_kids.len() as i64;

    let pages_id = document
        .catalog()
        .map_err(|_| CoreError::pdf("Catálogo PDF ausente ou inválido."))?
        .get(b"Pages")
        .map_err(|_| CoreError::pdf("Raiz de páginas ausente no catálogo PDF."))?
        .as_reference()
        .map_err(|_| CoreError::pdf("Referência de páginas inválida."))?;

    let pages_dict = document
        .get_object_mut(pages_id)
        .map_err(|_| CoreError::pdf("Objeto raiz de páginas não encontrado."))?
        .as_dict_mut()
        .map_err(|_| CoreError::pdf("Objeto raiz de páginas não é um dicionário."))?;

    pages_dict.set("Kids", lopdf::Object::Array(new_kids));
    pages_dict.set("Count", lopdf::Object::Integer(new_count));
    document.prune_objects();

    let save_options = SaveOptions::builder()
        .use_object_streams(true)
        .use_xref_streams(true)
        .build();
    let mut output = Vec::new();
    document
        .save_with_options(&mut output, save_options)
        .map_err(|_| CoreError::pdf("Não foi possível gerar o PDF organizado."))?;

    let (artifact, operation) = store.create_derived_artifact(
        &request.document_id,
        &request.artifact_id,
        PDF_MIME_TYPE,
        &output,
        "pdf-organize",
        json!({
            "pageOrder": request.page_order,
            "rotation": request.rotation_degrees,
        }),
    )?;
    Ok(PdfToolResult {
        artifact,
        operation,
    })
}
