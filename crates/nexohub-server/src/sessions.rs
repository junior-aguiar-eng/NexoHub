//! Credenciais efêmeras vinculadas exclusivamente a projetos alocados pelo servidor.

use nexohub_core::{CoreError, ErrorCode};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tempfile::TempDir;
use uuid::Uuid;

pub(crate) const SESSION_HEADER: &str = "x-nexohub-session";
const SESSION_IDLE_LIMIT: Duration = Duration::from_secs(1800);

#[derive(Clone, Default)]
pub(crate) struct Sessions {
    entries: Arc<Mutex<HashMap<String, Entry>>>,
}

struct Entry {
    session: Arc<Session>,
    last_used: Instant,
}

pub(crate) struct Session {
    // O diretório permanece vivo durante requisições em andamento, mesmo após expiração.
    _directory: TempDir,
    pub(crate) project_path: PathBuf,
}

fn storage_error() -> CoreError {
    CoreError::new(
        ErrorCode::StorageIo,
        "Não foi possível acessar o armazenamento da sessão.",
    )
}

fn denied() -> CoreError {
    CoreError::new(
        ErrorCode::PermissionDenied,
        "Acesso negado ao projeto desta sessão.",
    )
}

impl Sessions {
    pub(crate) fn allocate(&self) -> Result<(String, Arc<Session>), CoreError> {
        let root = std::env::temp_dir().join("nexohub-sessions");
        std::fs::create_dir_all(&root).map_err(|_| storage_error())?;
        let directory = tempfile::Builder::new()
            .prefix("session-")
            .tempdir_in(root)
            .map_err(|_| storage_error())?;
        let project_path = dunce::canonicalize(directory.path())
            .map_err(|_| storage_error())?
            .join("sessao.nexohub");
        // Concessões sempre se originam de um caminho gerado aqui, nunca do payload HTTP.
        nexohub_core::grant_broker::grant_path(&project_path)?;
        let session = Arc::new(Session {
            _directory: directory,
            project_path,
        });
        let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        let mut entries = self.entries.lock().map_err(|_| storage_error())?;
        entries.retain(|_, entry| entry.last_used.elapsed() < SESSION_IDLE_LIMIT);
        entries.insert(
            token.clone(),
            Entry {
                session: session.clone(),
                last_used: Instant::now(),
            },
        );
        Ok((token, session))
    }

    pub(crate) fn authorize(&self, token: &str, path: &str) -> Result<Arc<Session>, CoreError> {
        let session = {
            let mut entries = self.entries.lock().map_err(|_| storage_error())?;
            entries.retain(|_, entry| entry.last_used.elapsed() < SESSION_IDLE_LIMIT);
            let entry = entries.get_mut(token).ok_or_else(denied)?;
            entry.last_used = Instant::now();
            entry.session.clone()
        };
        let path = Path::new(path);
        let canonical = dunce::canonicalize(path)
            .or_else(|_| {
                let parent = path.parent().ok_or_else(denied)?;
                let name = path.file_name().ok_or_else(denied)?;
                Ok::<_, CoreError>(
                    dunce::canonicalize(parent)
                        .map_err(|_| denied())?
                        .join(name),
                )
            })
            .map_err(|_| denied())?;
        if canonical != session.project_path {
            return Err(denied());
        }
        Ok(session)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expired_session_is_denied_and_removed_after_inflight_request_finishes() {
        let sessions = Sessions::default();
        let (token, session) = sessions.allocate().unwrap();
        let path = session.project_path.clone();
        let directory = path.parent().unwrap().to_path_buf();
        sessions
            .entries
            .lock()
            .unwrap()
            .get_mut(&token)
            .unwrap()
            .last_used = Instant::now() - SESSION_IDLE_LIMIT;
        assert!(sessions.authorize(&token, path.to_str().unwrap()).is_err());
        assert!(directory.exists());
        drop(session);
        assert!(!directory.exists());
    }
}
