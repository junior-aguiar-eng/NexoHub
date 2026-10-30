//! Admissão administrativa por convite, com vínculo estável independente da cota mensal.
use super::{CloudError, auth::VerifiedIdentity, firestore::FirestoreStore, policy::CloudPolicy};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, sync::Arc};

pub(crate) fn hash(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}
pub(crate) fn read<T: DeserializeOwned>(
    docs: &BTreeMap<String, Value>,
    path: &str,
) -> Result<T, CloudError> {
    serde_json::from_value(docs.get(path).cloned().ok_or(CloudError::NotAdmitted)?)
        .map_err(|_| CloudError::Unavailable)
}
pub(crate) fn write<T: Serialize>(
    docs: &mut BTreeMap<String, Value>,
    path: &str,
    value: &T,
) -> Result<(), CloudError> {
    docs.insert(
        path.into(),
        serde_json::to_value(value).map_err(|_| CloudError::Unavailable)?,
    );
    Ok(())
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Invite {
    participant_id: String,
    expires_at: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Binding {
    participant_id: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Participant {
    pub id: String,
    pub(crate) uid: String,
    pub(crate) active: bool,
    pub(crate) revoked_before: u64,
}
impl Participant {
    pub(crate) fn check(&self, identity: &VerifiedIdentity) -> Result<(), CloudError> {
        if !self.active || self.uid != identity.uid() {
            return Err(CloudError::NotAdmitted);
        }
        if identity.auth_time() <= self.revoked_before {
            return Err(CloudError::Revoked);
        }
        Ok(())
    }
}

pub struct AdmissionService {
    store: Arc<FirestoreStore>,
    policy: CloudPolicy,
}
impl AdmissionService {
    pub fn new(store: Arc<FirestoreStore>, policy: CloudPolicy) -> Self {
        Self { store, policy }
    }

    /// Somente código administrativo com IAM. Não expor como endpoint de participante.
    pub fn invite(&self, email: &str, now: u64) -> Result<(), CloudError> {
        let normalized = email.trim().to_ascii_lowercase();
        if normalized.len() > 254 || !normalized.contains('@') {
            return Err(CloudError::InvalidRequest);
        }
        let path = format!("invitations/{}", hash(&normalized));
        let previous: Option<Invite> = self
            .store
            .get(&path)?
            .map(serde_json::from_value)
            .transpose()
            .map_err(|_| CloudError::Unavailable)?;
        let candidate = Invite {
            participant_id: previous
                .as_ref()
                .map(|v| v.participant_id.clone())
                .unwrap_or_else(|| uuid::Uuid::new_v4().simple().to_string()),
            expires_at: now.checked_add(604_800).ok_or(CloudError::InvalidRequest)?,
        };
        let member_path = format!("participants/{}", candidate.participant_id);
        let audit = format!("audit/{}", uuid::Uuid::new_v4().simple());
        self.store.transact(&[path.clone(), member_path.clone(), audit.clone()], |docs| {
            if docs.contains_key(&path) {
                let old: Invite = read(docs, &path)?;
                if old.participant_id != candidate.participant_id { return Err(CloudError::Conflict); }
                if old.expires_at > now || docs.contains_key(&member_path) { return Ok(()); }
            }
            write(docs, &path, &candidate)?;
            docs.insert(audit.clone(), serde_json::json!({"kind":"invitation","participantId":candidate.participant_id,"at":now}));
            Ok(())
        })
    }

    pub fn admit(&self, identity: &VerifiedIdentity, now: u64) -> Result<Participant, CloudError> {
        identity.check_at(now)?;
        match self.member(identity) {
            Ok(member) => return Ok(member),
            Err(CloudError::NotAdmitted) => {}
            Err(error) => return Err(error),
        }
        let invitation_path = format!(
            "invitations/{}",
            hash(&identity.email().trim().to_ascii_lowercase())
        );
        let invite: Invite = serde_json::from_value(
            self.store
                .get(&invitation_path)?
                .ok_or(CloudError::NotAdmitted)?,
        )
        .map_err(|_| CloudError::Unavailable)?;
        let member_path = format!("participants/{}", invite.participant_id);
        let binding_path = format!("identities/{}", hash(identity.uid()));
        let paths = vec![
            invitation_path.clone(),
            member_path.clone(),
            binding_path.clone(),
            "pilot/roster".into(),
            format!("audit/admit-{}", invite.participant_id),
        ];
        self.store.transact(&paths, |docs| {
            let current: Invite = read(docs, &invitation_path)?;
            if current.participant_id != invite.participant_id || now >= current.expires_at {
                return Err(CloudError::NotAdmitted);
            }
            if docs.contains_key(&binding_path) {
                let binding: Binding = read(docs, &binding_path)?;
                if binding.participant_id != invite.participant_id {
                    return Err(CloudError::Conflict);
                }
            }
            if docs.contains_key(&member_path) {
                let member: Participant = read(docs, &member_path)?;
                member.check(identity)?;
                return Ok(member);
            }
            let count = docs
                .get("pilot/roster")
                .map(|v| v["count"].as_u64().ok_or(CloudError::Unavailable))
                .transpose()?
                .unwrap_or(0);
            if count >= self.policy.max_participants {
                return Err(CloudError::QuotaExceeded);
            }
            let member = Participant {
                id: invite.participant_id.clone(),
                uid: identity.uid().into(),
                active: true,
                revoked_before: 0,
            };
            write(docs, &member_path, &member)?;
            write(
                docs,
                &binding_path,
                &Binding {
                    participant_id: member.id.clone(),
                },
            )?;
            docs.insert("pilot/roster".into(), serde_json::json!({"count":count+1}));
            docs.insert(
                format!("audit/admit-{}", member.id),
                serde_json::json!({"kind":"admission","participantId":member.id,"at":now}),
            );
            Ok(member)
        })
    }

    pub fn member(&self, identity: &VerifiedIdentity) -> Result<Participant, CloudError> {
        let binding_path = format!("identities/{}", hash(identity.uid()));
        let binding: Binding = serde_json::from_value(
            self.store
                .get(&binding_path)?
                .ok_or(CloudError::NotAdmitted)?,
        )
        .map_err(|_| CloudError::Unavailable)?;
        if binding.participant_id.len() != 32
            || !binding
                .participant_id
                .bytes()
                .all(|b| b.is_ascii_hexdigit())
        {
            return Err(CloudError::Unavailable);
        }
        let path = format!("participants/{}", binding.participant_id);
        self.store
            .transact(&[binding_path.clone(), path.clone()], |docs| {
                let current: Binding = read(docs, &binding_path)?;
                if current.participant_id != binding.participant_id {
                    return Err(CloudError::NotAdmitted);
                }
                let member: Participant = read(docs, &path)?;
                member.check(identity)?;
                Ok(member)
            })
    }
}
