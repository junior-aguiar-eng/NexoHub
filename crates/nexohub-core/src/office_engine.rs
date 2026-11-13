//! Motor documental Office local (Word/Excel/PowerPoint <-> PDF) via LibreOffice headless isolado.

use crate::capabilities::runtime_root;
use crate::error::{CoreError, CoreResult, ErrorCode};
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const MAX_OFFICE_INPUT_BYTES: usize = 64 * 1024 * 1024;
const MAX_ZIP_ENTRIES: usize = 10_000;
const MAX_ZIP_UNCOMPRESSED_BYTES: u64 = 512 * 1024 * 1024;
const MAX_ZIP_EXPANSION_RATIO: u64 = 100;
const SOFFICE_TIMEOUT_SECS: u64 = 120;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OfficeConversionKind {
    WordToPdf,
    ExcelToPdf,
    PowerPointToPdf,
    PdfToPowerPoint,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertOfficeRequest {
    pub project_path: Option<String>,
    pub kind: OfficeConversionKind,
    pub file_name: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertOfficeResult {
    pub file_name: String,
    pub mime_type: String,
    pub bytes: Vec<u8>,
    pub output_bytes_len: usize,
    pub duration_ms: u64,
}

struct TempOfficeDir(PathBuf);

impl TempOfficeDir {
    fn new() -> CoreResult<Self> {
        let dir = env::temp_dir().join(format!("nexohub-office-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).map_err(|_| CoreError::io())?;
        Ok(Self(dir))
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempOfficeDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn read_u16_le(slice: &[u8]) -> Option<u16> {
    if slice.len() < 2 {
        return None;
    }
    Some(u16::from_le_bytes([slice[0], slice[1]]))
}

fn read_u32_le(slice: &[u8]) -> Option<u32> {
    if slice.len() < 4 {
        return None;
    }
    Some(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn has_unsafe_archive_path(raw_name: &str) -> bool {
    if raw_name.is_empty()
        || raw_name.starts_with('/')
        || raw_name.starts_with('\\')
        || raw_name.contains('\0')
        || raw_name.contains(':')
    {
        return true;
    }
    raw_name.split(['/', '\\']).any(|segment| segment == "..")
}

/// Inspeção estrutural de segurança para OOXML/ODF contra Zip Bomb e path traversal.
pub fn inspect_zip_container_safety(bytes: &[u8]) -> CoreResult<(usize, u64)> {
    if bytes.len() < 22 || !bytes.starts_with(b"PK\x03\x04") {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O arquivo Office não possui assinatura ZIP/OOXML válida.",
        ));
    }

    // Procura EOCD nos últimos 65 KiB + 22 bytes
    let search_start = bytes.len().saturating_sub(65_557);
    let eocd_pos = (search_start..=bytes.len() - 22)
        .rev()
        .find(|&i| &bytes[i..i + 4] == b"PK\x05\x06")
        .ok_or_else(|| {
            CoreError::new(
                ErrorCode::InvalidArgument,
                "Container Office corrompido (EOCD ausente).",
            )
        })?;

    let cd_entries = read_u16_le(&bytes[eocd_pos + 10..eocd_pos + 12]).unwrap_or(0) as usize;
    let cd_size = read_u32_le(&bytes[eocd_pos + 12..eocd_pos + 16]).unwrap_or(0) as usize;
    let cd_offset = read_u32_le(&bytes[eocd_pos + 16..eocd_pos + 20]).unwrap_or(0) as usize;

    if cd_entries == 0 || cd_entries > MAX_ZIP_ENTRIES {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "Número de entradas internas do arquivo Office fora do limite permitido.",
        ));
    }
    let cd_end = cd_offset.checked_add(cd_size).ok_or_else(|| {
        CoreError::new(ErrorCode::InvalidArgument, "Diretório ZIP inválido.")
    })?;
    if cd_end > eocd_pos {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Diretório ZIP inconsistente ou truncado.",
        ));
    }

    let mut cursor = cd_offset;
    let mut parsed_entries = 0usize;
    let mut total_uncompressed = 0u64;

    while cursor + 46 <= cd_end {
        if &bytes[cursor..cursor + 4] != b"PK\x01\x02" {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "Entrada inválida no catálogo ZIP do arquivo Office.",
            ));
        }
        let uncomp_size = read_u32_le(&bytes[cursor + 24..cursor + 28]).unwrap_or(0) as u64;
        let name_len = read_u16_le(&bytes[cursor + 28..cursor + 30]).unwrap_or(0) as usize;
        let extra_len = read_u16_le(&bytes[cursor + 30..cursor + 32]).unwrap_or(0) as usize;
        let comment_len = read_u16_le(&bytes[cursor + 32..cursor + 34]).unwrap_or(0) as usize;

        let header_end = cursor + 46 + name_len + extra_len + comment_len;
        if header_end > cd_end {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "Entrada ZIP truncada.",
            ));
        }

        let name = String::from_utf8_lossy(&bytes[cursor + 46..cursor + 46 + name_len]);
        if has_unsafe_archive_path(&name) {
            return Err(CoreError::new(
                ErrorCode::PermissionDenied,
                "Arquivo Office rejeitado por caminho interno inseguro (path traversal).",
            ));
        }

        total_uncompressed = total_uncompressed
            .checked_add(uncomp_size)
            .ok_or_else(|| CoreError::new(ErrorCode::ResourceLimit, "Tamanho ZIP inválido."))?;
        if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES {
            return Err(CoreError::new(
                ErrorCode::ResourceLimit,
                "Tamanho descompactado do documento excede o limite de segurança (512 MB).",
            ));
        }

        parsed_entries += 1;
        if parsed_entries > MAX_ZIP_ENTRIES {
            return Err(CoreError::new(
                ErrorCode::ResourceLimit,
                "Quantidade de entradas no container excede o limite permitido.",
            ));
        }
        cursor = header_end;
    }

    let compressed_len = (bytes.len() as u64).max(1);
    if total_uncompressed / compressed_len > MAX_ZIP_EXPANSION_RATIO {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "Taxa de expansão do documento sugere Zip Bomb e foi bloqueada.",
        ));
    }

    Ok((parsed_entries, total_uncompressed))
}

