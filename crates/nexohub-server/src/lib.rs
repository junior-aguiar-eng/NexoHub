pub mod cloud;
pub mod error;
mod sessions;

use axum::{
    Router,
    extract::{DefaultBodyLimit, Path as AxumPath, State},
    http::{HeaderMap, HeaderValue, StatusCode, header},
    response::{IntoResponse, Json, Response},
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
use sessions::{SESSION_HEADER, Sessions};
use std::path::PathBuf;
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

async fn invoke_handler(
    State(sessions): State<Sessions>,
    headers: HeaderMap,
    AxumPath(command): AxumPath<String>,
    Json(payload): Json<Value>,
) -> Result<Response, ApiError> {
    let payload = payload.get("request").cloned().unwrap_or(payload);
    if command == "pick_project_folder" {
        let (token, session) = run_blocking(move || sessions.allocate()).await?;
        let mut response = Json(json!({
            "path": session.project_path.to_string_lossy(),
            "name": "Sessão Web"
        }))
        .into_response();
        response.headers_mut().insert(
            SESSION_HEADER,
            HeaderValue::from_str(&token)
                .map_err(|_| CoreError::new(ErrorCode::StorageIo, "Falha ao alocar sessão."))?,
        );
        response
            .headers_mut()
            .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
        return Ok(response);
    }
    // Todos os comandos, inclusive os com contexto opcional, passam pela mesma barreira.
    let _session = if let Some(path) = payload.get("projectPath").filter(|path| !path.is_null()) {
        let path = path
            .as_str()
            .ok_or_else(|| {
                CoreError::new(ErrorCode::InvalidArgument, "Caminho do projeto inválido.")
            })?
            .to_owned();
        let token = headers
            .get(header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.strip_prefix("Bearer "))
            .ok_or_else(|| {
                CoreError::new(ErrorCode::PermissionDenied, "Credencial de sessão ausente.")
            })?
            .to_owned();
        Some(run_blocking(move || sessions.authorize(&token, &path)).await?)
    } else {
        None
    };
    dispatch_command(command, payload)
        .await
        .map(IntoResponse::into_response)
}

async fn dispatch_command(command: String, payload: Value) -> Result<Json<Value>, ApiError> {
    match command.as_str() {
        "health" => Ok(Json(json!({ "status": "ok" }))),
        "create_project" => {
            let req: CreateProjectRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = run_blocking(move || create_project(req)).await?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "open_project" => {
            let req: OpenProjectRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
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
    create_app_with_identity(static_dir, None)
}

pub fn create_app_with_identity(
    static_dir: Option<PathBuf>,
    identity: Option<std::sync::Arc<cloud::routes::CloudIdentityServices>>,
) -> Router {
    let api_routes = Router::new()
        .route("/health", get(health_handler))
        .route("/invoke/{command}", post(invoke_handler))
        .with_state(Sessions::default())
        .route("/tools/compress_pdf", post(stateless_compress_handler))
        .route("/tools/ocr", post(stateless_ocr_handler));

    let app = Router::new()
        .nest("/api/v1", api_routes)
        .nest("/api/v1/cloud", cloud::routes::router(identity))
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
                .expose_headers([header::HeaderName::from_static(SESSION_HEADER)]),
        );

    if let Some(dir) = static_dir.filter(|d| d.exists()) {
        let index_file = dir.join("index.html");
        let serve_dir = ServeDir::new(&dir).fallback(ServeFile::new(index_file));
        let root = app.fallback_service(serve_dir);
        // O balanceador público remove /hub; a URL da revisão acessa o mesmo prefixo diretamente.
        return Router::new().nest("/hub", root.clone()).merge(root);
    }

    app.fallback(|| async {
        (
            StatusCode::NOT_FOUND,
            "NexoHub Server: Rota não encontrada.",
        )
    })
}
