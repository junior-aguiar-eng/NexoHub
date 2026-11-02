//! Normalização das respostas dos provedores para os formatos do produto. Nunca entrega o JSON do
//! provedor como documento final e nunca aceita mais do que foi orçado (páginas, tamanho).
//! Os formatos de entrada aqui são sintéticos, modelados no Document AI e no Translation v3;
//! o adapter real só pode ser habilitado depois de conferir uma resposta verdadeira (ver abaixo).
use super::{CloudError, policy::CloudPolicy};
use nexohub_core::python_engine::OcrLineResult;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashSet;

/// Mesmos tetos do motor OCR local (`engines/python/.../ocr.py`).
const MAX_OUTPUT_LINES: usize = 100_000;
const MAX_OUTPUT_CHARACTERS: usize = 4_000_000;
/// Tolerância a arredondamento do provedor antes de recusar uma caixa fora da página.
const BOX_TOLERANCE: f64 = 0.01;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OutputError {
    /// Estrutura inesperada, campo ausente ou valor numérico inválido.
    InvalidShape,
    /// Número ou numeração de páginas diferente do orçado.
    PageMismatch,
    /// Acima dos limites da política ou do motor.
    TooLarge,
    /// Texto com caracteres de controle ou vazio quando não deveria.
    InvalidText,
    /// PDF devolvido não é um PDF utilizável.
    InvalidPdf,
}
impl From<OutputError> for CloudError {
    fn from(_: OutputError) -> Self {
        // Resposta do provedor fora do contrato é falha do motor, sem expor o conteúdo.
        CloudError::Unavailable
    }
}

// ---------------------------------------------------------------- OCR

#[derive(Debug, PartialEq)]
pub struct OcrOutput {
    pub text: String,
    pub pages: usize,
    pub lines: Vec<OcrLineResult>,
}

#[derive(Deserialize)]
struct Document {
    text: String,
    pages: Vec<Page>,
}
#[derive(Deserialize)]
struct Page {
    #[serde(rename = "pageNumber")]
    page_number: u64,
    #[serde(default)]
    lines: Vec<Line>,
}
#[derive(Deserialize)]
struct Line {
    layout: Layout,
}
#[derive(Deserialize)]
struct Layout {
    #[serde(rename = "textAnchor")]
    text_anchor: Anchor,
    confidence: f64,
    #[serde(rename = "boundingPoly")]
    bounding_poly: Poly,
}
#[derive(Deserialize)]
struct Anchor {
    #[serde(rename = "textSegments", default)]
    segments: Vec<Segment>,
}
#[derive(Deserialize)]
struct Segment {
    // O provedor omite `startIndex` quando é 0.
    #[serde(rename = "startIndex", default)]
    start: u64,
    #[serde(rename = "endIndex")]
    end: u64,
}
#[derive(Deserialize)]
struct Poly {
    #[serde(rename = "normalizedVertices")]
    vertices: Vec<Vertex>,
}
#[derive(Deserialize)]
struct Vertex {
    #[serde(default)]
    x: f64,
    #[serde(default)]
    y: f64,
}

fn round6(value: f64) -> f64 {
    (value * 1_000_000.0).round() / 1_000_000.0
}

fn clean_line(raw: &str) -> Result<String, OutputError> {
    let mut out = String::with_capacity(raw.len());
    for c in raw.trim().chars() {
        match c {
            '\n' | '\r' | '\t' => out.push(' '),
            c if c.is_control() => return Err(OutputError::InvalidText),
            c => out.push(c),
        }
    }
    Ok(out)
}

fn bounds(vertices: &[Vertex]) -> Result<(f64, f64, f64, f64), OutputError> {
    if vertices.len() < 3 {
        return Err(OutputError::InvalidShape);
    }
    let (mut min_x, mut min_y, mut max_x, mut max_y) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
    for v in vertices {
        let inside = |n: f64| n.is_finite() && (-BOX_TOLERANCE..=1.0 + BOX_TOLERANCE).contains(&n);
        if !inside(v.x) || !inside(v.y) {
            return Err(OutputError::InvalidShape);
        }
        let (x, y) = (v.x.clamp(0.0, 1.0), v.y.clamp(0.0, 1.0));
        (min_x, max_x) = (min_x.min(x), max_x.max(x));
        (min_y, max_y) = (min_y.min(y), max_y.max(y));
    }
    let (width, height) = (max_x - min_x, max_y - min_y);
    // Caixa sem área não serve para posicionar a camada de texto.
    if width <= 0.0 || height <= 0.0 {
        return Err(OutputError::InvalidShape);
    }
    Ok((round6(min_x), round6(min_y), round6(width), round6(height)))
}

