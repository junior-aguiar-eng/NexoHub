use nexohub_core::CoreError;
use nexohub_core::anchor_tools::{CreateAnchorRequest, ListAnchorsRequest};
use nexohub_core::commands::{
    CreateProjectRequest, GetDocumentRequest, ImportDocumentRequest, ListArtifactsRequest,
    ListDocumentsRequest, OpenProjectRequest,
};
use nexohub_core::domain::{Anchor, Artifact, Document, ImportedDocument, Overlay, Project};
use nexohub_core::language_tool::{ReviewTextRequest, ReviewTextResult};
use nexohub_core::overlay_tools::{CreatePdfOverlayRequest, ListPdfOverlaysRequest};
use nexohub_core::pdf_tools::{CompressPdfRequest, OrganizePdfRequest, PdfToolResult};
use nexohub_core::text_tools::{CreateTextRevisionRequest, TextToolResult};
use serde::{Deserialize, Serialize};
use tauri::{Manager, path::BaseDirectory};

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
fn organize_pdf(request: OrganizePdfRequest) -> Result<PdfToolResult, CoreError> {
    nexohub_core::commands::organize_pdf(request)
}

#[tauri::command]
fn create_text_revision(request: CreateTextRevisionRequest) -> Result<TextToolResult, CoreError> {
    nexohub_core::commands::create_text_revision(request)
}

