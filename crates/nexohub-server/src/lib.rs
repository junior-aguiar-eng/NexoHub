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
        execute_ocr, extract_information, get_document, import_document, import_document_bytes,
        inspect_docx, list_artifacts, list_documents, list_translation_models, open_project,
        organize_pdf, read_artifact_bytes, record_launcher_result, translate_text,
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
            let temp_dir = tempfile::Builder::new()
                .prefix("nexohub-session-")
                .tempdir()
                .map_err(|_| {
                    CoreError::new(ErrorCode::StorageIo, "Falha ao alocar sessão de trabalho.")
                })?;
            let project_path = temp_dir.path().join("sessao.nexohub");
            let _ = nexohub_core::grant_broker::grant_path(temp_dir.path())?;
            let _ = nexohub_core::grant_broker::grant_path(&project_path)?;
            let path_str = project_path.to_string_lossy().to_string();
            std::mem::forget(temp_dir);
            Ok(Json(json!({
                "path": path_str,
                "name": "Sessão Web"
            })))
        }
        "create_project" => {
            let req: CreateProjectRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let _ = nexohub_core::grant_broker::grant_path(&req.project_path)?;
            let res = create_project(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "open_project" => {
            let req: OpenProjectRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let _ = nexohub_core::grant_broker::grant_path(&req.project_path)?;
            let res = open_project(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "import_document" => {
            let req: ImportDocumentRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let _ = nexohub_core::grant_broker::grant_path(&req.source_path)?;
            let res = import_document(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "import_document_bytes" => {
            let req: ImportDocumentBytesRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = import_document_bytes(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "read_artifact_bytes" => {
            let req: ReadArtifactBytesRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = read_artifact_bytes(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "list_documents" => {
            let req: ListDocumentsRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = list_documents(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "get_document" => {
            let req: GetDocumentRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = get_document(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "list_artifacts" => {
            let req: ListArtifactsRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = list_artifacts(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "compress_pdf" => {
            let req: CompressPdfRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = compress_pdf(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "organize_pdf" => {
            let req: OrganizePdfRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = organize_pdf(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "record_launcher_result" => {
            let req: RecordLauncherResultRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = record_launcher_result(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "execute_ocr" => {
            let req: ExecuteOcrRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = execute_ocr(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "inspect_docx" => {
            let req: InspectDocxRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = inspect_docx(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "create_docx" => {
            let req: CreateDocxRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = create_docx(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "translate_text" => {
            let req: TranslateTextRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = translate_text(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "list_translation_models" => {
            let req: ListTranslationModelsRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = list_translation_models(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "extract_information" => {
            let req: ExtractInformationRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = extract_information(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "execute_extract_pdf_images" => {
            let req: ExtractPdfImagesRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = execute_extract_pdf_images(req)?;
            Ok(Json(serde_json::to_value(res).map_err(|e| {
                CoreError::new(ErrorCode::InvalidArgument, e.to_string())
            })?))
        }
        "review_text" => {
            let req: ReviewTextRequest = serde_json::from_value(payload)
                .map_err(|e| CoreError::new(ErrorCode::InvalidArgument, e.to_string()))?;
            let res = review_text(req)?;
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

    Ok(Json(StatelessCompressPdfOutput {
        compressed_size: out_bytes.len(),
        original_size,
        bytes: out_bytes,
    }))
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

    Ok(Json(StatelessOcrOutput {
        text: res.text,
        pages: res.pages,
        lines: res.lines,
    }))
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
