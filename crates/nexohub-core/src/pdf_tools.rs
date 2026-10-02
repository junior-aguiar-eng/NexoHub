//! Executores PDF nativos que preservam o original e produzem artifacts derivados.

use crate::domain::{Artifact, Operation};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::storage::ProjectStore;
use image::{DynamicImage, GenericImageView, ImageFormat, ImageReader, imageops::FilterType};
use lopdf::{Document, LoadOptions, SaveOptions};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::io::Cursor;

const PDF_MIME_TYPE: &str = "application/pdf";
const MAX_DECOMPRESSED_STREAM_SIZE: usize = 64 * 1024 * 1024;
const MAX_IMAGE_PIXELS: u64 = 16_000_000;

fn optimize_embedded_images(document: &mut Document, level: u8) {
    let (quality, max_dimension) = match level {
        1..=3 => (82, 2800),
        4..=6 => (65, 2000),
        _ => (48, 1400),
    };

    for object in document.objects.values_mut() {
        let Ok(stream) = object.as_stream_mut() else {
            continue;
        };
        let dict = &stream.dict;
        let filter = dict.get(b"Filter").and_then(lopdf::Object::as_name).ok();
        if dict.get(b"Subtype").and_then(lopdf::Object::as_name).ok() != Some(b"Image")
            || (filter != Some(b"DCTDecode".as_slice())
                && filter != Some(b"FlateDecode".as_slice()))
            || dict
                .get(b"BitsPerComponent")
                .and_then(lopdf::Object::as_i64)
                .ok()
                != Some(8)
            || dict.has(b"Mask")
            || dict.has(b"Decode")
            || dict.has(b"DecodeParms")
        {
            continue;
        }
        let color = dict
            .get(b"ColorSpace")
            .and_then(lopdf::Object::as_name)
            .ok();
        if color != Some(b"DeviceRGB".as_slice()) && color != Some(b"DeviceGray".as_slice()) {
            continue;
        }
        let (Some(width), Some(height)) = (
            dict.get(b"Width").and_then(lopdf::Object::as_i64).ok(),
            dict.get(b"Height").and_then(lopdf::Object::as_i64).ok(),
        ) else {
            continue;
        };
        if width < 64
            || height < 64
            || (width as u128) * (height as u128) > u128::from(MAX_IMAGE_PIXELS)
        {
            continue;
        }

        let decoded = if filter == Some(b"DCTDecode".as_slice()) {
            let Ok((jpeg_width, jpeg_height)) =
                ImageReader::with_format(Cursor::new(&stream.content), ImageFormat::Jpeg)
                    .into_dimensions()
            else {
                continue;
            };
            if (jpeg_width, jpeg_height) != (width as u32, height as u32) {
                continue;
            }
            let Ok(image) =
                ImageReader::with_format(Cursor::new(&stream.content), ImageFormat::Jpeg).decode()
            else {
                continue;
            };
            image
        } else {
            let channels = if color == Some(b"DeviceRGB".as_slice()) {
                3
            } else {
                1
            };
            let expected = width as usize * height as usize * channels;
            let Ok(raw) = stream.decompressed_content_with_limit(expected) else {
                continue;
            };
            if raw.len() != expected {
                continue;
            }
            if channels == 3 {
                let Some(image) = image::RgbImage::from_raw(width as u32, height as u32, raw)
                else {
                    continue;
                };
                DynamicImage::ImageRgb8(image)
            } else {
                let Some(image) = image::GrayImage::from_raw(width as u32, height as u32, raw)
                else {
                    continue;
                };
                DynamicImage::ImageLuma8(image)
            }
        };
        if decoded.dimensions() != (width as u32, height as u32) {
            continue;
        }
        let expected_channels = if color == Some(b"DeviceRGB".as_slice()) {
            3
        } else {
            1
        };
        if decoded.color().channel_count() != expected_channels {
            continue;
        }
        let longest = width.max(height) as u32;
        let resized = if longest > max_dimension {
            let scale = max_dimension as f64 / longest as f64;
            decoded.resize_exact(
                (width as f64 * scale).round() as u32,
                (height as f64 * scale).round() as u32,
                FilterType::Triangle,
            )
        } else {
            decoded
        };
        let mut encoded = Vec::new();
        if image::codecs::jpeg::JpegEncoder::new_with_quality(&mut encoded, quality)
            .encode_image(&resized)
            .is_err()
            || encoded.len() >= stream.content.len()
        {
            continue;
        }
        stream.dict.set("Width", i64::from(resized.width()));
        stream.dict.set("Height", i64::from(resized.height()));
        stream.dict.set("Filter", "DCTDecode");
        stream.dict.remove(b"DecodeParms");
        stream.dict.remove(b"Decode");
        stream.set_content(encoded);
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressPdfRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
    pub compression_level: u8,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PdfToolResult {
    pub artifact: Artifact,
    pub operation: Operation,
}

pub fn compress_pdf(request: CompressPdfRequest) -> CoreResult<PdfToolResult> {
    if !(1..=9).contains(&request.compression_level) {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O nível de compressão deve estar entre 1 e 9.",
        ));
    }

    let mut store = ProjectStore::open(&request.project_path)?;
    let input = store.get_artifact(&request.artifact_id)?;
    if input.document_id != request.document_id {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O artifact de entrada não pertence ao documento informado.",
        ));
    }
    if input.mime_type != PDF_MIME_TYPE {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A ferramenta aceita somente artifacts PDF.",
        ));
    }
    let limits = store.limits().clone();
    if input.size > limits.max_pdf_input_bytes {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} MiB para esta operação.",
                limits.max_pdf_input_bytes / (1024 * 1024)
            ),
        ));
    }

    let source = store.read_artifact_bytes(&request.artifact_id)?;
    let options = LoadOptions::with_max_decompressed_size(MAX_DECOMPRESSED_STREAM_SIZE);
    let mut document = Document::load_mem_with_options(&source, options)
        .map_err(|_| CoreError::pdf("Não foi possível interpretar o PDF de entrada."))?;
    if document.is_encrypted() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "PDF protegido por senha não é suportado pela compressão.",
        ));
    }
    let page_count = document.get_pages().len();
    if page_count == 0 || page_count > limits.max_pdf_pages {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF deve conter entre 1 e {} páginas.",
                limits.max_pdf_pages
            ),
        ));
    }
    if document.objects.len() > limits.max_pdf_objects {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} objetos internos.",
                limits.max_pdf_objects
            ),
        ));
    }
    if document.objects.values().any(|object| match object {
        lopdf::Object::Dictionary(dict) => dict.has(b"ByteRange"),
        lopdf::Object::Stream(stream) => stream.dict.has(b"ByteRange"),
        _ => false,
    }) {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "PDF assinado não pode ser comprimido sem invalidar a assinatura.",
        ));
    }

    // Descarte seguro de metadados privados de aplicativos e miniaturas embutidas de páginas
    if let Ok(root_ref) = document
        .trailer
        .get(b"Root")
        .and_then(lopdf::Object::as_reference)
        && let Ok(catalog) = document
            .get_object_mut(root_ref)
            .and_then(lopdf::Object::as_dict_mut)
    {
        catalog.remove(b"PieceInfo");
    }
    for (_, page_id) in document.get_pages() {
        if let Ok(page_dict) = document
            .get_object_mut(page_id)
            .and_then(lopdf::Object::as_dict_mut)
        {
            page_dict.remove(b"PieceInfo");
            page_dict.remove(b"Thumb");
        }
    }

    optimize_embedded_images(&mut document, request.compression_level);
    document.prune_objects();
    document.compress();

    let save_options = SaveOptions::builder()
        .use_object_streams(true)
        .use_xref_streams(true)
        .compression_level(u32::from(request.compression_level))
        .build();
    let mut output = Vec::new();
    document
        .save_with_options(&mut output, save_options)
        .map_err(|_| CoreError::pdf("Não foi possível gerar o PDF comprimido."))?;
    if output.len() >= source.len() {
        output = source;
    }

    let (artifact, operation) = store.create_derived_artifact(
        &request.document_id,
        &request.artifact_id,
        PDF_MIME_TYPE,
        &output,
        "pdf-compress",
        json!({ "compressionLevel": request.compression_level }),
    )?;
    Ok(PdfToolResult {
        artifact,
        operation,
    })
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrganizePdfRequest {
    pub project_path: String,
    pub document_id: String,
    pub artifact_id: String,
    pub page_order: Vec<u32>,
    pub rotation_degrees: Option<i32>,
}