#[tauri::command]
fn review_text(request: ReviewTextRequest) -> Result<ReviewTextResult, CoreError> {
    nexohub_core::language_tool::review_text(request)
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

#[tauri::command]
fn execute_ocr(
    request: nexohub_core::python_engine::ExecuteOcrRequest,
) -> Result<nexohub_core::python_engine::OcrToolResult, CoreError> {
    nexohub_core::commands::execute_ocr(request)
}

#[tauri::command]
fn inspect_docx(
    request: nexohub_core::python_engine::InspectDocxRequest,
) -> Result<nexohub_core::python_engine::DocxInspectionResult, CoreError> {
    nexohub_core::commands::inspect_docx(request)
}

#[tauri::command]
fn create_docx(
    request: nexohub_core::python_engine::CreateDocxRequest,
) -> Result<nexohub_core::python_engine::CreateDocxResult, CoreError> {
    nexohub_core::commands::create_docx(request)
}

#[tauri::command]
fn translate_text(
    request: nexohub_core::python_engine::TranslateTextRequest,
) -> Result<nexohub_core::python_engine::TranslateTextResult, CoreError> {
    nexohub_core::commands::translate_text(request)
}

#[tauri::command]
fn list_translation_models(
    request: nexohub_core::python_engine::ListTranslationModelsRequest,
) -> Result<nexohub_core::python_engine::ListTranslationModelsResult, CoreError> {
    nexohub_core::commands::list_translation_models(request)
}

#[tauri::command]
fn extract_information(
    request: nexohub_core::python_engine::ExtractInformationRequest,
) -> Result<nexohub_core::python_engine::ExtractInformationResult, CoreError> {
    nexohub_core::commands::extract_information(request)
}

#[tauri::command]
fn extract_pdf_images(
    request: nexohub_core::python_engine::ExtractPdfImagesRequest,
) -> Result<nexohub_core::python_engine::ExtractPdfImagesResult, CoreError> {
    nexohub_core::commands::extract_pdf_images(request)
}

#[tauri::command]
fn audit_project(
    request: nexohub_core::commands::AuditProjectRequest,
) -> Result<nexohub_core::domain::IntegrityAuditReport, CoreError> {
    nexohub_core::commands::audit_project(request)
}

#[tauri::command]
fn get_document_lineage(
    request: nexohub_core::commands::GetDocumentLineageRequest,
) -> Result<nexohub_core::domain::DocumentLineage, CoreError> {
    nexohub_core::commands::get_document_lineage(request)
}

#[tauri::command]
fn list_capabilities(
    request: nexohub_core::capabilities::ListCapabilitiesRequest,
) -> Result<nexohub_core::capabilities::ListCapabilitiesResult, CoreError> {
    nexohub_core::capabilities::list_capabilities(request)
}

#[tauri::command]
fn install_capability(
    request: nexohub_core::capabilities::InstallCapabilityRequest,
) -> Result<nexohub_core::capabilities::InstallCapabilityResult, CoreError> {
    nexohub_core::capabilities::install_capability(request)
}

#[tauri::command]
fn cancel_capability_download(
    request: nexohub_core::capabilities::CancelCapabilityDownloadRequest,
) -> Result<nexohub_core::capabilities::CancelCapabilityDownloadResult, CoreError> {
    nexohub_core::capabilities::cancel_capability_download(request)
}

#[tauri::command]
fn uninstall_capability(
    request: nexohub_core::capabilities::UninstallCapabilityRequest,
) -> Result<nexohub_core::capabilities::UninstallCapabilityResult, CoreError> {
    nexohub_core::capabilities::uninstall_capability(request)
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PickProjectFolderRequest {
    default_path: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PickProjectFolderResult {
    path: String,
    name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PickDocumentFileRequest {
    default_path: Option<String>,
    mime_types: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
struct PickDocumentFileResult {
    path: String,
    name: String,
    mime_type: String,
}

#[tauri::command]
fn pick_project_folder(
    app: tauri::AppHandle,
    request: PickProjectFolderRequest,
) -> Result<Option<PickProjectFolderResult>, CoreError> {
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(ref default) = request.default_path {
        builder = builder.set_directory(default);
    }
    let folder = builder.blocking_pick_folder();
    if let Some(path) = folder {
        let path_buf = path.as_path().ok_or_else(|| {
            CoreError::new(
                nexohub_core::ErrorCode::InvalidArgument,
                "Caminho inválido.",
            )
        })?;
        let granted = nexohub_core::grant_broker::grant_path(path_buf)?;
        let name = granted
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Projeto".to_string());
        Ok(Some(PickProjectFolderResult {
            path: granted.to_string_lossy().to_string(),
            name,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn pick_document_file(
    app: tauri::AppHandle,
    request: PickDocumentFileRequest,
) -> Result<Option<PickDocumentFileResult>, CoreError> {
    use tauri_plugin_dialog::DialogExt;
    let mut builder = app.dialog().file();
    if let Some(ref default) = request.default_path {
        builder = builder.set_directory(default);
    }
    builder = builder.add_filter(
        "Documentos",
        &["pdf", "docx", "txt", "md", "png", "jpg", "jpeg"],
    );
    let file = builder.blocking_pick_file();
    if let Some(path) = file {
        let path_buf = path.as_path().ok_or_else(|| {
            CoreError::new(
                nexohub_core::ErrorCode::InvalidArgument,
                "Caminho inválido.",
            )
        })?;
        let granted = nexohub_core::grant_broker::grant_path(path_buf)?;
        let name = granted
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Documento".to_string());
        let ext = granted
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let mime_type = match ext.as_str() {
            "pdf" => "application/pdf",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "txt" => "text/plain",
            "md" => "text/markdown",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            _ => "application/octet-stream",
        }
        .to_string();

        Ok(Some(PickDocumentFileResult {
            path: granted.to_string_lossy().to_string(),
            name,
            mime_type,
        }))
    } else {
        Ok(None)
    }
}

fn normalize_path(path: &std::path::Path) -> std::path::PathBuf {
    if let Ok(canonical) = std::fs::canonicalize(path) {
        let s = canonical.to_string_lossy();
        if let Some(stripped) = s.strip_prefix(r"\\?\") {
            return std::path::PathBuf::from(stripped);
        }
        canonical
    } else {
        path.to_path_buf()
    }
}

fn auto_configure_local_runtimes(app: &tauri::App) {
    // 1. LanguageTool Community
    let mut lt_root = app
        .path()
        .resolve("runtime/languagetool", BaseDirectory::Resource)
        .ok()
        .filter(|p| p.is_dir());

    if lt_root.is_none() {
        let candidates = [
            std::path::Path::new("runtime/languagetool"),
            std::path::Path::new("../../../runtime/languagetool"),
            std::path::Path::new("../../runtime/languagetool"),
        ];
        for candidate in candidates {
            if candidate.is_dir() {
                lt_root = Some(normalize_path(candidate));
                break;
            }
        }
    }
    if let Some(root) = lt_root {
        nexohub_core::language_tool::configure_installation_root(root);
    }

    // 2. Modelos de Tradução (CTranslate2)
    if std::env::var_os("NEXOHUB_TRANSLATION_MODELS_DIR").is_none() {
        let candidates = [
            std::path::Path::new("runtime/models"),
            std::path::Path::new("../../../runtime/models"),
            std::path::Path::new("../../runtime/models"),
        ];
        for candidate in candidates {
            if candidate.is_dir() {
                let normalized = normalize_path(candidate);
                unsafe {
                    std::env::set_var("NEXOHUB_TRANSLATION_MODELS_DIR", normalized);
                }
                break;
            }
        }
    }

    // 3. Executável Python do Ambiente Virtual
    if std::env::var_os("NEXOHUB_PYTHON_EXECUTABLE").is_none() {
        let candidates = [
            "engines/python/.venv/Scripts/python.exe",
            "../../../engines/python/.venv/Scripts/python.exe",
            "../../engines/python/.venv/Scripts/python.exe",
            "engines/python/.venv/bin/python",
            "../../../engines/python/.venv/bin/python",
        ];
        for candidate in candidates {
            let path = std::path::Path::new(candidate);
            if path.is_file() {
                let normalized = normalize_path(path);
                nexohub_core::python_engine::configure_python_executable(normalized);
                break;
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            auto_configure_local_runtimes(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            create_project,
            open_project,
            import_document,
            list_documents,
            get_document,
            list_artifacts,
            compress_pdf,
            organize_pdf,
            create_text_revision,
            review_text,
            create_pdf_overlay,
            list_pdf_overlays,
            create_anchor,
            list_anchors,
            pick_project_folder,
            pick_document_file,
            execute_ocr,
            inspect_docx,
            create_docx,
            translate_text,
            list_translation_models,
            extract_information,
            extract_pdf_images,
            audit_project,
            get_document_lineage,
            list_capabilities,
            install_capability,
            cancel_capability_download,
            uninstall_capability
        ])
        .run(tauri::generate_context!())
        .expect("não foi possível executar o shell desktop do NexoHub");
}
