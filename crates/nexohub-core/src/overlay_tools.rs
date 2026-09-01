//! Overlays PDF não destrutivos, armazenados separadamente do blob documental.

use crate::domain::Overlay;
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::storage::ProjectStore;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

const PDF_MIME_TYPE: &str = "application/pdf";

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PdfOverlayKind {
    Highlight,
    Note,
    Drawing,
}

impl PdfOverlayKind {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Highlight => "HIGHLIGHT",
            Self::Note => "NOTE",
            Self::Drawing => "DRAWING",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePdfOverlayRequest {
    pub project_path: String,
    pub artifact_id: String,
    pub kind: PdfOverlayKind,
    pub page_number: u32,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub payload: Value,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListPdfOverlaysRequest {
    pub project_path: String,
    pub artifact_id: String,
}

pub fn create_pdf_overlay(request: CreatePdfOverlayRequest) -> CoreResult<Overlay> {
    validate_geometry(&request)?;
    let mut store = ProjectStore::open(&request.project_path)?;
    let artifact = store.get_artifact(&request.artifact_id)?;
    if artifact.mime_type != PDF_MIME_TYPE {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Overlays PDF exigem um artifact application/pdf.",
        ));
    }
    store.create_overlay(
        &request.artifact_id,
        request.kind.as_str(),
        json!({
            "pageNumber": request.page_number,
            "bounds": {
                "x": request.x,
                "y": request.y,
                "width": request.width,
                "height": request.height
            },
            "payload": request.payload
        }),
    )
}

pub fn list_pdf_overlays(request: ListPdfOverlaysRequest) -> CoreResult<Vec<Overlay>> {
    let store = ProjectStore::open(&request.project_path)?;
    let artifact = store.get_artifact(&request.artifact_id)?;
    if artifact.mime_type != PDF_MIME_TYPE {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Overlays PDF exigem um artifact application/pdf.",
        ));
    }
    store.list_overlays(&request.artifact_id)
}

fn validate_geometry(request: &CreatePdfOverlayRequest) -> CoreResult<()> {
    if request.page_number == 0 {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A página do overlay começa em 1.",
        ));
    }
    let values = [request.x, request.y, request.width, request.height];
    if values.iter().any(|value| !value.is_finite())
        || request.x < 0.0
        || request.y < 0.0
        || request.width <= 0.0
        || request.height <= 0.0
        || request.x + request.width > 1.0
        || request.y + request.height > 1.0
    {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A geometria normalizada do overlay é inválida.",
        ));
    }
    Ok(())
}
