pub mod error;

use axum::{
    Router,
    extract::{DefaultBodyLimit, Path as AxumPath},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{get, post},
};
use error::ApiError;
use nexohub_core::{
    CoreError, ErrorCode,
    commands::{
        CreateProjectRequest, GetDocumentRequest, ImportDocumentBytesRequest,
        ImportDocumentRequest, ListArtifactsRequest, ListDocumentsRequest, OpenProjectRequest,
        ReadArtifactBytesRequest, RecordLauncherResultRequest, compress_pdf, create_project,
        execute_ocr, extract_information, get_document, import_document_bytes, inspect_docx,
        list_artifacts, list_documents, list_translation_models, open_project, organize_pdf,
        read_artifact_bytes, record_launcher_result, translate_text,
    },
    language_tool::{ReviewTextRequest, review_text},
    pdf_tools::{CompressPdfRequest, OrganizePdfRequest},
    python_engine::{
        CreateDocxRequest, ExecuteOcrRequest, ExtractInformationRequest, ExtractPdfImagesRequest,
        InspectDocxRequest, ListTranslationModelsRequest, TranslateTextRequest, create_docx,
        execute_extract_pdf_images,
    },
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
};

pub async fn health_handler() -> impl IntoResponse {
    Json(json!({
        "status": "healthy",
        "service": "nexohub-server",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": "cloud-run"
    }))
}

/// Remove sessões de trabalho temporárias inativas para evitar esgotamento de memória no Cloud Run.
pub fn cleanup_stale_sessions(max_age: Duration) {
    let temp_dir = std::env::temp_dir();
    let Ok(entries) = std::fs::read_dir(&temp_dir) else {
        return;
    };
    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let name = file_name.to_string_lossy();
        let is_target = name.starts_with("nexohub-session-")
            || name.starts_with("nexohub-web-")
            || name.starts_with("nexohub-ocr-");

        if is_target {
            let is_stale = entry
                .metadata()
                .ok()
                .and_then(|meta| meta.modified().ok())
                .and_then(|mod_time| mod_time.elapsed().ok())
                .is_some_and(|elapsed| elapsed > max_age);

            if is_stale {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }
}

/// Valida se o caminho do projeto está restrito ao diretório temporário isolado do servidor.
fn validate_server_session_path(path_str: &str) -> Result<PathBuf, ApiError> {
    if path_str.is_empty() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Caminho do projeto não pode ser vazio.",
        )
        .into());
    }
    let path = Path::new(path_str);
    let canonical = dunce::canonicalize(path).or_else(|_| {
        if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
            let canon_parent = dunce::canonicalize(parent).map_err(|_| {
                CoreError::new(ErrorCode::InvalidArgument, "Diretório pai inválido.")
            })?;
            if let Some(name) = path.file_name() {
                return Ok(canon_parent.join(name));
            }
        }
        Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Caminho inexistente ou inacessível.",
        ))
    })?;

    let temp_root = dunce::canonicalize(std::env::temp_dir()).map_err(|_| {
        CoreError::new(
            ErrorCode::StorageIo,
            "Falha ao resolver diretório temporário do sistema.",
        )
    })?;

    if !canonical.starts_with(&temp_root) {
        return Err(CoreError::new(
            ErrorCode::PermissionDenied,
            "Acesso negado: projetos no servidor devem residir estritamente no armazenamento temporário de sessão.",
        ).into());
    }

    Ok(canonical)
}

/// Despacha tarefas bloqueantes de CPU e I/O para a threadpool do Tokio.
async fn run_blocking<F, T>(f: F) -> Result<T, ApiError>
where
    F: FnOnce() -> Result<T, CoreError> + Send + 'static,
    T: Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| {
            CoreError::new(
                ErrorCode::StorageIo,
                format!("Falha de execução concorrente: {e}"),
            )
        })?
        .map_err(ApiError::from)
}

