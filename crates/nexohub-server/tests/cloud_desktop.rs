mod common;
use nexohub_server::cloud::{
    CloudError,
    admission::AdmissionService,
    desktop::{DesktopCodeRequest, DesktopHandoff},
    policy::CloudPolicy,
};
use sha2::{Digest, Sha256};
use std::sync::Arc;
#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn desktop_code_is_bound_to_state_verifier_instance_and_single_use() {
    let store = Arc::new(common::store());
    let identity = common::identity();
    let now = common::now();
    let admission = AdmissionService::new(store.clone(), CloudPolicy::pilot().unwrap());
    admission.invite(identity.email(), now).unwrap();
    let member = admission.admit(&identity, now).unwrap();
    let bridge = DesktopHandoff::new(store.clone());
    let verifier = "a".repeat(64);
    let state = "b".repeat(64);
    let request = DesktopCodeRequest {
        challenge: format!("{:x}", Sha256::digest(verifier.as_bytes())),
        state: state.clone(),
        envelope: serde_json::json!({"wrappedKey":"c".repeat(512),"nonce":"d".repeat(24),"ciphertext":"e".repeat(128)}),
    };
    let issued = bridge.issue(&member.id, &request, now).unwrap();
    assert_eq!(
        bridge
            .exchange(&issued.code, &"f".repeat(64), &state, now)
            .unwrap_err(),
        CloudError::Unauthorized
    );
    assert_eq!(
        bridge
            .exchange(&issued.code, &verifier, &"f".repeat(64), now)
            .unwrap_err(),
        CloudError::Unauthorized
    );
    assert_eq!(
        bridge
            .exchange(&issued.code, &verifier, &state, now)
            .unwrap(),
        request.envelope
    );
    assert_eq!(
        DesktopHandoff::new(store)
            .exchange(&issued.code, &verifier, &state, now)
            .unwrap_err(),
        CloudError::Unauthorized
    );
}
#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn desktop_code_expires_at_sixty_seconds_and_does_not_store_plaintext_tokens() {
    let store = Arc::new(common::store());
    let bridge = DesktopHandoff::new(store.clone());
    let now = common::now();
    let verifier = "a".repeat(64);
    let state = "b".repeat(64);
    let request = DesktopCodeRequest {
        challenge: format!("{:x}", Sha256::digest(verifier.as_bytes())),
        state: state.clone(),
        envelope: serde_json::json!({"wrappedKey":"c".repeat(512),"nonce":"d".repeat(24),"ciphertext":"e".repeat(128)}),
    };
    let issued = bridge.issue(&"a".repeat(32), &request, now).unwrap();
    assert_eq!(issued.expires_at, now + 60);
    assert_eq!(
        bridge
            .exchange(&issued.code, &verifier, &state, now + 60)
            .unwrap_err(),
        CloudError::Unauthorized
    );
    let mut invalid = request;
    invalid.envelope = serde_json::json!({"idToken":"sensitive-token"});
    assert!(bridge.issue(&"a".repeat(32), &invalid, now).is_err());
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn simultaneous_exchanges_deliver_envelope_exactly_once_and_issuance_is_limited() {
    use nexohub_server::cloud::firestore::FirestoreStore;
    let store = Arc::new(common::store());
    let bridge = DesktopHandoff::new(store.clone());
    let now = common::now();
    let verifier = "a".repeat(64);
    let state = "b".repeat(64);
    let participant = "a".repeat(32);
    let request = DesktopCodeRequest {
        challenge: format!("{:x}", Sha256::digest(verifier.as_bytes())),
        state: state.clone(),
        envelope: serde_json::json!({"wrappedKey":"c".repeat(512),"nonce":"d".repeat(24),"ciphertext":"e".repeat(128)}),
    };
    let issued = bridge.issue(&participant, &request, now).unwrap();
    for _ in 0..4 {
        bridge.issue(&participant, &request, now).unwrap();
    }
    assert!(matches!(
        bridge.issue(&participant, &request, now),
        Err(CloudError::Busy)
    ));
    let mut threads = Vec::new();
    for _ in 0..100 {
        let host = std::env::var("FIRESTORE_EMULATOR_HOST").unwrap();
        let project = store.project_id().to_owned();
        let code = issued.code.clone();
        let verifier = verifier.clone();
        let state = state.clone();
        threads.push(std::thread::spawn(move || {
            DesktopHandoff::new(Arc::new(FirestoreStore::emulator(&host, &project).unwrap()))
                .exchange(&code, &verifier, &state, now)
        }));
    }
    let results: Vec<_> = threads.into_iter().map(|t| t.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert!(
        results
            .iter()
            .filter_map(|r| r.as_ref().err())
            .all(|e| *e == CloudError::Unauthorized)
    );
}
