//! Valores de lista em nano-USD; arredondamento conservador em micro-USD no final.
use super::{CloudError, ledger::Units, policy::CloudPolicy};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PriceBook {
    pub version: String,
    pub verified_at: u64,
    cpu_nanos_per_vcpu_second: u64,
    memory_nanos_per_gib_second: u64,
    ocr_nanos_per_page: u64,
    translation_nanos_per_character: u64,
    egress_nanos_per_gib: u64,
    storage_nanos_per_gib_second: u64,
    overhead_usd_micros: u64,
    startup_seconds: u64,
    inspection_seconds: u64,
    download_timeout_seconds: u64,
}
impl PriceBook {
    pub fn pilot() -> Result<Self, CloudError> {
        serde_json::from_str(include_str!(
            "../../../../scripts/cloud/hybrid-pricing.json"
        ))
        .map_err(|_| CloudError::PriceUnavailable)
    }
    pub fn estimate(
        &self,
        units: &Units,
        policy: &CloudPolicy,
        now: u64,
    ) -> Result<u64, CloudError> {
        policy
            .validate()
            .map_err(|_| CloudError::PriceUnavailable)?;
        units.validate(policy)?;
        let rates = [
            self.cpu_nanos_per_vcpu_second,
            self.memory_nanos_per_gib_second,
            self.ocr_nanos_per_page,
            self.translation_nanos_per_character,
            self.egress_nanos_per_gib,
            self.storage_nanos_per_gib_second,
            self.overhead_usd_micros,
            self.startup_seconds,
            self.inspection_seconds,
            self.download_timeout_seconds,
        ];
        if self.version.is_empty()
            || rates
                .iter()
                .any(|rate| *rate == 0 || *rate > 1_000_000_000_000)
            || self.startup_seconds > 240
            || self.inspection_seconds > 5
            || self.download_timeout_seconds > 120
            || self.verified_at > now
            || now - self.verified_at > policy.timing.max_price_age_seconds
        {
            return Err(CloudError::PriceUnavailable);
        }
        let processing = if units.ocr_pages > 0 {
            policy.ocr.timeout_seconds
        } else if units.characters > 0 {
            policy.translation.timeout_seconds
        } else {
            policy.office.timeout_seconds
        };
        let seconds = u128::from(self.startup_seconds)
            + u128::from(self.inspection_seconds)
            + u128::from(processing)
            + u128::from(policy.transfer.upload_timeout_seconds)
            + u128::from(self.download_timeout_seconds) * u128::from(policy.transfer.max_downloads);
        let cpu = seconds
            * (2 * u128::from(self.cpu_nanos_per_vcpu_second)
                + 4 * u128::from(self.memory_nanos_per_gib_second));
        let api = u128::from(units.ocr_pages) * u128::from(self.ocr_nanos_per_page)
            + u128::from(units.characters) * u128::from(self.translation_nanos_per_character);
        let gib = 1_073_741_824_u128;
        let egress = (u128::from(policy.transfer.max_download_bytes_per_job)
            * u128::from(self.egress_nanos_per_gib))
        .div_ceil(gib);
        let bytes = u128::from(policy.ocr.max_bytes.max(policy.office.max_input_bytes))
            + u128::from(policy.transfer.max_output_bytes);
        let storage = (bytes
            * (u128::from(policy.retention.result_seconds)
                + u128::from(policy.retention.cleanup_interval_seconds))
            * u128::from(self.storage_nanos_per_gib_second))
        .div_ceil(gib);
        let micros =
            (cpu + api + egress + storage).div_ceil(1000) + u128::from(self.overhead_usd_micros);
        u64::try_from(micros).map_err(|_| CloudError::PriceUnavailable)
    }
}
