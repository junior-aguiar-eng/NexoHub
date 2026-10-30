//! Identidade Firebase: assinatura RS256, projeto, datas e revogação conferidos no servidor.
use super::CloudError;
use jsonwebtoken::{Algorithm, DecodingKey, Validation, decode, decode_header, jwk::JwkSet};
use serde::Deserialize;
use std::sync::{Arc, Mutex};

pub struct PublicKeys {
    pub jwks: serde_json::Value,
    pub max_age_seconds: u64,
}

#[derive(Clone)]
pub struct AccountStatus {
    pub uid: String,
    pub email: String,
    pub email_verified: bool,
    pub disabled: bool,
    pub valid_since: u64,
}

pub trait IdentityAuthority: Send + Sync {
    fn public_keys(&self) -> Result<PublicKeys, CloudError>;
    fn account_status(&self, uid: &str) -> Result<AccountStatus, CloudError>;
}

/// Construída somente depois da prova criptográfica e da consulta de revogação.
#[derive(Clone)]
pub struct VerifiedIdentity {
    uid: String,
    email: String,
    auth_time: u64,
    expires_at: u64,
    verified_at: u64,
}
impl VerifiedIdentity {
    pub(crate) fn check_at(&self, now: u64) -> Result<(), CloudError> {
        if now < self.verified_at || now >= self.expires_at {
            return Err(CloudError::Unauthorized);
        }
        Ok(())
    }
    pub fn uid(&self) -> &str {
        &self.uid
    }
    pub fn email(&self) -> &str {
        &self.email
    }
    pub fn auth_time(&self) -> u64 {
        self.auth_time
    }
}

#[derive(Deserialize)]
struct Claims {
    sub: String,
    email: String,
    email_verified: bool,
    exp: u64,
    nbf: Option<u64>,
    iat: u64,
    auth_time: u64,
    firebase: FirebaseClaims,
}
#[derive(Deserialize)]
struct FirebaseClaims {
    sign_in_provider: String,
}

struct CachedKeys {
    keys: JwkSet,
    until: u64,
}

pub struct FirebaseVerifier {
    project_id: String,
    authority: Arc<dyn IdentityAuthority>,
    keys: Mutex<Option<CachedKeys>>,
}

impl FirebaseVerifier {
    pub fn new(
        project_id: &str,
        authority: Arc<dyn IdentityAuthority>,
    ) -> Result<Self, CloudError> {
        if project_id.is_empty()
            || project_id.len() > 63
            || !project_id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        {
            return Err(CloudError::InvalidRequest);
        }
        Ok(Self {
            project_id: project_id.into(),
            authority,
            keys: Mutex::new(None),
        })
    }

    pub fn authenticate(&self, token: &str, now: u64) -> Result<VerifiedIdentity, CloudError> {
        if token.len() > 16_384 || token.is_empty() {
            return Err(CloudError::Unauthorized);
        }
        let header = decode_header(token).map_err(|_| CloudError::Unauthorized)?;
        if header.alg != Algorithm::RS256 {
            return Err(CloudError::Unauthorized);
        }
        let kid = header.kid.as_deref().ok_or(CloudError::Unauthorized)?;
        let mut cache = self.keys.lock().map_err(|_| CloudError::Unavailable)?;
        if cache.as_ref().is_none_or(|entry| now >= entry.until) {
            let received = self.authority.public_keys()?;
            let keys: JwkSet =
                serde_json::from_value(received.jwks).map_err(|_| CloudError::Unavailable)?;
            if keys.keys.is_empty() || keys.keys.len() > 32 {
                return Err(CloudError::Unavailable);
            }
            *cache = Some(CachedKeys {
                keys,
                until: now
                    .checked_add(received.max_age_seconds.clamp(1, 3600))
                    .ok_or(CloudError::Unavailable)?,
            });
        }
        let jwk = cache
            .as_ref()
            .ok_or(CloudError::Unavailable)?
            .keys
            .find(kid)
            .ok_or(CloudError::Unauthorized)?;
        let key = DecodingKey::from_jwk(jwk).map_err(|_| CloudError::Unauthorized)?;
        drop(cache);
        let mut validation = Validation::new(Algorithm::RS256);
        validation.leeway = 0;
        // Relógio injetado também nos testes; a assinatura continua obrigatória.
        validation.validate_exp = false;
        validation.validate_nbf = false;
        validation.set_audience(&[self.project_id.as_str()]);
        validation.set_issuer(&[format!(
            "https://securetoken.google.com/{}",
            self.project_id
        )]);
        validation.set_required_spec_claims(&["exp", "iat", "aud", "iss", "sub"]);
        let claims = decode::<Claims>(token, &key, &validation)
            .map_err(|_| CloudError::Unauthorized)?
            .claims;
        if claims.sub.is_empty()
            || claims.sub.len() > 128
            || claims.exp <= now
            || claims.nbf.is_some_and(|nbf| nbf > now)
            || claims.iat > now
            || claims.auth_time > now
            || claims.auth_time > claims.iat
        {
            return Err(CloudError::Unauthorized);
        }
        if !claims.email_verified {
            return Err(CloudError::Unverified);
        }
        if !matches!(
            claims.firebase.sign_in_provider.as_str(),
            "google.com" | "password"
        ) {
            return Err(CloudError::Unauthorized);
        }
        let current = self.authority.account_status(&claims.sub)?;
        if current.uid != claims.sub || !current.email.eq_ignore_ascii_case(&claims.email) {
            return Err(CloudError::Unauthorized);
        }
        if current.disabled {
            return Err(CloudError::Disabled);
        }
        if !current.email_verified {
            return Err(CloudError::Unverified);
        }
        if claims.auth_time < current.valid_since {
            return Err(CloudError::Revoked);
        }
        Ok(VerifiedIdentity {
            uid: claims.sub,
            email: current.email,
            auth_time: claims.auth_time,
            expires_at: claims.exp,
            verified_at: now,
        })
    }
}

