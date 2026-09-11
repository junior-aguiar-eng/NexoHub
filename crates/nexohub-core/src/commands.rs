//! Contratos estruturados para a porta IPC do desktop.

use crate::anchor_tools::{CreateAnchorRequest, ListAnchorsRequest};
use crate::domain::{Anchor, Overlay};
use crate::domain::{Artifact, Document, ImportedDocument, Project};
use crate::error::CoreResult;
use crate::overlay_tools::{CreatePdfOverlayRequest, ListPdfOverlaysRequest};
use crate::pdf_tools::{CompressPdfRequest, OrganizePdfRequest, PdfToolResult};
use crate::storage::ProjectStore;
use crate::text_tools::{CreateTextRevisionRequest, TextToolResult};
use serde::{Deserialize, Serialize};

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
    crate::pdf_tools::compress_pdf(request)
}

pub fn organize_pdf(request: OrganizePdfRequest) -> CoreResult<PdfToolResult> {
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
