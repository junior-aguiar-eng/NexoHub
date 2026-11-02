use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use nexohub_server::cloud::{
    CloudError,
    admission::AdmissionService,
    auth::{AccountStatus, FirebaseVerifier, IdentityAuthority, PublicKeys},
    desktop::DesktopHandoff,
    ledger::Ledger,
    policy::CloudPolicy,
    pricing::PriceBook,
    quote_api::QuoteApi,
    routes::{CloudIdentityServices, router},
};
use serde_json::{Value, json};
use std::sync::Arc;
use tower::ServiceExt;

mod common;

struct Authority;
impl IdentityAuthority for Authority {
    fn public_keys(&self) -> Result<PublicKeys, CloudError> {
        let f: Value =
            serde_json::from_str(include_str!("fixtures/firebase-synthetic.json")).unwrap();
        Ok(PublicKeys {
            jwks: f["jwks"].clone(),
            max_age_seconds: 60,
        })
    }
    fn account_status(&self, uid: &str) -> Result<AccountStatus, CloudError> {
        Ok(AccountStatus {
            uid: uid.into(),
            email: "person@example.invalid".into(),
            email_verified: true,
            disabled: false,
            valid_since: 0,
        })
    }
}

async fn call(
    app: &axum::Router,
    method: &str,
    uri: &str,
    token: &str,
    body: Option<Value>,
    raw: Option<&'static [u8]>,
) -> (StatusCode, Value) {
    let mut request = Request::builder()
        .method(method)
        .uri(uri)
        .header("Authorization", format!("Bearer {token}"));
    let payload = match (body, raw) {
        (Some(v), _) => {
            request = request.header("content-type", "application/json");
            Body::from(v.to_string())
        }
        (None, Some(bytes)) => Body::from(bytes),
        _ => Body::empty(),
    };
    let response = app
        .clone()
        .oneshot(request.body(payload).unwrap())
        .await
        .unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn quote_to_job_flow_reserves_once_and_cancel_releases() {
    let identity = common::identity();
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite(identity.email(), common::now()).unwrap();
    let prices = PriceBook::pilot().unwrap().verified_at(common::now());
    let services = Arc::new(CloudIdentityServices {
        verifier: FirebaseVerifier::new("demo-nexohub-hybrid", Arc::new(Authority)).unwrap(),
        admission,
        ledger: Ledger::new(store.clone(), policy.clone()),
        desktop: DesktopHandoff::new(store),
        quotes: QuoteApi::with_prices(&policy, prices).unwrap(),
        policy,
        origins: vec!["https://nexojuris.ia.br".into()],
        clock: || Ok(common::now()),
    });
    let f: Value = serde_json::from_str(include_str!("fixtures/firebase-synthetic.json")).unwrap();
    let token = f["tokens"]["google"].as_str().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let app = router(Some(services.clone()));
        // A conta é admitida ao carregar /me, como no fluxo real.
        let (status, _) = call(&app, "GET", "/me", token, None, None).await;
        assert_eq!(status, StatusCode::OK);
        let (status, quote) = call(
            &app, "POST", "/quotes", token,
            Some(json!({"tool":"translate-text","mime":"text/plain","declaredBytes":3,"pages":0,"characters":3})),
            None,
        ).await;
        assert_eq!(status, StatusCode::OK, "{quote}");
        let id = quote["quoteId"].as_str().unwrap().to_owned();

        // Sem inspeção não há como confirmar.
        let (status, _) = call(&app, "POST", "/jobs", token, Some(json!({"quoteId": id})), None).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);

        let (s, _) = call(&app, "POST", &format!("/quotes/{id}/authorize-upload"), token, Some(json!({"confirmed": true})), None).await;
        assert_eq!(s, StatusCode::OK);
        let (s, _) = call(&app, "PUT", &format!("/quotes/{id}/input"), token, None, Some(b"abc")).await;
        assert_eq!(s, StatusCode::OK);
        let (s, _) = call(&app, "POST", &format!("/quotes/{id}/inspect"), token, None, None).await;
        assert_eq!(s, StatusCode::OK);

        let (s, job) = call(&app, "POST", "/jobs", token, Some(json!({"quoteId": id})), None).await;
        assert_eq!(s, StatusCode::OK, "{job}");
        assert_eq!(job["state"], "queued");
        let job_id = job["jobId"].as_str().unwrap().to_owned();
        let (s, again) = call(&app, "POST", "/jobs", token, Some(json!({"quoteId": id})), None).await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(again["jobId"], job["jobId"]); // reenvio não reserva de novo

        let (_, usage) = call(&app, "GET", "/usage", token, None, None).await;
        assert!(usage["budgetUsdMicros"]["reserved"].as_u64().unwrap() > 0);
        assert_eq!(usage["translationCharacters"]["reserved"], 3);

        let (s, view) = call(&app, "GET", &format!("/jobs/{job_id}"), token, None, None).await;
        assert_eq!((s, view["state"].as_str()), (StatusCode::OK, Some("queued")));
        let (s, _) = call(&app, "GET", &format!("/jobs/{}", "0".repeat(64)), token, None, None).await;
        assert_eq!(s, StatusCode::BAD_REQUEST);

        let (s, cancelled) = call(&app, "POST", &format!("/jobs/{job_id}/cancel"), token, None, None).await;
        assert_eq!(s, StatusCode::OK);
        assert_eq!(cancelled["state"], "cancelled");
        let (_, usage) = call(&app, "GET", "/usage", token, None, None).await;
        assert_eq!(usage["budgetUsdMicros"]["reserved"], 0);
        assert_eq!(usage["translationCharacters"]["reserved"], 0);
    });
}