/// Autoridade real, ainda não conectada a rotas: URLs fixas, sem redirecionamento.
pub struct GoogleIdentityAuthority {
    client: reqwest::blocking::Client,
    project_id: String,
    access: Arc<dyn super::firestore::AccessTokenSource>,
}
impl GoogleIdentityAuthority {
    pub fn new(
        project_id: &str,
        access: Arc<dyn super::firestore::AccessTokenSource>,
    ) -> Result<Self, CloudError> {
        if project_id.is_empty()
            || project_id.len() > 63
            || !project_id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        {
            return Err(CloudError::InvalidRequest);
        }
        let client = reqwest::blocking::Client::builder()
            .https_only(true)
            .timeout(std::time::Duration::from_secs(10))
            .redirect(reqwest::redirect::Policy::none())
            .retry(reqwest::retry::never())
            .build()
            .map_err(|_| CloudError::Unavailable)?;
        Ok(Self {
            client,
            project_id: project_id.into(),
            access,
        })
    }
}
impl IdentityAuthority for GoogleIdentityAuthority {
    fn public_keys(&self) -> Result<PublicKeys, CloudError> {
        let response = self.client.get("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com").send().map_err(|_| CloudError::Unavailable)?;
        if !response.status().is_success() {
            return Err(CloudError::Unavailable);
        }
        let max_age_seconds = response
            .headers()
            .get("cache-control")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| {
                v.split(',')
                    .find_map(|part| part.trim().strip_prefix("max-age=")?.parse::<u64>().ok())
            })
            .ok_or(CloudError::Unavailable)?;
        Ok(PublicKeys {
            jwks: super::firestore::limited_json(response)?,
            max_age_seconds,
        })
    }
    fn account_status(&self, uid: &str) -> Result<AccountStatus, CloudError> {
        let response = self
            .client
            .post(format!(
                "https://identitytoolkit.googleapis.com/v1/projects/{}/accounts:lookup",
                self.project_id
            ))
            .bearer_auth(self.access.token()?)
            .json(&serde_json::json!({"localId":[uid]}))
            .send()
            .map_err(|_| CloudError::Unavailable)?;
        if !response.status().is_success() {
            return Err(CloudError::Unavailable);
        }
        let data = super::firestore::limited_json(response)?;
        let users = data["users"].as_array().ok_or(CloudError::Unauthorized)?;
        if users.len() != 1 {
            return Err(CloudError::Unauthorized);
        }
        let user = &users[0];
        Ok(AccountStatus {
            uid: user["localId"]
                .as_str()
                .ok_or(CloudError::Unavailable)?
                .into(),
            email: user["email"]
                .as_str()
                .ok_or(CloudError::Unavailable)?
                .into(),
            email_verified: user["emailVerified"]
                .as_bool()
                .ok_or(CloudError::Unavailable)?,
            disabled: user
                .get("disabled")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false),
            valid_since: user["validSince"]
                .as_str()
                .and_then(|v| v.parse().ok())
                .ok_or(CloudError::Unavailable)?,
        })
    }
}
