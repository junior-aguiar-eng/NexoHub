//! Anchors persistentes para texto, regiões PDF e linhas de OCR.

use crate::domain::Anchor;
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::storage::ProjectStore;
use serde::{Deserialize, Serialize};

const MAX_QUOTE_BYTES: usize = 4096;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "SCREAMING_SNAKE_CASE",
    rename_all_fields = "camelCase"
)]
pub enum AnchorSelector {
    TextRange {
        start: u64,
        end: u64,
    },
    PdfRegion {
        page_number: u32,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    },
    OcrLine {
        page_number: u32,
        line_index: u32,
    },
}

impl AnchorSelector {
    const fn kind(&self) -> &'static str {
        match self {
            Self::TextRange { .. } => "TEXT_RANGE",
            Self::PdfRegion { .. } => "PDF_REGION",
            Self::OcrLine { .. } => "OCR_LINE",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAnchorRequest {
    pub project_path: String,
    pub artifact_id: String,
    pub selector: AnchorSelector,
    pub quote: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListAnchorsRequest {
    pub project_path: String,
    pub artifact_id: String,
}

pub fn create_anchor(request: CreateAnchorRequest) -> CoreResult<Anchor> {
    validate_selector(&request.selector)?;
    if request
        .quote
        .as_ref()
        .is_some_and(|value| value.len() > MAX_QUOTE_BYTES)
    {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A citação do anchor excede 4 KiB.",
        ));
    }
    let selector = serde_json::to_value(&request.selector).map_err(|_| {
        CoreError::new(
            ErrorCode::InvalidArgument,
            "O seletor do anchor é inválido.",
        )
    })?;
    let mut store = ProjectStore::open(&request.project_path)?;
    let artifact = store.get_artifact(&request.artifact_id)?;
    validate_target(&request.selector, &artifact.mime_type)?;
    store.create_anchor(
        &request.artifact_id,
        request.selector.kind(),
        selector,
        request.quote.as_deref(),
    )
}

fn validate_target(selector: &AnchorSelector, mime_type: &str) -> CoreResult<()> {
    let valid = match selector {
        AnchorSelector::TextRange { .. } => matches!(mime_type, "text/plain" | "text/markdown"),
        AnchorSelector::PdfRegion { .. } => mime_type == "application/pdf",
        AnchorSelector::OcrLine { .. } => mime_type == "application/vnd.nexohub.ocr+json",
    };
    if valid {
        Ok(())
    } else {
        Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O seletor do anchor é incompatível com o artifact.",
        ))
    }
}

pub fn list_anchors(request: ListAnchorsRequest) -> CoreResult<Vec<Anchor>> {
    ProjectStore::open(&request.project_path)?.list_anchors(&request.artifact_id)
}

fn validate_selector(selector: &AnchorSelector) -> CoreResult<()> {
    match selector {
        AnchorSelector::TextRange { start, end } if start >= end => Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O intervalo textual do anchor é inválido.",
        )),
        AnchorSelector::PdfRegion {
            page_number,
            x,
            y,
            width,
            height,
        } if *page_number == 0
            || [x, y, width, height].iter().any(|value| !value.is_finite())
            || *x < 0.0
            || *y < 0.0
            || *width <= 0.0
            || *height <= 0.0
            || x + width > 1.0
            || y + height > 1.0 =>
        {
            Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "A região PDF do anchor é inválida.",
            ))
        }
        AnchorSelector::OcrLine { page_number: 0, .. } => Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A página da linha OCR começa em 1.",
        )),
        _ => Ok(()),
    }
}
