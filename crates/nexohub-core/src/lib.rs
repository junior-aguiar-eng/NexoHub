//! Fronteira do núcleo nativo de aplicação do NexoHub.

mod blob_store;
pub mod commands;
pub mod domain;
pub mod error;
mod migrations;
pub mod pdf_tools;
pub mod storage;
pub mod text_tools;

pub use error::{CoreError, CoreResult, ErrorCode};
pub use storage::ProjectStore;

/// Identifica o núcleo nativo em diagnósticos sem expor capacidades nativas.
#[must_use]
pub const fn component_name() -> &'static str {
    "nexohub-core"
}

#[cfg(test)]
mod tests {
    use super::component_name;

    #[test]
    fn exposes_stable_component_name() {
        assert_eq!(component_name(), "nexohub-core");
    }
}
