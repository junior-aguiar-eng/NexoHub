//! Rotas preparadas; create_app sempre injeta None e não constrói credenciais ou clientes reais.
use super::{
    CloudError,
    admission::AdmissionService,
    auth::{FirebaseVerifier, VerifiedIdentity},
    desktop::{DesktopCodeRequest, DesktopHandoff},
    ledger::Ledger,
    policy::CloudPolicy,
};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::Deserialize;
use serde_json::json;
use std::{
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
pub struct CloudIdentityServices {
    pub verifier: FirebaseVerifier,
    pub admission: AdmissionService,
    pub ledger: Ledger,
    pub desktop: DesktopHandoff,
    pub policy: CloudPolicy,
    pub origins: Vec<String>,
    pub clock: fn() -> Result<u64, CloudError>,
}
type Runtime = Option<Arc<CloudIdentityServices>>;
impl IntoResponse for CloudError {
    fn into_response(self) -> Response {
        let (status, code) = match self {
            Self::Unauthorized | Self::Revoked => (StatusCode::UNAUTHORIZED, "AUTH_REQUIRED"),
            Self::Unverified => (StatusCode::FORBIDDEN, "EMAIL_UNVERIFIED"),
            Self::Disabled | Self::NotAdmitted => {
                (StatusCode::FORBIDDEN, "PARTICIPANT_NOT_ADMITTED")
            }
            Self::QuotaExceeded => (StatusCode::TOO_MANY_REQUESTS, "QUOTA_EXCEEDED"),
            Self::BudgetExceeded => (StatusCode::TOO_MANY_REQUESTS, "GLOBAL_BUDGET_EXCEEDED"),
            Self::Busy => (StatusCode::TOO_MANY_REQUESTS, "JOB_BUSY"),
            Self::Unavailable | Self::PriceUnavailable => {
                (StatusCode::SERVICE_UNAVAILABLE, "CLOUD_DISABLED")
            }
            _ => (StatusCode::BAD_REQUEST, "INVALID_REQUEST"),
        };
        (
            status,
            [
                (header::CACHE_CONTROL, "no-store"),
                (header::REFERRER_POLICY, "no-referrer"),
            ],
            Json(json!({"code":code,"message":self.to_string()})),
        )
            .into_response()
    }
}
pub fn system_clock() -> Result<u64, CloudError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|n| n.as_secs())
        .map_err(|_| CloudError::Unavailable)
}
fn runtime(
    runtime: Runtime,
    headers: &HeaderMap,
) -> Result<Arc<CloudIdentityServices>, CloudError> {
    let services = runtime.ok_or(CloudError::Unavailable)?;
    // Navegador somente da origem autorizada; clientes nativos sem Origin usam Bearer/PKCE.
    if let Some(origin) = headers.get(header::ORIGIN) {
        let origin = origin.to_str().map_err(|_| CloudError::Unauthorized)?;
        if !services.origins.iter().any(|allowed| allowed == origin) {
            return Err(CloudError::Unauthorized);
        }
    }
    Ok(services)
}
fn principal(
    s: &CloudIdentityServices,
    h: &HeaderMap,
    t: u64,
) -> Result<VerifiedIdentity, CloudError> {
    let token = h
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(CloudError::Unauthorized)?;
    s.verifier.authenticate(token, t)
}
async fn status(State(runtime): State<Runtime>) -> Response {
    (
        [(header::CACHE_CONTROL, "no-store")],
        Json(json!({"enabled":false,"identityAvailable":runtime.is_some()})),
    )
        .into_response()
}
async fn me(State(state): State<Runtime>, headers: HeaderMap) -> Result<Response, CloudError> {
    let s = runtime(state, &headers)?;
    tokio::task::spawn_blocking(move || {
        let t = (s.clock)()?;
        let identity = principal(&s, &headers, t)?;
        let member = s.admission.admit(&identity, t)?;
        Ok((
            [(header::CACHE_CONTROL, "no-store")],
            Json(json!({"participantId":member.id,"admitted":true,"emailVerified":true})),
        )
            .into_response())
    })
    .await
    .map_err(|_| CloudError::Unavailable)?
}
async fn usage(State(state): State<Runtime>, headers: HeaderMap) -> Result<Response, CloudError> {
    let s = runtime(state, &headers)?;
    tokio::task::spawn_blocking(move||{let t=(s.clock)()?;let identity=principal(&s,&headers,t)?;let u=s.ledger.usage(&identity,t)?;
        let balance=|used:u64,reserved:u64,max:u64|json!({"used":used,"reserved":reserved,"remaining":max.saturating_sub(used.saturating_add(reserved))});
        Ok(([(header::CACHE_CONTROL,"no-store")],Json(json!({"ocrPages":balance(u.used.ocr_pages,u.reserved.ocr_pages,s.policy.ocr.monthly_pages),"translationCharacters":balance(u.used.characters,u.reserved.characters,s.policy.translation.monthly_characters),"officeFiles":balance(u.used.office_files,u.reserved.office_files,s.policy.office.monthly_files),"budgetUsdMicros":balance(u.used_usd_micros,u.reserved_usd_micros,s.policy.budget.participant_usd_micros),"resetAt":chrono::DateTime::from_timestamp(i64::try_from(u.reset_at).map_err(|_|CloudError::Unavailable)?,0).ok_or(CloudError::Unavailable)?.to_rfc3339()}))).into_response())
    }).await.map_err(|_|CloudError::Unavailable)?
}
async fn code(
    State(state): State<Runtime>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Response, CloudError> {
    let s = runtime(state, &headers)?;
    let request: DesktopCodeRequest =
        serde_json::from_slice(&body).map_err(|_| CloudError::InvalidRequest)?;
    tokio::task::spawn_blocking(move || {
        let t = (s.clock)()?;
        let identity = principal(&s, &headers, t)?;
        let member = s.admission.member(&identity)?;
        let issued = s.desktop.issue(&member.id, &request, t)?;
        Ok(([(header::CACHE_CONTROL, "no-store")], Json(issued)).into_response())
    })
    .await
    .map_err(|_| CloudError::Unavailable)?
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Exchange {
    code: String,
    verifier: String,
    state: String,
}
async fn exchange(
    State(state): State<Runtime>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> Result<Response, CloudError> {
    let s = runtime(state, &headers)?;
    let request: Exchange =
        serde_json::from_slice(&body).map_err(|_| CloudError::InvalidRequest)?;
    tokio::task::spawn_blocking(move || {
        let value = s.desktop.exchange(
            &request.code,
            &request.verifier,
            &request.state,
            (s.clock)()?,
        )?;
        Ok(([(header::CACHE_CONTROL, "no-store")], Json(value)).into_response())
    })
    .await
    .map_err(|_| CloudError::Unavailable)?
}
pub fn router(runtime: Runtime) -> Router {
    Router::new()
        .route("/status", get(status))
        .route("/me", get(me))
        .route("/usage", get(usage))
        .route("/auth/desktop/code", post(code))
        .route("/auth/desktop/exchange", post(exchange))
        .layer(DefaultBodyLimit::max(70 * 1024))
        .with_state(runtime)
}