fn sanitize_extension(file_name: &str) -> CoreResult<String> {
    if file_name.is_empty()
        || file_name.len() > 220
        || file_name.chars().any(|c| c == '/' || c == '\\' || c == '\0')
    {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Nome de arquivo inválido.",
        ));
    }
    let ext = file_name
        .rsplit_once('.')
        .map(|(_, e)| e.to_ascii_lowercase())
        .ok_or_else(|| {
            CoreError::new(
                ErrorCode::InvalidArgument,
                "Arquivo sem extensão reconhecida para conversão Office.",
            )
        })?;
    Ok(ext)
}

pub fn preflight_office_input(
    kind: OfficeConversionKind,
    file_name: &str,
    bytes: &[u8],
) -> CoreResult<String> {
    if bytes.is_empty() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O arquivo enviado está vazio.",
        ));
    }
    if bytes.len() > MAX_OFFICE_INPUT_BYTES {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "O arquivo ultrapassa o limite de 64 MB para conversão Office.",
        ));
    }

    let ext = sanitize_extension(file_name)?;
    let ole2_magic = [0xD0u8, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

    match (kind, ext.as_str()) {
        (OfficeConversionKind::WordToPdf, "docx" | "odt")
        | (OfficeConversionKind::ExcelToPdf, "xlsx" | "ods")
        | (OfficeConversionKind::PowerPointToPdf, "pptx" | "odp") => {
            inspect_zip_container_safety(bytes)?;
        }
        (OfficeConversionKind::WordToPdf, "doc")
        | (OfficeConversionKind::ExcelToPdf, "xls")
        | (OfficeConversionKind::PowerPointToPdf, "ppt") => {
            if !bytes.starts_with(&ole2_magic) {
                return Err(CoreError::new(
                    ErrorCode::InvalidArgument,
                    "Arquivo binário Office legado inválido.",
                ));
            }
        }
        (OfficeConversionKind::WordToPdf, "rtf") => {
            if !bytes.starts_with(b"{\\rtf") {
                return Err(CoreError::new(
                    ErrorCode::InvalidArgument,
                    "Arquivo RTF inválido.",
                ));
            }
        }
        (OfficeConversionKind::PdfToPowerPoint, "pdf") => {
            if !bytes.starts_with(b"%PDF-") {
                return Err(CoreError::new(
                    ErrorCode::InvalidArgument,
                    "O arquivo enviado não possui cabeçalho PDF válido.",
                ));
            }
        }
        _ => {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                format!("Formato '.{ext}' incompatível com a conversão selecionada."),
            ));
        }
    }

    Ok(ext)
}

