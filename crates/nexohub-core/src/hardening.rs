//! Limites defensivos configuráveis do núcleo nativo.

use crate::error::{CoreError, CoreResult, ErrorCode};
use std::env;
use std::time::Duration;

const MIB: u64 = 1024 * 1024;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HardeningLimits {
    pub max_import_bytes: u64,
    pub max_project_artifact_bytes: u64,
    pub max_pdf_input_bytes: u64,
    pub max_pdf_pages: usize,
    pub max_pdf_objects: usize,
    pub sidecar_timeout: Duration,
    pub max_sidecar_output_bytes: u64,
}

impl Default for HardeningLimits {
    fn default() -> Self {
        Self {
            max_import_bytes: 512 * MIB,
            max_project_artifact_bytes: 20 * 1024 * MIB,
            max_pdf_input_bytes: 256 * MIB,
            max_pdf_pages: 1_000,
            max_pdf_objects: 250_000,
            sidecar_timeout: Duration::from_secs(120),
            max_sidecar_output_bytes: 16 * MIB,
        }
    }
}

impl HardeningLimits {
    pub fn from_env() -> CoreResult<Self> {
        let defaults = Self::default();
        Ok(Self {
            max_import_bytes: env_u64(
                "NEXOHUB_MAX_IMPORT_BYTES",
                defaults.max_import_bytes,
                MIB,
                2 * 1024 * MIB,
            )?,
            max_project_artifact_bytes: env_u64(
                "NEXOHUB_MAX_PROJECT_ARTIFACT_BYTES",
                defaults.max_project_artifact_bytes,
                512 * MIB,
                2 * 1024 * 1024 * MIB,
            )?,
            max_pdf_input_bytes: env_u64(
                "NEXOHUB_MAX_PDF_INPUT_BYTES",
                defaults.max_pdf_input_bytes,
                MIB,
                1024 * MIB,
            )?,
            max_pdf_pages: usize::try_from(env_u64(
                "NEXOHUB_MAX_PDF_PAGES",
                defaults.max_pdf_pages as u64,
                1,
                10_000,
            )?)
            .map_err(|_| invalid_limit("NEXOHUB_MAX_PDF_PAGES"))?,
            max_pdf_objects: usize::try_from(env_u64(
                "NEXOHUB_MAX_PDF_OBJECTS",
                defaults.max_pdf_objects as u64,
                1_000,
                1_000_000,
            )?)
            .map_err(|_| invalid_limit("NEXOHUB_MAX_PDF_OBJECTS"))?,
            sidecar_timeout: Duration::from_millis(env_u64(
                "NEXOHUB_SIDECAR_TIMEOUT_MS",
                defaults.sidecar_timeout.as_millis() as u64,
                1_000,
                60 * 60 * 1_000,
            )?),
            max_sidecar_output_bytes: env_u64(
                "NEXOHUB_MAX_SIDECAR_OUTPUT_BYTES",
                defaults.max_sidecar_output_bytes,
                64 * 1024,
                64 * MIB,
            )?,
        })
    }
}

fn env_u64(name: &'static str, default: u64, minimum: u64, maximum: u64) -> CoreResult<u64> {
    let Some(raw) = env::var_os(name) else {
        return Ok(default);
    };
    let value = raw
        .to_str()
        .and_then(|text| text.parse::<u64>().ok())
        .filter(|value| (minimum..=maximum).contains(value))
        .ok_or_else(|| invalid_limit(name))?;
    Ok(value)
}

fn invalid_limit(name: &'static str) -> CoreError {
    CoreError::new(
        ErrorCode::InvalidArgument,
        format!("O limite configurado em {name} é inválido."),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_finite_and_ordered() {
        let limits = HardeningLimits::default();
        assert_eq!(limits.max_import_bytes, 512 * MIB);
        assert_eq!(limits.max_project_artifact_bytes, 20 * 1024 * MIB);
        assert!(limits.max_pdf_input_bytes <= limits.max_import_bytes);
        assert_eq!(limits.max_pdf_pages, 1_000);
        assert_eq!(limits.max_pdf_objects, 250_000);
        assert!(limits.sidecar_timeout >= Duration::from_secs(1));
    }
}
