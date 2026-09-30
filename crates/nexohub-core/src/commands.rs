//! Contratos estruturados para a porta IPC do desktop.

use crate::anchor_tools::{CreateAnchorRequest, ListAnchorsRequest};
use crate::domain::{Anchor, Overlay};
use crate::domain::{Artifact, Document, ImportedDocument, Project};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::overlay_tools::{CreatePdfOverlayRequest, ListPdfOverlaysRequest};
use crate::pdf_tools::{CompressPdfRequest, OrganizePdfRequest, PdfToolResult};
use crate::storage::ProjectStore;
use crate::text_tools::{CreateTextRevisionRequest, TextToolResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub project_path: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectRequest {
    pub project_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDocumentRequest {
    pub project_path: String,
    pub source_path: String,
    pub title: Option<String>,
    pub mime_type: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDocumentBytesRequest {
    pub project_path: String,
    pub title: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadArtifactBytesRequest {
    pub project_path: String,
    pub artifact_id: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordLauncherResultRequest {
    pub project_path: String,
    pub document_id: String,
    pub input_artifact_ids: Vec<String>,
    pub tool_id: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
    pub parameters: Value,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListDocumentsRequest {
    pub project_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDocumentRequest {
    pub project_path: String,
    pub document_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListArtifactsRequest {
    pub project_path: String,
    pub document_id: String,
}

pub fn create_project(request: CreateProjectRequest) -> CoreResult<Project> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::create(project_path, &request.name)?.project()
}

pub fn open_project(request: OpenProjectRequest) -> CoreResult<Project> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::open(project_path)?.project()
}

pub fn import_document(request: ImportDocumentRequest) -> CoreResult<ImportedDocument> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    let source_path = crate::grant_broker::require_granted(&request.source_path)?;
    ProjectStore::open(project_path)?.import_document(
        source_path,
        request.title.as_deref(),
        &request.mime_type,
    )
}

pub fn import_document_bytes(request: ImportDocumentBytesRequest) -> CoreResult<ImportedDocument> {
    if request.bytes.len() > 64 * 1024 * 1024 {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "O arquivo excede 64 MiB para importação pela interface.",
        ));
    }
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::open(project_path)?.import_document_bytes(
        &request.bytes,
        &request.title,
        &request.mime_type,
    )
}

pub fn read_artifact_bytes(request: ReadArtifactBytesRequest) -> CoreResult<Vec<u8>> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    let store = ProjectStore::open(project_path)?;
    if store.get_artifact(&request.artifact_id)?.size > 64 * 1024 * 1024 {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "O artifact excede 64 MiB para download pela interface.",
        ));
    }
    store.read_artifact_bytes(&request.artifact_id)
}

pub fn record_launcher_result(request: RecordLauncherResultRequest) -> CoreResult<PdfToolResult> {
    if request.bytes.is_empty() || request.bytes.len() > 64 * 1024 * 1024 {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "O resultado deve conter entre 1 byte e 64 MiB.",
        ));
    }
    let valid_type = match request.tool_id.as_str() {
        "pdf-merge" | "pdf-rotate" => request.mime_type == "application/pdf",
        "pdf-split" => matches!(
            request.mime_type.as_str(),
            "application/pdf" | "application/zip"
        ),
        "text-compare" => request.mime_type == "text/plain",
        _ => false,
    };
    if !valid_type {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Ferramenta ou tipo de resultado inválido.",
        ));
    }
    let valid_input_count = match request.tool_id.as_str() {
        "pdf-merge" => (2..=32).contains(&request.input_artifact_ids.len()),
        "pdf-split" | "pdf-rotate" => request.input_artifact_ids.len() == 1,
        "text-compare" => request.input_artifact_ids.len() == 2,
        _ => false,
    };
    if !valid_input_count {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A quantidade de artifacts de entrada não corresponde à ferramenta.",
        ));
    }
    let valid_content = match request.mime_type.as_str() {
        "application/pdf" => request.bytes.starts_with(b"%PDF-"),
        "application/zip" => request.bytes.starts_with(b"PK\x03\x04"),
        "text/plain" => std::str::from_utf8(&request.bytes).is_ok(),
        _ => false,
    };
    if !valid_content {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O conteúdo do resultado não corresponde ao tipo declarado.",
        ));
    }
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    let mut store = ProjectStore::open(project_path)?;
    let expected_input_mime = if request.tool_id == "text-compare" {
        "text/plain"
    } else {
        "application/pdf"
    };
    for id in &request.input_artifact_ids {
        if store.get_artifact(id)?.mime_type != expected_input_mime {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "O tipo de um artifact de entrada não corresponde à ferramenta.",
            ));
        }
    }
    let (artifact, operation) = store.create_derived_artifact_from_inputs(
        &request.document_id,
        &request.input_artifact_ids,
        &request.mime_type,
        &request.bytes,
        &request.tool_id,
        request.parameters,
    )?;
    Ok(PdfToolResult {
        artifact,
        operation,
    })
}

