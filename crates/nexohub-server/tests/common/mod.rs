use nexohub_server::cloud::{
    CloudError,
    auth::{AccountStatus, FirebaseVerifier, IdentityAuthority, PublicKeys, VerifiedIdentity},
    firestore::FirestoreStore,
};
use serde_json::Value;
use std::sync::Arc;
pub fn now() -> u64 {
    2_000_000_000
}
pub fn store() -> FirestoreStore {
    FirestoreStore::emulator(
        &std::env::var("FIRESTORE_EMULATOR_HOST").expect("Emulador obrigatório"),
        &format!("demo-nh-{}", uuid::Uuid::new_v4().simple()),
    )
    .unwrap()
}
pub fn identity() -> VerifiedIdentity {
    identity_named("google", now())
}
pub fn identity_named(name: &str, at: u64) -> VerifiedIdentity {
    struct Authority {
        email: String,
    }
    impl IdentityAuthority for Authority {
        fn public_keys(&self) -> Result<PublicKeys, CloudError> {
            let f: Value =
                serde_json::from_str(include_str!("../fixtures/firebase-synthetic.json")).unwrap();
            Ok(PublicKeys {
                jwks: f["jwks"].clone(),
                max_age_seconds: 300,
            })
        }
        fn account_status(&self, uid: &str) -> Result<AccountStatus, CloudError> {
            Ok(AccountStatus {
                uid: uid.into(),
                email: self.email.clone(),
                email_verified: true,
                disabled: false,
                valid_since: 0,
            })
        }
    }
    let f: Value =
        serde_json::from_str(include_str!("../fixtures/firebase-synthetic.json")).unwrap();
    FirebaseVerifier::new(
        "demo-nexohub-hybrid",
        Arc::new(Authority {
            email: if name == "otherEmail" {
                "alternate@example.invalid"
            } else {
                "person@example.invalid"
            }
            .into(),
        }),
    )
    .unwrap()
    .authenticate(f["tokens"][name].as_str().unwrap(), at)
    .unwrap()
}