pub fn organize_pdf(request: OrganizePdfRequest) -> CoreResult<PdfToolResult> {
    if request.page_order.is_empty() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A lista de páginas para organização não pode estar vazia.",
        ));
    }

    let mut store = ProjectStore::open(&request.project_path)?;
    let input = store.get_artifact(&request.artifact_id)?;
    if input.document_id != request.document_id {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O artifact de entrada não pertence ao documento informado.",
        ));
    }
    if input.mime_type != PDF_MIME_TYPE {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "A ferramenta aceita somente artifacts PDF.",
        ));
    }
    let limits = store.limits().clone();
    if input.size > limits.max_pdf_input_bytes {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} MiB para esta operação.",
                limits.max_pdf_input_bytes / (1024 * 1024)
            ),
        ));
    }

    let source = store.read_artifact_bytes(&request.artifact_id)?;
    let options = LoadOptions::with_max_decompressed_size(MAX_DECOMPRESSED_STREAM_SIZE);
    let mut document = Document::load_mem_with_options(&source, options)
        .map_err(|_| CoreError::pdf("Não foi possível interpretar o PDF de entrada."))?;
    if document.is_encrypted() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "PDF protegido por senha não é suportado pela organização.",
        ));
    }

    let existing_pages = document.get_pages();
    let page_count = existing_pages.len();
    if page_count == 0 || page_count > limits.max_pdf_pages {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF deve conter entre 1 e {} páginas.",
                limits.max_pdf_pages
            ),
        ));
    }
    if document.objects.len() > limits.max_pdf_objects {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O PDF excede o limite de {} objetos internos.",
                limits.max_pdf_objects
            ),
        ));
    }

    for &page_num in &request.page_order {
        if !existing_pages.contains_key(&page_num) {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                format!("A página {} não existe no documento.", page_num),
            ));
        }
    }

    if let Some(rot) = request.rotation_degrees {
        if ![0, 90, 180, 270].contains(&rot) {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "A rotação deve ser 0, 90, 180 ou 270 graus.",
            ));
        }
        if rot != 0 {
            for &page_num in &request.page_order {
                let page_id = existing_pages[&page_num];
                if let Ok(page_dict) = document
                    .get_object_mut(page_id)
                    .and_then(|o| o.as_dict_mut())
                {
                    let current_rot = page_dict
                        .get(b"Rotate")
                        .and_then(|r| r.as_i64())
                        .unwrap_or(0);
                    let new_rot = (current_rot + rot as i64).rem_euclid(360);
                    page_dict.set("Rotate", lopdf::Object::Integer(new_rot));
                }
            }
        }
    }

    let new_kids: Vec<lopdf::Object> = request
        .page_order
        .iter()
        .map(|page_num| lopdf::Object::Reference(existing_pages[page_num]))
        .collect();
    let new_count = new_kids.len() as i64;

    let pages_id = document
        .catalog()
        .map_err(|_| CoreError::pdf("Catálogo PDF ausente ou inválido."))?
        .get(b"Pages")
        .map_err(|_| CoreError::pdf("Raiz de páginas ausente no catálogo PDF."))?
        .as_reference()
        .map_err(|_| CoreError::pdf("Referência de páginas inválida."))?;

    let pages_dict = document
        .get_object_mut(pages_id)
        .map_err(|_| CoreError::pdf("Objeto raiz de páginas não encontrado."))?
        .as_dict_mut()
        .map_err(|_| CoreError::pdf("Objeto raiz de páginas não é um dicionário."))?;

    pages_dict.set("Kids", lopdf::Object::Array(new_kids));
    pages_dict.set("Count", lopdf::Object::Integer(new_count));
    document.prune_objects();

    let save_options = SaveOptions::builder()
        .use_object_streams(true)
        .use_xref_streams(true)
        .build();
    let mut output = Vec::new();
    document
        .save_with_options(&mut output, save_options)
        .map_err(|_| CoreError::pdf("Não foi possível gerar o PDF organizado."))?;

    let (artifact, operation) = store.create_derived_artifact(
        &request.document_id,
        &request.artifact_id,
        PDF_MIME_TYPE,
        &output,
        "pdf-organize",
        json!({
            "pageOrder": request.page_order,
            "rotation": request.rotation_degrees,
        }),
    )?;
    Ok(PdfToolResult {
        artifact,
        operation,
    })
}
