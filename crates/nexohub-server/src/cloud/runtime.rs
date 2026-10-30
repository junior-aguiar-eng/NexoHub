//! Composição da identidade real. Não habilita motores documentais pagos.
use super::{
    CloudError,
    admission::AdmissionService,
    auth::{FirebaseVerifier, GoogleIdentityAuthority},
    desktop::DesktopHandoff,
    firestore::{FirestoreStore, MetadataAccessToken},
    ledger::Ledger,
    policy::CloudPolicy,
    routes::{CloudIdentityServices, system_clock},
};
use std::sync::Arc;

pub fn from_environment() -> Result<Option<Arc<CloudIdentityServices>>, CloudError> {
    match std::env::var("NEXOHUB_IDENTITY_ENABLED").as_deref() {
        Err(_) | Ok("false") => return Ok(None),
        Ok("true") => {}
        _ => return Err(CloudError::InvalidRequest),
    }
    let project =
        std::env::var("NEXOHUB_FIREBASE_PROJECT").map_err(|_| CloudError::InvalidRequest)?;
    if project != "nexohub-piloto-300" {
        return Err(CloudError::InvalidRequest);
    }
    let access = Arc::new(MetadataAccessToken);
    let store = Arc::new(FirestoreStore::google(&project, access.clone())?);
    let policy = CloudPolicy::pilot().map_err(|_| CloudError::InvalidRequest)?;
    Ok(Some(Arc::new(CloudIdentityServices {
        verifier: FirebaseVerifier::new(
            &project,
            Arc::new(GoogleIdentityAuthority::new(&project, access)?),
        )?,
        admission: AdmissionService::new(store.clone(), policy.clone()),
        ledger: Ledger::new(store.clone(), policy.clone()),
        desktop: DesktopHandoff::new(store),
        policy,
        origins: vec![
            "https://nexojuris.ia.br".into(),
            "https://login-hml---nexohub-hub-r4m4ltvj3a-rj.a.run.app".into(),
        ],
        clock: system_clock,
    })))
}