/// Resolve o executável `soffice` instalado no Superpoder Office.
#[must_use]
pub fn resolve_office_executable(root: &Path) -> Option<PathBuf> {
    let base = env::var_os("NEXOHUB_OFFICE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("office"));

    let candidates = [
        base.join("program").join("soffice.exe"),
        base.join("program").join("soffice"),
        base.join("soffice.exe"),
        base.join("soffice"),
    ];

    candidates.into_iter().find(|path| path.is_file())
}

fn to_file_url_arg(dir: &Path) -> String {
    let normalized = dunce::canonicalize(dir)
        .unwrap_or_else(|_| dir.to_path_buf())
        .to_string_lossy()
        .replace('\\', "/");
    let prefix = if normalized.starts_with('/') {
        "file://"
    } else {
        "file:///"
    };
    format!("-env:UserInstallation={prefix}{normalized}")
}

pub fn convert_office_bytes(request: &ConvertOfficeRequest) -> CoreResult<ConvertOfficeResult> {
    let ext = preflight_office_input(request.kind, &request.file_name, &request.bytes)?;
    let root = runtime_root();
    let soffice = resolve_office_executable(&root).ok_or_else(|| {
        CoreError::new(
            ErrorCode::CapabilityNotFound,
            "O Superpoder Office (LibreOffice local) ainda não está instalado neste computador.",
        )
    })?;

    let work = TempOfficeDir::new()?;
    let profile_dir = work.path().join("profile");
    let out_dir = work.path().join("out");
    fs::create_dir_all(&profile_dir).map_err(|_| CoreError::io())?;
    fs::create_dir_all(&out_dir).map_err(|_| CoreError::io())?;

    let input_path = work.path().join(format!("input.{ext}"));
    fs::write(&input_path, &request.bytes).map_err(|_| CoreError::io())?;

    let (target_ext, target_mime, extra_args): (&str, &str, &[&str]) = match request.kind {
        OfficeConversionKind::WordToPdf
        | OfficeConversionKind::ExcelToPdf
        | OfficeConversionKind::PowerPointToPdf => ("pdf", "application/pdf", &[]),
        OfficeConversionKind::PdfToPowerPoint => (
            "pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            &["--infilter=impress_pdf_import"],
        ),
    };

    let started = Instant::now();
    let mut cmd = Command::new(&soffice);
    cmd.arg(to_file_url_arg(&profile_dir))
        .arg("--headless")
        .arg("--norestore")
        .arg("--invisible")
        .arg("--nodefault")
        .arg("--nolockcheck")
        .arg("--nologo")
        .args(extra_args)
        .arg("--convert-to")
        .arg(target_ext)
        .arg("--outdir")
        .arg(&out_dir)
        .arg(&input_path)
        .env("HOME", work.path())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|_| {
        CoreError::new(
            ErrorCode::CapabilityNotFound,
            "Não foi possível iniciar o motor local LibreOffice.",
        )
    })?;

    let deadline = Duration::from_secs(SOFFICE_TIMEOUT_SECS);
    let status = loop {
        match child.try_wait() {
            Ok(Some(st)) => break st,
            Ok(None) => {
                if started.elapsed() > deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(CoreError::new(
                        ErrorCode::SidecarTimeout,
                        "A conversão Office excedeu o tempo máximo de 120 segundos.",
                    ));
                }
                std::thread::sleep(Duration::from_millis(40));
            }
            Err(_) => {
                let _ = child.kill();
                return Err(CoreError::io());
            }
        }
    };

    if !status.success() {
        return Err(CoreError::new(
            ErrorCode::PdfProcessing,
            "O motor local não conseguiu converter este documento Office.",
        ));
    }

    let produced_path = out_dir.join(format!("input.{target_ext}"));
    let out_bytes = fs::read(&produced_path).map_err(|_| {
        CoreError::new(
            ErrorCode::PdfProcessing,
            "O documento convertido não foi gerado pelo motor Office.",
        )
    })?;

    if target_ext == "pdf" && (!out_bytes.starts_with(b"%PDF-") || lopdf::Document::load_mem(&out_bytes).is_err()) {
        return Err(CoreError::new(
            ErrorCode::PdfProcessing,
            "O PDF gerado pela conversão Office falhou na validação estrutural.",
        ));
    }
    if target_ext == "pptx" && !out_bytes.starts_with(b"PK\x03\x04") {
        return Err(CoreError::new(
            ErrorCode::PdfProcessing,
            "A apresentação PPTX gerada falhou na validação estrutural.",
        ));
    }

    let stem = request
        .file_name
        .rsplit_once('.')
        .map(|(s, _)| s)
        .unwrap_or(&request.file_name);
    let output_len = out_bytes.len();
    Ok(ConvertOfficeResult {
        file_name: format!("{stem}.{target_ext}"),
        mime_type: target_mime.to_string(),
        bytes: out_bytes,
        output_bytes_len: output_len,
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::Compression;
    use flate2::write::DeflateEncoder;
    use std::io::Write;

    fn build_synthetic_zip(entry_name: &str, uncompressed: &[u8]) -> Vec<u8> {
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
        encoder.write_all(uncompressed).unwrap();
        let compressed = encoder.finish().unwrap();

        let mut buf = Vec::new();
        // Local file header
        buf.extend_from_slice(b"PK\x03\x04");
        buf.extend_from_slice(&20u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&8u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&(compressed.len() as u32).to_le_bytes());
        buf.extend_from_slice(&(uncompressed.len() as u32).to_le_bytes());
        buf.extend_from_slice(&(entry_name.len() as u16).to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(entry_name.as_bytes());
        buf.extend_from_slice(&compressed);

        let cd_offset = buf.len() as u32;
        // Central directory header
        buf.extend_from_slice(b"PK\x01\x02");
        buf.extend_from_slice(&20u16.to_le_bytes());
        buf.extend_from_slice(&20u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&8u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&(compressed.len() as u32).to_le_bytes());
        buf.extend_from_slice(&(uncompressed.len() as u32).to_le_bytes());
        buf.extend_from_slice(&(entry_name.len() as u16).to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(&0u32.to_le_bytes());
        buf.extend_from_slice(entry_name.as_bytes());

        let cd_size = (buf.len() as u32) - cd_offset;
        // EOCD
        buf.extend_from_slice(b"PK\x05\x06");
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes());
        buf.extend_from_slice(&cd_size.to_le_bytes());
        buf.extend_from_slice(&cd_offset.to_le_bytes());
        buf.extend_from_slice(&0u16.to_le_bytes());
        buf
    }

    #[test]
    fn accepts_clean_docx_and_rejects_zip_bomb_or_traversal() {
        let valid_docx = build_synthetic_zip("word/document.xml", b"<w:document/>");
        assert!(preflight_office_input(OfficeConversionKind::WordToPdf, "contrato.docx", &valid_docx).is_ok());

        let traversal = build_synthetic_zip("../../Windows/System32/evil.dll", b"boom");
        let err = preflight_office_input(OfficeConversionKind::WordToPdf, "evil.docx", &traversal).unwrap_err();
        assert_eq!(err.code, ErrorCode::PermissionDenied);

        let giant_payload = vec![b'A'; 400_000];
        let zip_bomb = build_synthetic_zip("word/media/huge.xml", &giant_payload);
        let bomb_err = preflight_office_input(OfficeConversionKind::WordToPdf, "bomb.docx", &zip_bomb).unwrap_err();
        assert_eq!(bomb_err.code, ErrorCode::ResourceLimit);
    }

    #[test]
    fn refuses_mismatched_extension_or_missing_runtime() {
        let zip_bytes = build_synthetic_zip("word/document.xml", b"<w:document/>");
        let mismatch = preflight_office_input(OfficeConversionKind::ExcelToPdf, "errado.docx", &zip_bytes).unwrap_err();
        assert_eq!(mismatch.code, ErrorCode::InvalidArgument);

        let res = convert_office_bytes(&ConvertOfficeRequest {
            project_path: None,
            kind: OfficeConversionKind::WordToPdf,
            file_name: "relatorio.docx".to_string(),
            bytes: zip_bytes,
        });
        if resolve_office_executable(&runtime_root()).is_none() {
            assert_eq!(res.unwrap_err().code, ErrorCode::CapabilityNotFound);
        }
    }
}