/// `expected_pages` é o número orçado e reservado; a resposta precisa ter exatamente essas páginas.
/// Os índices de texto do provedor são tratados como posições em caracteres Unicode (não bytes).
/// Essa premissa precisa ser confirmada com uma resposta real antes de ativar o adapter.
pub fn normalize_ocr(response: &Value, expected_pages: u64) -> Result<OcrOutput, OutputError> {
    let doc: Document =
        serde_json::from_value(response.clone()).map_err(|_| OutputError::InvalidShape)?;
    let characters: Vec<char> = doc.text.chars().collect();
    if characters.len() > MAX_OUTPUT_CHARACTERS {
        return Err(OutputError::TooLarge);
    }
    let expected = usize::try_from(expected_pages).map_err(|_| OutputError::PageMismatch)?;
    if expected == 0 || doc.pages.len() != expected {
        return Err(OutputError::PageMismatch);
    }
    let mut seen = HashSet::new();
    let mut lines = Vec::new();
    let mut total = 0usize;
    for page in &doc.pages {
        let number = usize::try_from(page.page_number).map_err(|_| OutputError::PageMismatch)?;
        if number == 0 || number > expected || !seen.insert(number) {
            return Err(OutputError::PageMismatch);
        }
        for line in &page.lines {
            let mut text = String::new();
            for segment in &line.layout.text_anchor.segments {
                let (start, end) = (
                    usize::try_from(segment.start).map_err(|_| OutputError::InvalidShape)?,
                    usize::try_from(segment.end).map_err(|_| OutputError::InvalidShape)?,
                );
                let slice = characters
                    .get(start..end)
                    .ok_or(OutputError::InvalidShape)?;
                text.extend(slice);
            }
            let text = clean_line(&text)?;
            if text.is_empty() {
                continue; // como o motor local: só linhas com texto reconhecido
            }
            let confidence = line.layout.confidence;
            if !confidence.is_finite() || !(0.0..=1.0).contains(&confidence) {
                return Err(OutputError::InvalidShape);
            }
            total += text.chars().count();
            if lines.len() >= MAX_OUTPUT_LINES || total > MAX_OUTPUT_CHARACTERS {
                return Err(OutputError::TooLarge);
            }
            lines.push(OcrLineResult {
                page_number: number,
                text,
                confidence: round6(confidence),
                bounds: bounds(&line.layout.bounding_poly.vertices)?,
            });
        }
    }
    lines.sort_by_key(|l| l.page_number); // estável: preserva a ordem de leitura dentro da página
    let text = lines
        .iter()
        .map(|l| l.text.as_str())
        .collect::<Vec<_>>()
        .join("\n");
    Ok(OcrOutput {
        text,
        pages: expected,
        lines,
    })
}

// ---------------------------------------------------------------- Tradução

#[derive(Debug, PartialEq, Eq)]
pub struct TextOutput {
    pub bytes: Vec<u8>,
    pub mime: &'static str,
}

/// `source_characters` vem do orçamento inspecionado. Exatamente uma tradução (um idioma-alvo).
pub fn normalize_translation(
    response: &Value,
    source_characters: u64,
    policy: &CloudPolicy,
) -> Result<TextOutput, OutputError> {
    let list = response
        .get("translations")
        .and_then(Value::as_array)
        .ok_or(OutputError::InvalidShape)?;
    if list.len() != 1 {
        return Err(OutputError::InvalidShape);
    }
    let text = list[0]
        .get("translatedText")
        .and_then(Value::as_str)
        .ok_or(OutputError::InvalidShape)?;
    if text
        .chars()
        .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'))
    {
        return Err(OutputError::InvalidText);
    }
    if source_characters > 0 && text.trim().is_empty() {
        return Err(OutputError::InvalidText);
    }
    // Teto generoso de expansão entre idiomas; acima disso a resposta é suspeita.
    let ceiling = policy.translation.max_characters.saturating_mul(4);
    if text.chars().count() as u64 > ceiling {
        return Err(OutputError::TooLarge);
    }
    Ok(TextOutput {
        bytes: text.as_bytes().to_vec(),
        mime: "text/plain",
    })
}

// ---------------------------------------------------------------- Office → PDF

#[derive(Debug)]
pub struct PdfOutput {
    pub bytes: Vec<u8>,
    pub pages: usize,
}

/// O conversor devolve um PDF novo; o original do usuário nunca é tocado.
pub fn validate_office_pdf(bytes: Vec<u8>, policy: &CloudPolicy) -> Result<PdfOutput, OutputError> {
    if bytes.len() as u64 > policy.transfer.max_output_bytes {
        return Err(OutputError::TooLarge);
    }
    if !bytes.starts_with(b"%PDF-") {
        return Err(OutputError::InvalidPdf);
    }
    let document = lopdf::Document::load_mem(&bytes).map_err(|_| OutputError::InvalidPdf)?;
    if document.is_encrypted() {
        return Err(OutputError::InvalidPdf);
    }
    let pages = document.get_pages().len();
    if pages == 0 {
        return Err(OutputError::InvalidPdf);
    }
    if pages as u64 > policy.office.max_output_pages {
        return Err(OutputError::TooLarge);
    }
    Ok(PdfOutput { bytes, pages })
}
