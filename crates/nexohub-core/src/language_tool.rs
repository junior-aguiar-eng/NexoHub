//! Adapter do sidecar LanguageTool Community pt-BR com runtime Java fixado.

use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::hardening::HardeningLimits;
use crate::sidecar::{SensitiveTempDir, SidecarRunError, run_command};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::env;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

const MAX_REVIEW_BYTES: usize = 4 * 1024 * 1024;
const MAX_REVIEW_MATCHES: usize = 100_000;
const MANIFEST: &str = include_str!("../../../runtime/languagetool-community.json");

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewTextRequest {
    pub text: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageToolReplacement {
    pub value: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageToolRule {
    pub id: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub issue_type: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LanguageToolMatch {
    pub message: String,
    #[serde(default)]
    pub short_message: String,
    pub offset: usize,
    pub length: usize,
    #[serde(default)]
    pub replacements: Vec<LanguageToolReplacement>,
    pub rule: LanguageToolRule,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewTextResult {
    pub language: String,
    pub engine: String,
    pub version: String,
    pub matches: Vec<LanguageToolMatch>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallationManifest {
    language: String,
    snapshot: SnapshotManifest,
    java: JavaManifest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotManifest {
    jar: String,
    jar_sha256: String,
    license_file: String,
    third_party_licenses: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JavaManifest {
    executable: String,
    executable_sha256: String,
    license_file: String,
    assembly_exception: String,
}

#[derive(Debug, Deserialize)]
struct RawLanguageToolResponse {
    software: RawSoftware,
    language: RawLanguage,
    matches: Vec<LanguageToolMatch>,
}

#[derive(Debug, Deserialize)]
struct RawSoftware {
    version: String,
    premium: bool,
}

#[derive(Debug, Deserialize)]
struct RawLanguage {
    code: String,
}

pub fn review_text(request: ReviewTextRequest) -> CoreResult<ReviewTextResult> {
    if request.text.is_empty() || request.text.len() > MAX_REVIEW_BYTES {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O texto deve conter entre 1 byte e 4 MiB.",
        ));
    }
    let root = env::var_os("NEXOHUB_LANGUAGETOOL_DIR")
        .map(PathBuf::from)
        .ok_or_else(|| CoreError::review_unavailable("LanguageTool Community não instalado."))?;
    let limits = HardeningLimits::from_env()?;
    let manifest: InstallationManifest = serde_json::from_str(MANIFEST)
        .map_err(|_| CoreError::review_unavailable("Manifesto do LanguageTool inválido."))?;
    let java = verified_component(
        &root,
        &manifest.java.executable,
        &manifest.java.executable_sha256,
    )?;
    let jar = verified_component(&root, &manifest.snapshot.jar, &manifest.snapshot.jar_sha256)?;
    for required in [
        &manifest.snapshot.license_file,
        &manifest.snapshot.third_party_licenses,
        &manifest.java.license_file,
        &manifest.java.assembly_exception,
    ] {
        required_file(&root, required)?;
    }

    let workspace = SensitiveTempDir::create().map_err(|_| CoreError::io())?;
    let input = workspace
        .write_private("input.txt", request.text.as_bytes())
        .map_err(|_| CoreError::io())?;
    let output_path = workspace.path("output.json");
    let mut command = Command::new(java);
    command
        .current_dir(jar.parent().ok_or_else(CoreError::io)?)
        .args(["-Xmx768m", "-jar"])
        .arg(&jar)
        .args([
            "--json",
            "-l",
            &manifest.language,
            "-c",
            "utf-8",
            "--clean-overlapping",
        ])
        .arg(&input);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000);
    }
    let output = run_command(
        &mut command,
        &output_path,
        limits.sidecar_timeout,
        limits.max_sidecar_output_bytes,
    )
    .map_err(|error| match error {
        SidecarRunError::Timeout => CoreError::new(
            ErrorCode::SidecarTimeout,
            "O LanguageTool excedeu o tempo limite e foi encerrado.",
        ),
        SidecarRunError::OutputLimit => CoreError::new(
            ErrorCode::ResourceLimit,
            "A resposta do LanguageTool excedeu o limite configurado.",
        ),
        SidecarRunError::Exit => CoreError::review("O LanguageTool não concluiu a revisão."),
        SidecarRunError::Io => CoreError::review_unavailable(
            "Não foi possível iniciar ou supervisionar o runtime Java do LanguageTool.",
        ),
    })?;
    parse_response(&output, &manifest)
}

fn parse_response(bytes: &[u8], manifest: &InstallationManifest) -> CoreResult<ReviewTextResult> {
    let raw: RawLanguageToolResponse = serde_json::from_slice(bytes)
        .map_err(|_| CoreError::review("Resposta inválida do LanguageTool."))?;
    if raw.software.premium || raw.language.code != manifest.language {
        return Err(CoreError::review(
            "O sidecar retornou engine ou idioma inesperado.",
        ));
    }
    if raw.matches.len() > MAX_REVIEW_MATCHES {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "A revisão excedeu o limite de 100.000 ocorrências.",
        ));
    }
    Ok(ReviewTextResult {
        language: raw.language.code,
        engine: "languagetool-community".to_owned(),
        version: raw.software.version,
        matches: raw.matches,
    })
}

fn verified_component(root: &Path, relative: &str, expected_hash: &str) -> CoreResult<PathBuf> {
    let path = confined_path(root, relative)?;
    let actual = sha256(&path)?;
    if actual != expected_hash {
        return Err(CoreError::review_unavailable(
            "A integridade da instalação do LanguageTool não pôde ser confirmada.",
        ));
    }
    Ok(path)
}

fn required_file(root: &Path, relative: &str) -> CoreResult<PathBuf> {
    let path = confined_path(root, relative)?;
    if !path.is_file() {
        return Err(CoreError::review_unavailable(
            "A instalação não contém todos os avisos de licença obrigatórios.",
        ));
    }
    Ok(path)
}

fn confined_path(root: &Path, relative: &str) -> CoreResult<PathBuf> {
    let canonical_root = dunce::canonicalize(root)
        .map_err(|_| CoreError::review_unavailable("Diretório do LanguageTool inválido."))?;
    let candidate = dunce::canonicalize(canonical_root.join(relative)).map_err(|_| {
        CoreError::review_unavailable("Componente obrigatório do LanguageTool não encontrado.")
    })?;
    if !candidate.starts_with(&canonical_root) {
        return Err(CoreError::review_unavailable(
            "Componente do LanguageTool fora do diretório permitido.",
        ));
    }
    Ok(candidate)
}

fn sha256(path: &Path) -> CoreResult<String> {
    let mut file = File::open(path).map_err(|_| CoreError::io())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|_| CoreError::io())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_community_pt_br_response() {
        let manifest: InstallationManifest = serde_json::from_str(MANIFEST).expect("manifesto");
        let payload = r#"{
          "software":{"version":"6.9-SNAPSHOT","premium":false},
          "language":{"code":"pt-BR"},
          "matches":[{"message":"Palavra repetida","shortMessage":"Repetição","offset":6,
            "length":5,"replacements":[{"value":"um"}],
            "rule":{"id":"PORTUGUESE_WORD_REPEAT_RULE","description":"Repetição","issueType":"duplication"}}]
        }"#;

        let result =
            parse_response(payload.as_bytes(), &manifest).expect("resposta deve ser aceita");

        assert_eq!(result.engine, "languagetool-community");
        assert_eq!(result.language, "pt-BR");
        assert_eq!(result.matches[0].rule.id, "PORTUGUESE_WORD_REPEAT_RULE");
    }

    #[test]
    fn rejects_premium_or_wrong_language_response() {
        let manifest: InstallationManifest = serde_json::from_str(MANIFEST).expect("manifesto");
        let payload = r#"{
          "software":{"version":"x","premium":true},
          "language":{"code":"en-US"},"matches":[]
        }"#;

        assert_eq!(
            parse_response(payload.as_bytes(), &manifest)
                .expect_err("resposta deve falhar")
                .code,
            ErrorCode::ReviewProcessing
        );
    }

    #[test]
    #[ignore = "requer snapshot e Temurin instalados e verificados"]
    fn executes_installed_pt_br_snapshot() {
        let result = review_text(ReviewTextRequest {
            text: "Este é um um texto com erro .".to_owned(),
        })
        .expect("sidecar instalado deve revisar");

        assert_eq!(result.language, "pt-BR");
        assert!(result.version.starts_with("6.9-SNAPSHOT"));
        assert!(
            result
                .matches
                .iter()
                .any(|item| item.rule.id == "PORTUGUESE_WORD_REPEAT_RULE")
        );
    }
}
