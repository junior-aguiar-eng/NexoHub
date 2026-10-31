use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use tower::ServiceExt;
#[tokio::test]
async fn production_cloud_routes_are_registered_but_disabled_without_credentials() {
    for (method, path) in [
        ("GET", "/api/v1/cloud/status"),
        ("GET", "/api/v1/cloud/me"),
        ("GET", "/api/v1/cloud/usage"),
        ("POST", "/api/v1/cloud/auth/desktop/code"),
        ("POST", "/api/v1/cloud/auth/desktop/exchange"),
    ] {
        let response = nexohub_server::create_app(None)
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(path)
                    .header("content-type", "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        if path.ends_with("status") {
            assert_eq!(response.status(), StatusCode::OK);
            let bytes = response.into_body().collect().await.unwrap().to_bytes();
            assert_eq!(
                serde_json::from_slice::<serde_json::Value>(&bytes).unwrap()["enabled"],
                false
            );
        } else {
            assert_eq!(response.status(), StatusCode::SERVICE_UNAVAILABLE, "{path}");
        }
    }
}

mod common;
#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn identity_routes_validate_token_origin_invitation_and_shared_balance() {
    use nexohub_server::cloud::{
        CloudError,
        admission::AdmissionService,
        auth::{AccountStatus, FirebaseVerifier, IdentityAuthority, PublicKeys},
        desktop::DesktopHandoff,
        ledger::Ledger,
        policy::CloudPolicy,
        routes::{CloudIdentityServices, router},
    };
    use serde_json::Value;
    use std::sync::Arc;
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
    let identity = common::identity();
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite(identity.email(), common::now()).unwrap();
    let services = Arc::new(CloudIdentityServices {
        verifier: FirebaseVerifier::new("demo-nexohub-hybrid", Arc::new(Authority)).unwrap(),
        admission,
        ledger: Ledger::new(store.clone(), policy.clone()),
        desktop: DesktopHandoff::new(store),
        policy,
        origins: vec!["https://nexojuris.ia.br".into()],
        clock: || Ok(common::now()),
    });
    let f: Value = serde_json::from_str(include_str!("fixtures/firebase-synthetic.json")).unwrap();
    let token = f["tokens"]["google"].as_str().unwrap();
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let app = router(Some(services.clone()));
        for (auth, origin, expected) in [
            (None, None, StatusCode::UNAUTHORIZED),
            (Some("forged"), None, StatusCode::UNAUTHORIZED),
            (
                Some(token),
                Some("https://evil.invalid"),
                StatusCode::UNAUTHORIZED,
            ),
            (Some(token), Some("https://nexojuris.ia.br"), StatusCode::OK),
        ] {
            let mut request = Request::builder().uri("/me");
            if let Some(auth) = auth {
                request = request.header("Authorization", format!("Bearer {auth}"));
            }
            if let Some(origin) = origin {
                request = request.header("Origin", origin);
            }
            let response = app
                .clone()
                .oneshot(request.body(Body::empty()).unwrap())
                .await
                .unwrap();
            assert_eq!(response.status(), expected);
            if expected == StatusCode::OK {
                assert_eq!(response.headers()["cache-control"], "no-store");
            }
        }
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/usage")
                    .header("Authorization", format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let usage: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(usage["budgetUsdMicros"]["remaining"], 200_000);
        assert_eq!(usage["ocrPages"]["remaining"], 50);
    });
}