pub fn list_documents(request: ListDocumentsRequest) -> CoreResult<Vec<Document>> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::open(project_path)?.list_documents()
}

pub fn get_document(request: GetDocumentRequest) -> CoreResult<Document> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::open(project_path)?.get_document(&request.document_id)
}

pub fn list_artifacts(request: ListArtifactsRequest) -> CoreResult<Vec<Artifact>> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::open(project_path)?.list_artifacts(&request.document_id)
}

pub fn compress_pdf(request: CompressPdfRequest) -> CoreResult<PdfToolResult> {
    let _ = crate::grant_broker::require_granted(&request.project_path)?;
    crate::pdf_tools::compress_pdf(request)
}

pub fn organize_pdf(request: OrganizePdfRequest) -> CoreResult<PdfToolResult> {
    let _ = crate::grant_broker::require_granted(&request.project_path)?;
    crate::pdf_tools::organize_pdf(request)
}

pub fn create_text_revision(request: CreateTextRevisionRequest) -> CoreResult<TextToolResult> {
    crate::text_tools::create_text_revision(request)
}

pub fn create_pdf_overlay(request: CreatePdfOverlayRequest) -> CoreResult<Overlay> {
    crate::overlay_tools::create_pdf_overlay(request)
}

pub fn list_pdf_overlays(request: ListPdfOverlaysRequest) -> CoreResult<Vec<Overlay>> {
    crate::overlay_tools::list_pdf_overlays(request)
}

pub fn create_anchor(request: CreateAnchorRequest) -> CoreResult<Anchor> {
    crate::anchor_tools::create_anchor(request)
}

pub fn list_anchors(request: ListAnchorsRequest) -> CoreResult<Vec<Anchor>> {
    crate::anchor_tools::list_anchors(request)
}

pub fn execute_ocr(
    request: crate::python_engine::ExecuteOcrRequest,
) -> CoreResult<crate::python_engine::OcrToolResult> {
    let _ = crate::grant_broker::require_granted(&request.project_path)?;
    crate::python_engine::execute_ocr(request)
}

pub fn inspect_docx(
    request: crate::python_engine::InspectDocxRequest,
) -> CoreResult<crate::python_engine::DocxInspectionResult> {
    let _ = crate::grant_broker::require_granted(&request.project_path)?;
    crate::python_engine::inspect_docx(request)
}

pub fn create_docx(
    request: crate::python_engine::CreateDocxRequest,
) -> CoreResult<crate::python_engine::CreateDocxResult> {
    let _ = crate::grant_broker::require_granted(&request.project_path)?;
    crate::python_engine::create_docx(request)
}

pub fn translate_text(
    request: crate::python_engine::TranslateTextRequest,
) -> CoreResult<crate::python_engine::TranslateTextResult> {
    if let Some(ref path) = request.project_path {
        let _ = crate::grant_broker::require_granted(path)?;
    }
    crate::python_engine::translate_text(request)
}

pub fn list_translation_models(
    request: crate::python_engine::ListTranslationModelsRequest,
) -> CoreResult<crate::python_engine::ListTranslationModelsResult> {
    if let Some(ref path) = request.project_path {
        let _ = crate::grant_broker::require_granted(path)?;
    }
    crate::python_engine::list_translation_models(request)
}

pub fn extract_information(
    request: crate::python_engine::ExtractInformationRequest,
) -> CoreResult<crate::python_engine::ExtractInformationResult> {
    if let Some(ref path) = request.project_path {
        let _ = crate::grant_broker::require_granted(path)?;
    }
    crate::python_engine::extract_information(request)
}

pub fn extract_pdf_images(
    request: crate::python_engine::ExtractPdfImagesRequest,
) -> CoreResult<crate::python_engine::ExtractPdfImagesResult> {
    let _ = crate::grant_broker::require_granted(&request.project_path)?;
    crate::python_engine::execute_extract_pdf_images(request)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditProjectRequest {
    pub project_path: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetDocumentLineageRequest {
    pub project_path: String,
    pub document_id: String,
}

pub fn audit_project(
    request: AuditProjectRequest,
) -> CoreResult<crate::domain::IntegrityAuditReport> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::open(project_path)?.audit_project_integrity()
}

pub fn get_document_lineage(
    request: GetDocumentLineageRequest,
) -> CoreResult<crate::domain::DocumentLineage> {
    let project_path = crate::grant_broker::require_granted(&request.project_path)?;
    ProjectStore::open(project_path)?.get_document_lineage(&request.document_id)
}
