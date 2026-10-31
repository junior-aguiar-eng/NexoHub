use nexohub_core::{
    CoreError, ErrorCode,
    cloud_identity::{self},
};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use tauri::Manager;
static GENERATION: AtomicU64 = AtomicU64::new(0);
static LOGIN_PENDING: AtomicBool = AtomicBool::new(false);
static VAULT_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
fn unavailable() -> CoreError {
    CoreError::new(ErrorCode::PermissionDenied, "CLOUD_DISABLED")
}
fn vault(app: &tauri::AppHandle) -> Result<std::path::PathBuf, CoreError> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|_| unavailable())?
        .join("cloud-session.dpapi"))
}
#[tauri::command]
pub async fn cloud_identity_sign_in(
    app: tauri::AppHandle,
    method: String,
) -> Result<(), CoreError> {
    if !cloud_identity::IDENTITY_ENABLED {
        return Err(unavailable());
    }
    if LOGIN_PENDING.swap(true, Ordering::AcqRel) {
        return Err(CoreError::new(ErrorCode::ResourceLimit, "AUTH_BUSY"));
    }
    let generation = GENERATION.load(Ordering::Acquire);
    tauri::async_runtime::spawn_blocking(move || {
        struct Reset;
        impl Drop for Reset {
            fn drop(&mut self) {
                LOGIN_PENDING.store(false, Ordering::Release);
            }
        }
        let _reset = Reset;
        let login = cloud_identity::NativeLogin::begin()?;
        #[cfg(windows)]
        cloud_identity::open_browser(&login.browser_url(&method)?)?;
        #[cfg(not(windows))]
        {
            let _ = method;
            return Err(unavailable());
        }
        let session = cloud_identity::finish_login(login)?;
        let _lock = VAULT_LOCK.lock().map_err(|_| unavailable())?;
        if GENERATION.load(Ordering::Acquire) != generation {
            return Err(unavailable());
        }
        cloud_identity::SessionVault::new(vault(&app)?).save(&session)
    })
    .await
    .map_err(|_| unavailable())?
}
#[tauri::command]
pub async fn cloud_identity_get_token(app: tauri::AppHandle) -> Result<Option<String>, CoreError> {
    if !cloud_identity::IDENTITY_ENABLED {
        return Ok(None);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = VAULT_LOCK.lock().map_err(|_| unavailable())?;
        let path = vault(&app)?;
        let storage = cloud_identity::SessionVault::new(path);
        let Some(mut session) = storage.load()? else {
            return Ok(None);
        };
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| unavailable())?
            .as_secs();
        if cloud_identity::token_needs_refresh(&session.id_token, now) {
            session = cloud_identity::refresh_session(&session)?;
            storage.save(&session)?;
        }
        Ok(Some(session.id_token))
    })
    .await
    .map_err(|_| unavailable())?
}
#[tauri::command]
pub async fn cloud_identity_sign_out(app: tauri::AppHandle) -> Result<(), CoreError> {
    tauri::async_runtime::spawn_blocking(move || {
        let _lock = VAULT_LOCK.lock().map_err(|_| unavailable())?;
        GENERATION.fetch_add(1, Ordering::AcqRel);
        cloud_identity::SessionVault::new(vault(&app)?).clear()?;
        Ok(())
    })
    .await
    .map_err(|_| unavailable())?
}

#[tauri::command]
pub async fn cloud_account_request(
    app: tauri::AppHandle,
    operation: String,
) -> Result<serde_json::Value, CoreError> {
    let token = if operation == "status" {
        None
    } else {
        cloud_identity_get_token(app).await?
    };
    tauri::async_runtime::spawn_blocking(move || {
        cloud_identity::account_request(&operation, token.as_deref())
    })
    .await
    .map_err(|_| unavailable())?
}
