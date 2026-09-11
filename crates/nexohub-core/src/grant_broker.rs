//! Broker de concessão de caminhos de arquivos para mitigar acesso arbitrário do renderer.
//!
//! Exige que qualquer caminho acessado pelo Document Core tenha sido previamente
//! selecionado pelo usuário através de um diálogo nativo ou pertença a um projeto concedido.

use crate::error::{CoreError, CoreResult, ErrorCode};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{LazyLock, RwLock};

static GRANTED_PATHS: LazyLock<RwLock<HashSet<PathBuf>>> =
    LazyLock::new(|| RwLock::new(HashSet::new()));

/// Registra um caminho como expressamente concedido pelo usuário.
pub fn grant_path(path: impl AsRef<Path>) -> CoreResult<PathBuf> {
    let canonical = validate_path(path.as_ref())?;
    let mut lock = GRANTED_PATHS
        .write()
        .map_err(|_| CoreError::new(ErrorCode::StorageIo, "Falha no lock de concessões."))?;
    lock.insert(canonical.clone());
    Ok(canonical)
}

/// Verifica se um caminho foi concedido diretamente ou se está contido em um diretório concedido.
#[must_use]
pub fn is_granted(path: impl AsRef<Path>) -> bool {
    let Ok(canonical) = validate_path(path.as_ref()) else {
        return false;
    };
    let Ok(lock) = GRANTED_PATHS.read() else {
        return false;
    };

    if lock.contains(&canonical) {
        return true;
    }

    // Verifica se algum diretório pai foi concedido (ex: o diretório do projeto .nexohub)
    for ancestor in canonical.ancestors().skip(1) {
        if lock.contains(ancestor) {
            return true;
        }
    }

    false
}

/// Exige que o caminho seja concedido, retornando seu caminho canônico ou erro `PermissionDenied`.
pub fn require_granted(path: impl AsRef<Path>) -> CoreResult<PathBuf> {
    let canonical = validate_path(path.as_ref())?;
    if is_granted(&canonical) {
        Ok(canonical)
    } else {
        Err(CoreError::new(
            ErrorCode::PermissionDenied,
            format!(
                "Acesso negado: o caminho '{}' não foi concedido por diálogo do usuário.",
                path.as_ref().display()
            ),
        ))
    }
}

/// Revoga todas as concessões em memória (usado em testes e encerramentos).
pub fn revoke_all() {
    if let Ok(mut lock) = GRANTED_PATHS.write() {
        lock.clear();
    }
}

/// Sanitiza e valida o caminho antes do registro.
fn validate_path(path: &Path) -> CoreResult<PathBuf> {
    if path.as_os_str().is_empty() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "Caminho não pode ser vazio.",
        ));
    }

    // Resolve componentes e normaliza no Windows sem prefixos longos UNC incompatíveis via dunce
    let canonical = dunce::canonicalize(path).or_else(|_| {
        // Se o arquivo/pasta ainda não existe (ex: criação de novo projeto), normaliza a partir do diretório pai existente
        if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
            let canonical_parent = dunce::canonicalize(parent).map_err(|_| {
                CoreError::new(
                    ErrorCode::InvalidArgument,
                    format!("Diretório pai inválido: {}", parent.display()),
                )
            })?;
            if let Some(name) = path.file_name() {
                return Ok(canonical_parent.join(name));
            }
        }
        Err(CoreError::new(
            ErrorCode::InvalidArgument,
            format!("Caminho inexistente ou inacessível: {}", path.display()),
        ))
    })?;

    // Bloqueia raízes críticas do sistema (Windows e genérico)
    let path_str = canonical.to_string_lossy().to_lowercase();
    if path_str.starts_with("c:\\windows")
        || path_str.starts_with("c:\\program files")
        || path_str.starts_with("c:\\program files (x86)")
        || path_str == "c:\\"
        || path_str == "/"
    {
        return Err(CoreError::new(
            ErrorCode::PermissionDenied,
            "Acesso a diretórios de sistema operacional é estritamente proibido.",
        ));
    }

    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn grants_and_verifies_path() {
        revoke_all();
        let temp_dir = std::env::temp_dir().join(format!("nexohub-grant-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).expect("temp dir");

        let canonical = grant_path(&temp_dir).expect("grant path");
        assert!(is_granted(&canonical));
        assert!(is_granted(&temp_dir));

        let subfile = temp_dir.join("arquivo.pdf");
        fs::write(&subfile, b"teste").expect("write subfile");
        assert!(is_granted(&subfile));

        let not_granted = std::env::temp_dir().join(format!("outro-{}", Uuid::new_v4()));
        assert!(!is_granted(&not_granted));
        assert!(require_granted(&not_granted).is_err());

        let _ = fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn rejects_empty_path() {
        assert!(grant_path("").is_err());
    }
}
