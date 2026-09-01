use nexohub_core::CoreError;
use nexohub_core::commands::{
    CreateProjectRequest, GetDocumentRequest, ImportDocumentRequest, ListArtifactsRequest,
    ListDocumentsRequest, OpenProjectRequest,
};
use nexohub_core::domain::{Artifact, Document, ImportedDocument, Project};
use nexohub_core::pdf_tools::{CompressPdfRequest, PdfToolResult};

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
            compress_pdf
        ])
        .run(tauri::generate_context!())
        .expect("não foi possível executar o shell desktop do NexoHub");
}
