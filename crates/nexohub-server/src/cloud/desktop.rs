//! Passagem curta entre navegador e instância Windows. Persiste somente envelope cifrado.
use super::{
    CloudError,
    admission::{hash, read, write},
    firestore::FirestoreStore,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DesktopCodeRequest {
    pub challenge: String,
    pub state: String,
    pub envelope: Value,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuedCode {
    pub code: String,
    pub expires_at: u64,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct StoredCode {
    challenge: String,
    state: String,
    envelope: Value,
    expires_at: u64,
    consumed: bool,
}
pub fn hex(value: &str, length: usize) -> bool {
    value.len() == length && value.bytes().all(|b| b.is_ascii_hexdigit())
}
fn envelope_valid(value: &Value) -> bool {
    value.as_object().is_some_and(|v| v.len() == 3)
        && [
            ("wrappedKey", 512, 512),
            ("nonce", 24, 24),
            ("ciphertext", 32, 65_536),
        ]
        .into_iter()
        .all(|(key, min, max)| {
            value[key].as_str().is_some_and(|v| {
                v.len() >= min
                    && v.len() <= max
                    && v.len() % 2 == 0
                    && v.bytes().all(|b| b.is_ascii_hexdigit())
            })
        })
}
pub struct DesktopHandoff {
    store: Arc<FirestoreStore>,
}
impl DesktopHandoff {
    pub fn new(store: Arc<FirestoreStore>) -> Self {
        Self { store }
    }
    pub fn issue(
        &self,
        participant: &str,
        request: &DesktopCodeRequest,
        now: u64,
    ) -> Result<IssuedCode, CloudError> {
        if !hex(participant, 32)
            || !hex(&request.challenge, 64)
            || !hex(&request.state, 64)
            || !envelope_valid(&request.envelope)
        {
            return Err(CloudError::InvalidRequest);
        }
        let code = format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        );
        let path = format!("desktopCodes/{}", hash(&code));
        let limit = format!("participants/{participant}/state/login");
        let expires_at = now.checked_add(60).ok_or(CloudError::InvalidRequest)?;
        self.store
            .transact(&[path.clone(), limit.clone()], |docs| {
                if docs.contains_key(&path) {
                    return Err(CloudError::Conflict);
                }
                let recent = docs
                    .get(&limit)
                    .filter(|v| v["window"].as_u64() == Some(now / 60));
                let count = recent
                    .map(|v| v["count"].as_u64().ok_or(CloudError::Unavailable))
                    .transpose()?
                    .unwrap_or(0);
                if count >= 5 {
                    return Err(CloudError::Busy);
                }
                docs.insert(
                    limit.clone(),
                    serde_json::json!({"window":now/60,"count":count+1}),
                );
                write(
                    docs,
                    &path,
                    &StoredCode {
                        challenge: request.challenge.clone(),
                        state: request.state.clone(),
                        envelope: request.envelope.clone(),
                        expires_at,
                        consumed: false,
                    },
                )
            })?;
        Ok(IssuedCode { code, expires_at })
    }
    pub fn exchange(
        &self,
        code: &str,
        verifier: &str,
        state: &str,
        now: u64,
    ) -> Result<Value, CloudError> {
        if !hex(code, 64) || !hex(verifier, 64) || !hex(state, 64) {
            return Err(CloudError::Unauthorized);
        }
        let path = format!("desktopCodes/{}", hash(code));
        self.store.transact(std::slice::from_ref(&path), |docs| {
            let mut record: StoredCode = read(docs, &path).map_err(|_| CloudError::Unauthorized)?;
            if record.consumed
                || now >= record.expires_at
                || record.state != state
                || record.challenge != hash(verifier)
            {
                return Err(CloudError::Unauthorized);
            }
            let envelope = record.envelope.clone();
            record.consumed = true;
            record.envelope = Value::Null;
            write(docs, &path, &record)?;
            Ok(envelope)
        })
    }
}
