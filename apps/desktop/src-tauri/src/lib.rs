use nexohub_core::CoreError;
use nexohub_core::anchor_tools::{CreateAnchorRequest, ListAnchorsRequest};
use nexohub_core::commands::{
    CreateProjectRequest, GetDocumentRequest, ImportDocumentRequest, ListArtifactsRequest,
    ListDocumentsRequest, OpenProjectRequest,
};
use nexohub_core::domain::{Anchor, Artifact, Document, ImportedDocument, Overlay, Project};
use nexohub_core::overlay_tools::{CreatePdfOverlayRequest, ListPdfOverlaysRequest};
use nexohub_core::pdf_tools::{CompressPdfRequest, PdfToolResult};
use nexohub_core::text_tools::{CreateTextRevisionRequest, TextToolResult};

#[tauri::command]
fn create_project(request: CreateProjectRequest) -> Result<Project, CoreError> {
    nexohub_core::commands::create_project(request)
}

#[tauri::command]
fn open_project(request: OpenProjectRequest) -> Result<Project, CoreError> {
    nexohub_core::commands::open_project(request)
}

#[tauri::command]
fn import_document(request: ImportDocumentRequest) -> Result<ImportedDocument, CoreError> {
    nexohub_core::commands::import_document(request)
}

#[tauri::command]
fn list_documents(request: ListDocumentsRequest) -> Result<Vec<Document>, CoreError> {
    nexohub_core::commands::list_documents(request)
}

#[tauri::command]
fn get_document(request: GetDocumentRequest) -> Result<Document, CoreError> {
    nexohub_core::commands::get_document(request)
}

#[tauri::command]
fn list_artifacts(request: ListArtifactsRequest) -> Result<Vec<Artifact>, CoreError> {
    nexohub_core::commands::list_artifacts(request)
}

#[tauri::command]
fn compress_pdf(request: CompressPdfRequest) -> Result<PdfToolResult, CoreError> {
    nexohub_core::commands::compress_pdf(request)
}

#[tauri::command]
fn create_text_revision(request: CreateTextRevisionRequest) -> Result<TextToolResult, CoreError> {
    nexohub_core::commands::create_text_revision(request)
}

#[tauri::command]
fn create_pdf_overlay(request: CreatePdfOverlayRequest) -> Result<Overlay, CoreError> {
    nexohub_core::commands::create_pdf_overlay(request)
}

#[tauri::command]
fn list_pdf_overlays(request: ListPdfOverlaysRequest) -> Result<Vec<Overlay>, CoreError> {
    nexohub_core::commands::list_pdf_overlays(request)
}

#[tauri::command]
fn create_anchor(request: CreateAnchorRequest) -> Result<Anchor, CoreError> {
    nexohub_core::commands::create_anchor(request)
}

#[tauri::command]
fn list_anchors(request: ListAnchorsRequest) -> Result<Vec<Anchor>, CoreError> {
    nexohub_core::commands::list_anchors(request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            create_project,
            open_project,
            import_document,
            list_documents,
            get_document,
            list_artifacts,
            compress_pdf,
            create_text_revision,
            create_pdf_overlay,
            list_pdf_overlays,
            create_anchor,
            list_anchors
        ])
        .run(tauri::generate_context!())
        .expect("não foi possível executar o shell desktop do NexoHub");
}