pub async fn invoke_handler(
    AxumPath(command): AxumPath<String>,
    Json(payload): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    let payload = if let Some(inner) = payload.get("request") {
        inner.clone()
    } else {
        payload
    };
    match command.as_str() {
        "health" => Ok(Json(json!({ "status": "ok" }))),
        "pick_project_folder" => {
            // Limpa sessões expiradas (> 30 minutos)
            cleanup_stale_sessions(Duration::from_secs(1800));

            let temp_dir = tempfile::Builder::new()
                .prefix("nexohub-session-")
                .tempdir()
                .map_err(|_| {
                    CoreError::new(ErrorCode::StorageIo, "Falha ao alocar sessão de trabalho.")
                })?;
            let temp_path = temp_dir.keep();
            let project_path = temp_path.join("sessao.nexohub");
            let _ = nexohub_core::grant_broker::grant_path(&temp_path)?;
            let _ = nexohub_core::grant_broker::grant_path(&project_path)?;
            let path_str = project_path.to_string_lossy().to_string();
            Ok(Json(json!({
                "path": path_str,
                "name": "Sessão Web"
            })))
        }
        "create_project" => {
            let req: CreateProjectRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            validate_server_session_path(&req.project_path)?;
            let _ = nexohub_core::grant_broker::grant_path(&req.project_path)?;
            let res = run_blocking(move || create_project(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "open_project" => {
            let req: OpenProjectRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            validate_server_session_path(&req.project_path)?;
            let _ = nexohub_core::grant_broker::grant_path(&req.project_path)?;
            let res = run_blocking(move || open_project(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "import_document" => {
            // Bloqueio rigoroso de LFI conforme ADR-014 e ADR-015
            let _req: ImportDocumentRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            Err(CoreError::new(
                ErrorCode::PermissionDenied,
                "import_document por caminho do host não é permitido no servidor web. Utilize import_document_bytes.",
            ).into())
        }
        "import_document_bytes" => {
            let req: ImportDocumentBytesRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || import_document_bytes(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "read_artifact_bytes" => {
            let req: ReadArtifactBytesRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || read_artifact_bytes(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "list_documents" => {
            let req: ListDocumentsRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || list_documents(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "get_document" => {
            let req: GetDocumentRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || get_document(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "list_artifacts" => {
            let req: ListArtifactsRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || list_artifacts(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "compress_pdf" => {
            let req: CompressPdfRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || compress_pdf(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "organize_pdf" => {
            let req: OrganizePdfRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || organize_pdf(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "record_launcher_result" => {
            let req: RecordLauncherResultRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || record_launcher_result(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "execute_ocr" => {
            let req: ExecuteOcrRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || execute_ocr(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "inspect_docx" => {
            let req: InspectDocxRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || inspect_docx(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "create_docx" => {
            let req: CreateDocxRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || create_docx(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "translate_text" => {
            let req: TranslateTextRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || translate_text(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "list_translation_models" => {
            let req: ListTranslationModelsRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || list_translation_models(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "extract_information" => {
            let req: ExtractInformationRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || extract_information(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "execute_extract_pdf_images" => {
            let req: ExtractPdfImagesRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || execute_extract_pdf_images(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "review_text" => {
            let req: ReviewTextRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || review_text(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        unknown => Err(CoreError::new(
            ErrorCode::InvalidArgument,
            format!("Comando desconhecido: {}", unknown),
        )
        .into()),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatelessCompressPdfInput {
    pub bytes: Vec<u8>,
    pub compression_level: Option<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatelessCompressPdfOutput {
    pub bytes: Vec<u8>,
    pub original_size: usize,
    pub compressed_size: usize,
}

pub async fn stateless_compress_handler(
    Json(input): Json<StatelessCompressPdfInput>,
) -> Result<Json<StatelessCompressPdfOutput>, ApiError> {
    if input.bytes.is_empty() {
        return Err(
            CoreError::new(ErrorCode::InvalidArgument, "Bytes do PDF não informados.").into(),
        );
    }

    run_blocking(move || {
        let temp_dir = tempfile::Builder::new()
            .prefix("nexohub-web-")
            .tempdir()
            .map_err(|_| {
                CoreError::new(ErrorCode::StorageIo, "Falha ao criar diretório temporário.")
            })?;
        let project_path = temp_dir.path().join("sessao.nexohub");
        let _ = nexohub_core::grant_broker::grant_path(temp_dir.path())?;
        let _ = nexohub_core::grant_broker::grant_path(&project_path)?;
        let project_str = project_path.to_string_lossy().to_string();

        create_project(CreateProjectRequest {
            project_path: project_str.clone(),
            name: "Sessao Web".to_string(),
        })?;

        let original_size = input.bytes.len();
        let imported = import_document_bytes(ImportDocumentBytesRequest {
            project_path: project_str.clone(),
            title: "documento.pdf".to_string(),
            mime_type: "application/pdf".to_string(),
            bytes: input.bytes,
        })?;

        let res = compress_pdf(CompressPdfRequest {
            project_path: project_str.clone(),
            document_id: imported.document.id,
            artifact_id: imported.artifact.id,
            compression_level: input.compression_level.unwrap_or(6),
        })?;

        let out_bytes = read_artifact_bytes(ReadArtifactBytesRequest {
            project_path: project_str,
            artifact_id: res.artifact.id,
        })?;

        Ok(StatelessCompressPdfOutput {
            compressed_size: out_bytes.len(),
            original_size,
            bytes: out_bytes,
        })
    })
    .await
    .map(Json)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatelessOcrInput {
    pub bytes: Vec<u8>,
    pub title: Option<String>,
    pub mime_type: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatelessOcrOutput {
    pub text: String,
    pub pages: usize,
    pub lines: Vec<nexohub_core::python_engine::OcrLineResult>,
}

pub async fn stateless_ocr_handler(
    Json(input): Json<StatelessOcrInput>,
) -> Result<Json<StatelessOcrOutput>, ApiError> {
    if input.bytes.is_empty() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Bytes do documento não informados.",
        )
        .into());
    }

    run_blocking(move || {
        let temp_dir = tempfile::Builder::new()
            .prefix("nexohub-ocr-")
            .tempdir()
            .map_err(|_| {
                CoreError::new(ErrorCode::StorageIo, "Falha ao criar diretório temporário.")
            })?;
        let project_path = temp_dir.path().join("sessao.nexohub");
        let _ = nexohub_core::grant_broker::grant_path(temp_dir.path())?;
        let _ = nexohub_core::grant_broker::grant_path(&project_path)?;
        let project_str = project_path.to_string_lossy().to_string();

        create_project(CreateProjectRequest {
            project_path: project_str.clone(),
            name: "Sessao OCR".to_string(),
        })?;

        let imported = import_document_bytes(ImportDocumentBytesRequest {
            project_path: project_str.clone(),
            title: input.title.unwrap_or_else(|| "documento".to_string()),
            mime_type: input
                .mime_type
                .unwrap_or_else(|| "application/pdf".to_string()),
            bytes: input.bytes,
        })?;

        let res = execute_ocr(ExecuteOcrRequest {
            project_path: project_str,
            document_id: imported.document.id,
            artifact_id: imported.artifact.id,
        })?;

        Ok(StatelessOcrOutput {
            text: res.text,
            pages: res.pages,
            lines: res.lines,
        })
    })
    .await
    .map(Json)
}

pub fn create_app(static_dir: Option<PathBuf>) -> Router {
    let api_routes = Router::new()
        .route("/health", get(health_handler))
        .route("/invoke/{command}", post(invoke_handler))
        .route("/tools/compress_pdf", post(stateless_compress_handler))
        .route("/tools/ocr", post(stateless_ocr_handler));

    let app = Router::new()
        .nest("/api/v1", api_routes)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    if let Some(dir) = static_dir.filter(|d| d.exists()) {
        let index_file = dir.join("index.html");
        let serve_dir = ServeDir::new(&dir).fallback(ServeFile::new(index_file));
        return app.fallback_service(serve_dir);
    }

    app.fallback(|| async {
        (
            StatusCode::NOT_FOUND,
            "NexoHub Server: Rota não encontrada.",
        )
    })
}
