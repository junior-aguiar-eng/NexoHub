//! Contratos estruturados para a porta IPC do desktop.

use crate::domain::{Artifact, Document, ImportedDocument, Project};
use crate::error::CoreResult;
use crate::pdf_tools::{CompressPdfRequest, PdfToolResult};
use crate::storage::ProjectStore;
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
    ProjectStore::create(request.project_path, &request.name)?.project()
}

pub fn open_project(request: OpenProjectRequest) -> CoreResult<Project> {
    ProjectStore::open(request.project_path)?.project()
}

pub fn import_document(request: ImportDocumentRequest) -> CoreResult<ImportedDocument> {
    ProjectStore::open(&request.project_path)?.import_document(
        request.source_path,
        request.title.as_deref(),
        &request.mime_type,
    )
}

pub fn list_documents(request: ListDocumentsRequest) -> CoreResult<Vec<Document>> {
    ProjectStore::open(request.project_path)?.list_documents()
}

pub fn get_document(request: GetDocumentRequest) -> CoreResult<Document> {
    ProjectStore::open(request.project_path)?.get_document(&request.document_id)
}

pub fn list_artifacts(request: ListArtifactsRequest) -> CoreResult<Vec<Artifact>> {
    ProjectStore::open(request.project_path)?.list_artifacts(&request.document_id)
}

pub fn compress_pdf(request: CompressPdfRequest) -> CoreResult<PdfToolResult> {
    crate::pdf_tools::compress_pdf(request)
}
