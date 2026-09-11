//! Ponte com o sidecar Python do NexoHub para OCR, DOCX e Tradução Local.

use crate::domain::{Artifact, Operation};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::hardening::HardeningLimits;
use crate::sidecar::{SensitiveTempDir, SidecarRunError, run_command_with_stdin};
use crate::storage::ProjectStore;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;
use uuid::Uuid;

static PYTHON_EXECUTABLE: OnceLock<PathBuf> = OnceLock::new();

pub fn configure_python_executable(path: PathBuf) {
    let _ = PYTHON_EXECUTABLE.set(path);
}

const BASE64_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn base64_encode(bytes: &[u8]) -> String {
    let mut result = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = if chunk.len() > 1 { chunk[1] } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] } else { 0 };

        result.push(BASE64_ALPHABET[(b0 >> 2) as usize] as char);
        result.push(BASE64_ALPHABET[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            result.push(BASE64_ALPHABET[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(BASE64_ALPHABET[(b2 & 0x3f) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

pub fn base64_decode(input: &str) -> Option<Vec<u8>> {
    let mut table = [255u8; 256];
    for (i, &b) in BASE64_ALPHABET.iter().enumerate() {
        table[b as usize] = i as u8;
    }
    let clean: Vec<u8> = input.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    if !clean.len().is_multiple_of(4) {
        return None;
    }
    let mut output = Vec::with_capacity(clean.len() / 4 * 3);
    for chunk in clean.as_chunks::<4>().0 {
        let n0 = table[chunk[0] as usize];
        let n1 = table[chunk[1] as usize];
        if n0 == 255 || n1 == 255 {
            return None;
        }
        output.push((n0 << 2) | (n1 >> 4));
        if chunk[2] != b'=' {
            let n2 = table[chunk[2] as usize];
            if n2 == 255 {
                return None;
            }
            output.push(((n1 & 0x0f) << 4) | (n2 >> 2));
            if chunk[3] != b'=' {
                let n3 = table[chunk[3] as usize];
                if n3 == 255 {
                    return None;
                }
                output.push(((n2 & 0x03) << 6) | n3);
            }
        }
    }
    Some(output)
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteOcrRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLineResult {
    pub page_number: usize,
    pub text: String,
    pub confidence: f64,
    pub bounds: (f64, f64, f64, f64),
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrToolResult {
    pub text: String,
    pub pages: usize,
    pub lines: Vec<OcrLineResult>,
    pub engine: String,
    pub artifact: Artifact,
    pub operation: Operation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectDocxRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocxParagraphResult {
    pub text: String,
    pub style: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocxInspectionResult {
    pub paragraphs: Vec<DocxParagraphResult>,
    pub tables: Vec<Vec<Vec<String>>>,
    pub title: Option<String>,
}

fn default_docx_style() -> String {
    "Normal".to_string()
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocxParagraphInput {
    pub text: String,
    #[serde(default = "default_docx_style")]
    pub style: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractPdfImagesRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedImageItem {
    pub page_number: usize,
    pub image_index: usize,
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub size_bytes: usize,
    pub content_base64: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractPdfImagesResult {
    pub total_images: usize,
    pub images: Vec<ExtractedImageItem>,
    pub artifact: Artifact,
    pub operation: Operation,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocxRequest {
    pub project_path: String,
    pub document_id: Option<String>,
    pub name: String,
    pub title: Option<String>,
    #[serde(default)]
    pub paragraphs: Vec<DocxParagraphInput>,
    #[serde(default)]
    pub tables: Vec<Vec<Vec<String>>>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocxResult {
    pub artifact: Artifact,
    pub operation: Option<Operation>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationModelInfo {
    pub model_id: String,
    pub name: String,
    pub family: String,
    pub source_languages: Vec<String>,
    pub target_languages: Vec<String>,
    pub license: String,
    pub is_ready: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ListTranslationModelsRequest {
    pub project_path: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTranslationModelsResult {
    pub models: Vec<TranslationModelInfo>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateTextRequest {
    pub text: String,
    pub source_language: Option<String>,
    pub target_language: String,
    pub model_id: Option<String>,
    pub project_path: Option<String>,
    pub document_id: Option<String>,
    pub artifact_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateTextResult {
    pub text: String,
    pub source_language: String,
    pub target_language: String,
    pub model_id: String,
    pub segments: usize,
    pub artifact: Option<Artifact>,
    pub operation: Option<Operation>,
}

fn resolve_python() -> Option<PathBuf> {
    if let Some(path) = env::var_os("NEXOHUB_PYTHON_EXECUTABLE")
        .map(PathBuf::from)
        .filter(|p| p.is_file())
    {
        return Some(path);
    }
    if let Some(path) = PYTHON_EXECUTABLE.get().cloned().filter(|p| p.is_file()) {
        return Some(path);
    }
    let candidates = [
        "engines/python/.venv/Scripts/python.exe",
        "engines/python/.venv/bin/python",
        "../engines/python/.venv/Scripts/python.exe",
        "../../engines/python/.venv/Scripts/python.exe",
        "../../../engines/python/.venv/Scripts/python.exe",
    ];
    for candidate in candidates {
        let p = PathBuf::from(candidate);
        if p.is_file() {
            return Some(p);
        }
    }
    // Tenta python no PATH
    #[cfg(windows)]
    let check_cmd = Command::new("where.exe").arg("python.exe").output();
    #[cfg(not(windows))]
    let check_cmd = Command::new("which").arg("python3").output();

    check_cmd
        .ok()
        .filter(|output| output.status.success())
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|text| text.lines().next().map(|l| PathBuf::from(l.trim())))
        .filter(|p| p.is_file())
}

fn invoke_sidecar(method: &str, params: serde_json::Value) -> CoreResult<serde_json::Value> {
    let python_exe = resolve_python().ok_or_else(|| {
        CoreError::new(
            ErrorCode::ReviewUnavailable,
            "Ambiente Python local do NexoHub não encontrado. Execute 'uv sync --project engines/python'.",
        )
    })?;

    let limits = HardeningLimits::from_env()?;
    let workspace = SensitiveTempDir::create().map_err(|_| CoreError::io())?;
    let request_id = Uuid::new_v4().to_string();
    let request_payload = json!({
        "id": request_id,
        "method": method,
        "params": params,
    });
    let request_line = format!(
        "{}\n",
        serde_json::to_string(&request_payload).map_err(|_| CoreError::io())?
    );
    let input_path = workspace
        .write_private("input.jsonl", request_line.as_bytes())
        .map_err(|_| CoreError::io())?;
    let output_path = workspace.path("output.jsonl");

    let mut command = Command::new(&python_exe);
    command.args(["-m", "nexohub_document_engine"]);

    // Garante que o diretório engines/python/src esteja no PYTHONPATH
    let mut pythonpath = env::var("PYTHONPATH").unwrap_or_default();
    let src_dir = Path::new("engines/python/src");
    if src_dir.exists() {
        if !pythonpath.is_empty() {
            pythonpath.push(';');
        }
        pythonpath.push_str(src_dir.to_str().unwrap_or(""));
        command.env("PYTHONPATH", pythonpath);
    }
    command.env("PYTHONIOENCODING", "utf-8");
    command.env("PYTHONUTF8", "1");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }

    let raw_output = run_command_with_stdin(
        &mut command,
        Some(&input_path),
        &output_path,
        limits.sidecar_timeout,
        limits.max_sidecar_output_bytes,
    )
    .map_err(|err| match err {
        SidecarRunError::Timeout => CoreError::new(
            ErrorCode::SidecarTimeout,
            "O processamento no sidecar Python excedeu o tempo limite configurado.",
        ),
        SidecarRunError::OutputLimit => CoreError::new(
            ErrorCode::ResourceLimit,
            "A resposta do sidecar Python excedeu o limite máximo de bytes permitido.",
        ),
        SidecarRunError::Exit => CoreError::new(
            ErrorCode::ReviewProcessing,
            "O sidecar Python foi encerrado inesperadamente com código de erro.",
        ),
        SidecarRunError::Io => CoreError::new(
            ErrorCode::StorageIo,
            "Não foi possível iniciar ou comunicar com o processo do sidecar Python.",
        ),
    })?;

    let text = String::from_utf8_lossy(&raw_output);
    let mut parsed_response = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed
            .strip_prefix('{')
            .and_then(|_| serde_json::from_str::<serde_json::Value>(trimmed).ok())
        {
            parsed_response = Some(val);
            break;
        }
    }
    let response = parsed_response.ok_or_else(|| {
        CoreError::new(
            ErrorCode::ReviewProcessing,
            format!(
                "A resposta do sidecar Python não formou JSON válido: {}",
                text
            ),
        )
    })?;

    if let Some(err) = response.get("error") {
        let code_str = err
            .get("code")
            .and_then(|c| c.as_str())
            .unwrap_or("UNKNOWN");
        let msg_str = err
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Erro desconhecido no engine local.");
        let code = match code_str {
            "INVALID_INPUT" | "INVALID_REQUEST" => ErrorCode::InvalidArgument,
            "REQUEST_TOO_LARGE" | "RESPONSE_TOO_LARGE" => ErrorCode::ResourceLimit,
            "TRANSLATION_UNAVAILABLE" => ErrorCode::ReviewUnavailable,
            _ => ErrorCode::ReviewProcessing,
        };
        return Err(CoreError::new(code, msg_str));
    }

    response
        .get("result")
        .cloned()
        .ok_or_else(|| CoreError::new(ErrorCode::ReviewProcessing, "Resposta sem campo result."))
}

pub fn execute_ocr(request: ExecuteOcrRequest) -> CoreResult<OcrToolResult> {
    let mut store = ProjectStore::open(&request.project_path)?;
    let input_artifact = store.get_artifact(&request.artifact_id)?;
    if input_artifact.document_id != request.document_id {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O artifact de entrada não pertence ao documento informado.",
        ));
    }

    let source_bytes = store.read_artifact_bytes(&request.artifact_id)?;
    let content_b64 = base64_encode(&source_bytes);

    let result_json = invoke_sidecar(
        "ocr",
        json!({
            "mimeType": input_artifact.mime_type,
            "contentBase64": content_b64,
        }),
    )?;

    let text = result_json
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or_default()
        .to_string();
    let pages = result_json
        .get("pages")
        .and_then(|p| p.as_u64())
        .unwrap_or(1) as usize;
    let engine = result_json
        .get("engine")
        .and_then(|e| e.as_str())
        .unwrap_or("rapidocr")
        .to_string();

    let mut lines = Vec::new();
    if let Some(raw_lines) = result_json.get("lines").and_then(|l| l.as_array()) {
        for l in raw_lines {
            let page_number = l.get("page_number").and_then(|p| p.as_u64()).unwrap_or(1) as usize;
            let line_text = l
                .get("text")
                .and_then(|t| t.as_str())
                .unwrap_or("")
                .to_string();
            let confidence = l.get("confidence").and_then(|c| c.as_f64()).unwrap_or(1.0);
            let bounds = if let Some(b) = l.get("bounds").and_then(|b| b.as_array()) {
                if b.len() == 4 {
                    (
                        b[0].as_f64().unwrap_or(0.0),
                        b[1].as_f64().unwrap_or(0.0),
                        b[2].as_f64().unwrap_or(0.0),
                        b[3].as_f64().unwrap_or(0.0),
                    )
                } else {
                    (0.0, 0.0, 0.0, 0.0)
                }
            } else {
                (0.0, 0.0, 0.0, 0.0)
            };
            lines.push(OcrLineResult {
                page_number,
                text: line_text,
                confidence,
                bounds,
            });
        }
    }

    let (derived_artifact, operation) = store.create_derived_artifact(
        &request.document_id,
        &request.artifact_id,
        "text/plain",
        text.as_bytes(),
        "pdf-ocr",
        json!({
            "engine": engine,
            "pages": pages,
            "linesCount": lines.len(),
        }),
    )?;

    Ok(OcrToolResult {
        text,
        pages,
        lines,
        engine,
        artifact: derived_artifact,
        operation,
    })
}

pub fn execute_extract_pdf_images(
    request: ExtractPdfImagesRequest,
) -> CoreResult<ExtractPdfImagesResult> {
    let mut store = ProjectStore::open(&request.project_path)?;
    let input_artifact = store.get_artifact(&request.artifact_id)?;
    if input_artifact.document_id != request.document_id {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Artifact não pertence ao documento especificado.",
        ));
    }
    if input_artifact.mime_type != "application/pdf" {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Extração de imagens requer um artifact PDF.",
        ));
    }

    let source_bytes = store.read_artifact_bytes(&request.artifact_id)?;
    let content_b64 = base64_encode(&source_bytes);

    let result_json = invoke_sidecar(
        "pdf.extract_images",
        json!({
            "contentBase64": content_b64,
        }),
    )?;

    let total_images = result_json
        .get("totalImages")
        .and_then(|t| t.as_u64())
        .unwrap_or(0) as usize;

    let zip_b64 = result_json
        .get("zipContentBase64")
        .and_then(|z| z.as_str())
        .unwrap_or_default();
    let zip_bytes = base64_decode(zip_b64).unwrap_or_default();

    let mut images = Vec::new();
    if let Some(raw_images) = result_json.get("images").and_then(|i| i.as_array()) {
        for img in raw_images {
            let page_number = img.get("pageNumber").and_then(|p| p.as_u64()).unwrap_or(1) as usize;
            let image_index = img.get("imageIndex").and_then(|p| p.as_u64()).unwrap_or(1) as usize;
            let width = img.get("width").and_then(|w| w.as_u64()).unwrap_or(0) as u32;
            let height = img.get("height").and_then(|h| h.as_u64()).unwrap_or(0) as u32;
            let format = img
                .get("format")
                .and_then(|f| f.as_str())
                .unwrap_or("PNG")
                .to_string();
            let size_bytes = img.get("sizeBytes").and_then(|s| s.as_u64()).unwrap_or(0) as usize;
            let content_base64 = img
                .get("contentBase64")
                .and_then(|c| c.as_str())
                .unwrap_or_default()
                .to_string();

            images.push(ExtractedImageItem {
                page_number,
                image_index,
                width,
                height,
                format,
                size_bytes,
                content_base64,
            });
        }
    }

    let (derived_artifact, operation) = store.create_derived_artifact(
        &request.document_id,
        &request.artifact_id,
        "application/zip",
        &zip_bytes,
        "pdf-extract-images",
        json!({
            "totalImages": total_images,
            "imageCount": images.len(),
        }),
    )?;

    Ok(ExtractPdfImagesResult {
        total_images,
        images,
        artifact: derived_artifact,
        operation,
    })
}

pub fn inspect_docx(request: InspectDocxRequest) -> CoreResult<DocxInspectionResult> {
    let store = ProjectStore::open(&request.project_path)?;
    let input_artifact = store.get_artifact(&request.artifact_id)?;
    if input_artifact.document_id != request.document_id {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O artifact de entrada não pertence ao documento informado.",
        ));
    }

    let source_bytes = store.read_artifact_bytes(&request.artifact_id)?;
    let content_b64 = base64_encode(&source_bytes);

    let result_json = invoke_sidecar(
        "docx.inspect",
        json!({
            "contentBase64": content_b64,
        }),
    )?;

    let mut paragraphs = Vec::new();
    if let Some(raw_pars) = result_json.get("paragraphs").and_then(|p| p.as_array()) {
        for p in raw_pars {
            paragraphs.push(DocxParagraphResult {
                text: p
                    .get("text")
                    .and_then(|t| t.as_str())
                    .unwrap_or("")
                    .to_string(),
                style: p
                    .get("style")
                    .and_then(|s| s.as_str())
                    .unwrap_or("Normal")
                    .to_string(),
            });
        }
    }

    let mut tables = Vec::new();
    if let Some(raw_tables) = result_json.get("tables").and_then(|t| t.as_array()) {
        for t in raw_tables {
            let mut rows = Vec::new();
            if let Some(raw_rows) = t.as_array() {
                for r in raw_rows {
                    let mut cells = Vec::new();
                    if let Some(raw_cells) = r.as_array() {
                        for c in raw_cells {
                            cells.push(c.as_str().unwrap_or("").to_string());
                        }
                    }
                    rows.push(cells);
                }
            }
            tables.push(rows);
        }
    }

    let title = result_json
        .get("title")
        .and_then(|t| t.as_str())
        .map(String::from);

    Ok(DocxInspectionResult {
        paragraphs,
        tables,
        title,
    })
}

pub fn create_docx(request: CreateDocxRequest) -> CoreResult<CreateDocxResult> {
    let mut params = json!({
        "paragraphs": request.paragraphs,
        "tables": request.tables,
    });
    if let Some(title) = request.title {
        params["title"] = json!(title);
    }

    let result_json = invoke_sidecar("docx.create", params)?;
    let b64 = result_json
        .get("contentBase64")
        .and_then(|c| c.as_str())
        .ok_or_else(|| {
            CoreError::new(
                ErrorCode::ReviewProcessing,
                "DOCX gerado sem conteúdo Base64.",
            )
        })?;

    let docx_bytes = base64_decode(b64)
        .ok_or_else(|| CoreError::new(ErrorCode::ReviewProcessing, "Base64 do DOCX é inválido."))?;

    let mut store = ProjectStore::open(&request.project_path)?;

    if let Some(doc_id) = &request.document_id {
        let artifacts = store.list_artifacts(doc_id)?;
        let first_artifact = artifacts.first().ok_or_else(|| {
            CoreError::new(
                ErrorCode::InvalidArgument,
                "Documento não possui artifacts.",
            )
        })?;
        let (artifact, operation) = store.create_derived_artifact(
            doc_id,
            &first_artifact.id,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            &docx_bytes,
            "docx-create",
            json!({ "name": request.name }),
        )?;
        Ok(CreateDocxResult {
            artifact,
            operation: Some(operation),
        })
    } else {
        let workspace = SensitiveTempDir::create().map_err(|_| CoreError::io())?;
        let temp_path = workspace
            .write_private("created.docx", &docx_bytes)
            .map_err(|_| CoreError::io())?;
        let imported = store.import_document(
            &temp_path,
            Some(&request.name),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )?;
        Ok(CreateDocxResult {
            artifact: imported.artifact,
            operation: None,
        })
    }
}

pub fn list_translation_models(
    _request: ListTranslationModelsRequest,
) -> CoreResult<ListTranslationModelsResult> {
    let result_json = invoke_sidecar("translate.list_models", json!({}))?;
    let mut models = Vec::new();
    if let Some(arr) = result_json.get("models").and_then(|m| m.as_array()) {
        for item in arr {
            let model_id = item
                .get("modelId")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let name = item
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let family = item
                .get("family")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let source_languages = item
                .get("sourceLanguages")
                .and_then(|v| v.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|s| s.as_str().map(|str| str.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            let target_languages = item
                .get("targetLanguages")
                .and_then(|v| v.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|s| s.as_str().map(|str| str.to_string()))
                        .collect()
                })
                .unwrap_or_default();
            let license = item
                .get("license")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let is_ready = item
                .get("isReady")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);

            models.push(TranslationModelInfo {
                model_id,
                name,
                family,
                source_languages,
                target_languages,
                license,
                is_ready,
            });
        }
    }
    Ok(ListTranslationModelsResult { models })
}

pub fn translate_text(request: TranslateTextRequest) -> CoreResult<TranslateTextResult> {
    let mut params = json!({
        "text": request.text,
        "targetLanguage": request.target_language,
    });
    if let Some(src) = &request.source_language {
        params["sourceLanguage"] = json!(src);
    }
    if let Some(mid) = &request.model_id {
        params["modelId"] = json!(mid);
    }

    let result_json = invoke_sidecar("translate", params)?;

    let text = result_json
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or_default()
        .to_string();
    let source_language = result_json
        .get("sourceLanguage")
        .and_then(|s| s.as_str())
        .unwrap_or_default()
        .to_string();
    let target_language = result_json
        .get("targetLanguage")
        .and_then(|t| t.as_str())
        .unwrap_or_default()
        .to_string();
    let model_id = result_json
        .get("modelId")
        .and_then(|m| m.as_str())
        .unwrap_or_default()
        .to_string();
    let segments = result_json
        .get("segments")
        .and_then(|s| s.as_u64())
        .unwrap_or(1) as usize;

    let (artifact, operation) = if let (Some(project_path), Some(document_id)) =
        (&request.project_path, &request.document_id)
    {
        let mut store = ProjectStore::open(project_path)?;
        let parent_artifact_id = if let Some(aid) = &request.artifact_id {
            aid.clone()
        } else {
            let doc_artifacts = store.list_artifacts(document_id)?;
            doc_artifacts
                .last()
                .map(|a| a.id.clone())
                .unwrap_or_default()
        };

        let (derived, op) = store.create_derived_artifact(
            document_id,
            &parent_artifact_id,
            "text/plain",
            text.as_bytes(),
            "text-translate",
            json!({
                "sourceLanguage": source_language,
                "targetLanguage": target_language,
                "modelId": model_id,
                "segments": segments,
            }),
        )?;
        (Some(derived), Some(op))
    } else {
        (None, None)
    };

    Ok(TranslateTextResult {
        text,
        source_language,
        target_language,
        model_id,
        segments,
        artifact,
        operation,
    })
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedEntity {
    pub category: String,
    pub value: String,
    pub normalized_value: String,
    pub confidence: f64,
    pub count: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedTable {
    pub title: Option<String>,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedSection {
    pub title: String,
    pub level: usize,
    pub line_number: usize,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractionMetrics {
    pub char_count: usize,
    pub word_count: usize,
    pub line_count: usize,
    pub page_count: usize,
    pub language: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractInformationRequest {
    pub project_path: Option<String>,
    pub document_id: Option<String>,
    pub artifact_id: Option<String>,
    pub text: Option<String>,
    pub mode: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractInformationResult {
    pub text: String,
    pub mode: String,
    pub metrics: ExtractionMetrics,
    pub entities: Vec<ExtractedEntity>,
    pub key_values: std::collections::HashMap<String, String>,
    pub tables: Vec<ExtractedTable>,
    pub sections: Vec<ExtractedSection>,
    pub artifact: Option<Artifact>,
    pub operation: Option<Operation>,
}

pub fn extract_information(
    request: ExtractInformationRequest,
) -> CoreResult<ExtractInformationResult> {
    let mode = request.mode.as_deref().unwrap_or("all");

    let (text_param, b64_param, mime_param) =
        if let (Some(project_path), Some(_document_id), Some(artifact_id)) = (
            &request.project_path,
            &request.document_id,
            &request.artifact_id,
        ) {
            let store = ProjectStore::open(project_path)?;
            let artifact = store.get_artifact(artifact_id)?;
            let bytes = store.read_artifact_bytes(artifact_id)?;

            if artifact.mime_type == "application/pdf" {
                (
                    None,
                    Some(base64_encode(&bytes)),
                    Some("application/pdf".to_string()),
                )
            } else {
                let decoded = String::from_utf8(bytes).map_err(|_| {
                    CoreError::new(
                        ErrorCode::InvalidArgument,
                        "Arquivo de texto com codificação inválida.",
                    )
                })?;
                (Some(decoded), None, Some(artifact.mime_type.clone()))
            }
        } else if let Some(ref text) = request.text {
            (Some(text.clone()), None, Some("text/plain".to_string()))
        } else {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "Texto ou documento deve ser especificado para extração.",
            ));
        };

    let mut params = json!({
        "mode": mode,
    });
    if let Some(t) = text_param {
        params["text"] = json!(t);
    }
    if let Some(b) = b64_param {
        params["contentBase64"] = json!(b);
    }
    if let Some(m) = mime_param {
        params["mimeType"] = json!(m);
    }

    let result_json = invoke_sidecar("extract", params)?;

    let text = result_json
        .get("text")
        .and_then(|t| t.as_str())
        .unwrap_or_default()
        .to_string();

    let metrics_json = result_json
        .get("metrics")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let metrics: ExtractionMetrics = serde_json::from_value(metrics_json).map_err(|e| {
        CoreError::new(
            ErrorCode::ReviewProcessing,
            format!("Métricas retornadas pelo engine inválidas: {e}"),
        )
    })?;

    let entities_json = result_json
        .get("entities")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let entities: Vec<ExtractedEntity> = serde_json::from_value(entities_json).unwrap_or_default();

    let key_values_json = result_json
        .get("keyValues")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let key_values: std::collections::HashMap<String, String> =
        serde_json::from_value(key_values_json).unwrap_or_default();

    let tables_json = result_json
        .get("tables")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let tables: Vec<ExtractedTable> = serde_json::from_value(tables_json).unwrap_or_default();

    let sections_json = result_json
        .get("sections")
        .cloned()
        .unwrap_or_else(|| json!([]));
    let sections: Vec<ExtractedSection> = serde_json::from_value(sections_json).unwrap_or_default();

    let (artifact, operation) = if let (Some(project_path), Some(document_id)) =
        (&request.project_path, &request.document_id)
    {
        let mut store = ProjectStore::open(project_path)?;
        let parent_artifact_id = if let Some(aid) = &request.artifact_id {
            aid.clone()
        } else {
            let doc_artifacts = store.list_artifacts(document_id)?;
            doc_artifacts
                .last()
                .map(|a| a.id.clone())
                .unwrap_or_default()
        };

        let extraction_payload = json!({
            "mode": mode,
            "metrics": metrics,
            "entities": entities,
            "keyValues": key_values,
            "tables": tables,
            "sections": sections,
        });

        let payload_bytes = serde_json::to_vec_pretty(&extraction_payload).map_err(|e| {
            CoreError::new(
                ErrorCode::StorageIo,
                format!("Falha ao serializar payload de extração: {e}"),
            )
        })?;

        let (derived, op) = store.create_derived_artifact(
            document_id,
            &parent_artifact_id,
            "application/json",
            &payload_bytes,
            "intelligence-extract",
            json!({
                "mode": mode,
                "entitiesCount": entities.len(),
                "tablesCount": tables.len(),
            }),
        )?;
        (Some(derived), Some(op))
    } else {
        (None, None)
    };

    Ok(ExtractInformationResult {
        text,
        mode: mode.to_string(),
        metrics,
        entities,
        key_values,
        tables,
        sections,
        artifact,
        operation,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_and_decodes_base64() {
        let original = b"NexoHub Document Engine OCR and Translation Bridge";
        let encoded = base64_encode(original);
        let decoded = base64_decode(&encoded).expect("deve decodificar");
        assert_eq!(decoded, original);
    }

    #[test]
    fn creates_docx_via_sidecar() {
        let result = invoke_sidecar(
            "docx.create",
            json!({
                "title": "Documento Teste",
                "paragraphs": [
                    {"text": "Primeiro parágrafo do NexoHub.", "style": "Normal"}
                ]
            }),
        )
        .expect("docx.create deve responder com sucesso");

        assert!(result.get("contentBase64").is_some());
        assert_eq!(
            result.get("mimeType").and_then(|m| m.as_str()),
            Some("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        );
    }

    #[test]
    fn processes_ocr_via_sidecar() {
        // 1x1 PNG transparente em Base64
        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
        let result = invoke_sidecar(
            "ocr",
            json!({
                "mimeType": "image/png",
                "contentBase64": png_b64,
            }),
        )
        .expect("ocr deve processar imagem válida");

        assert_eq!(result.get("pages").and_then(|p| p.as_u64()), Some(1));
        assert_eq!(
            result.get("engine").and_then(|e| e.as_str()),
            Some("rapidocr")
        );
    }

    #[test]
    fn extracts_information_via_sidecar() {
        let result = extract_information(ExtractInformationRequest {
            project_path: None,
            document_id: None,
            artifact_id: None,
            text: Some("Contrato NexoHub. Contratante: Fulano de Tal. CPF: 529.982.247-25. Valor: R$ 3.500,00".to_string()),
            mode: Some("all".to_string()),
        })
        .expect("extract_information deve processar texto");

        assert_eq!(result.mode, "all");
        assert!(result.metrics.char_count > 0);
        assert!(
            result
                .entities
                .iter()
                .any(|e| e.category == "cpf" && e.confidence == 1.0)
        );
        assert!(result.entities.iter().any(|e| e.category == "money"));
        assert_eq!(
            result.key_values.get("Contratante"),
            Some(&"Fulano de Tal".to_string())
        );
    }
}
