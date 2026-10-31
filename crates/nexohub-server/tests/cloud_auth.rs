use nexohub_server::cloud::CloudError;
use nexohub_server::cloud::auth::{AccountStatus, FirebaseVerifier, IdentityAuthority, PublicKeys};
use serde_json::Value;
use std::sync::Arc;

struct Authority {
    account: AccountStatus,
    fail: bool,
}
impl IdentityAuthority for Authority {
    fn public_keys(&self) -> Result<PublicKeys, CloudError> {
        let f = fixture();
        Ok(PublicKeys {
            jwks: f["jwks"].clone(),
            max_age_seconds: 300,
        })
    }
    fn account_status(&self, _uid: &str) -> Result<AccountStatus, CloudError> {
        if self.fail {
            return Err(CloudError::Unavailable);
        }
        Ok(self.account.clone())
    }
}
fn fixture() -> Value {
    serde_json::from_str(include_str!("fixtures/firebase-synthetic.json")).unwrap()
}
fn account() -> AccountStatus {
    AccountStatus {
        uid: "participant-1".into(),
        email: "person@example.invalid".into(),
        email_verified: true,
        disabled: false,
        valid_since: 0,
    }
}
fn verifier(account: AccountStatus, fail: bool) -> FirebaseVerifier {
    FirebaseVerifier::new("demo-nexohub-hybrid", Arc::new(Authority { account, fail })).unwrap()
}

#[test]
fn accepts_signed_google_and_confirmed_email_tokens() {
    let f = fixture();
    let auth = verifier(account(), false);
    for name in ["google", "emailLink"] {
        let principal = auth
            .authenticate(
                f["tokens"][name].as_str().unwrap(),
                f["now"].as_u64().unwrap(),
            )
            .unwrap();
        assert_eq!(principal.uid(), "participant-1");
    }
}

#[test]
fn rejects_forged_expired_wrong_project_unverified_and_anonymous_tokens() {
    let f = fixture();
    let auth = verifier(account(), false);
    let now = f["now"].as_u64().unwrap();
    for name in [
        "expired",
        "futureIssue",
        "futureAuth",
        "futureNotBefore",
        "wrongAudience",
        "wrongIssuer",
        "emptyUid",
        "unverified",
        "anonymous",
        "unknownKey",
        "wrongAlgorithm",
    ] {
        assert!(
            auth.authenticate(f["tokens"][name].as_str().unwrap(), now)
                .is_err(),
            "{name}"
        );
    }
    let token = f["tokens"]["google"].as_str().unwrap();
    let mut parts: Vec<_> = token.split('.').collect();
    parts[1] = "e30";
    assert!(auth.authenticate(&parts.join("."), now).is_err());
}

#[test]
fn checks_live_revocation_disabled_account_and_provider_outage() {
    let f = fixture();
    let now = f["now"].as_u64().unwrap();
    let token = f["tokens"]["google"].as_str().unwrap();
    let mut revoked = account();
    revoked.valid_since = now;
    assert!(verifier(revoked, false).authenticate(token, now).is_err());
    let mut disabled = account();
    disabled.disabled = true;
    assert!(verifier(disabled, false).authenticate(token, now).is_err());
    assert!(verifier(account(), true).authenticate(token, now).is_err());
    let mut changed = account();
    changed.email_verified = false;
    assert!(verifier(changed, false).authenticate(token, now).is_err());
    let mut other = account();
    other.uid = "other".into();
    assert!(verifier(other, false).authenticate(token, now).is_err());
}
