//! Operação explícita por identidade IAM. Dry-run não consulta credenciais nem Firestore.
use super::{
    CloudError,
    admission::{AdmissionService, hash},
    desktop::hex,
    firestore::{AccessTokenSource, FirestoreStore},
    policy::CloudPolicy,
};
use std::{
    process::{Command, Stdio},
    sync::Arc,
};
pub enum AdminAction {
    Invite(String),
    Suspend(String),
    Resume(String),
    Revoke(String),
}
pub struct AdminCommand {
    pub project: String,
    pub account: String,
    pub apply: bool,
    pub action: AdminAction,
}
impl AdminCommand {
    pub fn parse(args: &[String]) -> Result<Self, CloudError> {
        let apply = args.first().is_some_and(|v| v == "--apply");
        let args = if apply { &args[1..] } else { args };
        if args.len() != 6 || args[0] != "--project" || args[2] != "--service-account" {
            return Err(CloudError::InvalidRequest);
        }
        let project = &args[1];
        let account = &args[3];
        if project.is_empty()
            || project.len() > 63
            || !project
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        {
            return Err(CloudError::InvalidRequest);
        }
        let suffix = format!("@{project}.iam.gserviceaccount.com");
        let name = account
            .strip_suffix(&suffix)
            .ok_or(CloudError::InvalidRequest)?;
        if name.is_empty()
            || name.len() > 64
            || !name
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        {
            return Err(CloudError::InvalidRequest);
        }
        let target = args[5].clone();
        let action = match args[4].as_str() {
            "invite"
                if target.len() <= 254
                    && target.matches('@').count() == 1
                    && !target.chars().any(char::is_whitespace) =>
            {
                AdminAction::Invite(target)
            }
            "suspend" if hex(&target, 32) => AdminAction::Suspend(target),
            "resume" if hex(&target, 32) => AdminAction::Resume(target),
            "revoke" if hex(&target, 32) => AdminAction::Revoke(target),
            _ => return Err(CloudError::InvalidRequest),
        };
        Ok(Self {
            project: project.clone(),
            account: account.clone(),
            apply,
            action,
        })
    }
    pub fn operation(&self) -> &'static str {
        match self.action {
            AdminAction::Invite(_) => "invite",
            AdminAction::Suspend(_) => "suspend",
            AdminAction::Resume(_) => "resume",
            AdminAction::Revoke(_) => "revoke",
        }
    }
    pub fn execute(&self, now: u64) -> Result<(), CloudError> {
        if !self.apply {
            return Ok(());
        }
        let access = Arc::new(ImpersonatedToken {
            account: self.account.clone(),
            project: self.project.clone(),
        });
        let store = Arc::new(FirestoreStore::google(&self.project, access)?);
        apply_action(store, &self.action, &self.account, now)
    }
}
struct ImpersonatedToken {
    account: String,
    project: String,
}
impl AccessTokenSource for ImpersonatedToken {
    fn token(&self) -> Result<String, CloudError> {
        let mut command = Command::new(if cfg!(windows) {
            "gcloud.cmd"
        } else {
            "gcloud"
        });
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let output = command
            .args([
                "auth",
                "print-access-token",
                "--quiet",
                "--billing-project",
                &self.project,
                "--impersonate-service-account",
                &self.account,
            ])
            .stdin(Stdio::null())
            .stderr(Stdio::null())
            .output()
            .map_err(|_| CloudError::Unavailable)?;
        if !output.status.success() || output.stdout.len() > 16_384 {
            return Err(CloudError::Unauthorized);
        }
        let token = String::from_utf8(output.stdout).map_err(|_| CloudError::Unauthorized)?;
        let token = token.trim();
        if token.is_empty() || token.chars().any(char::is_whitespace) {
            return Err(CloudError::Unauthorized);
        }
        Ok(token.into())
    }
}
pub fn apply_action(
    store: Arc<FirestoreStore>,
    action: &AdminAction,
    actor: &str,
    now: u64,
) -> Result<(), CloudError> {
    match action {
        AdminAction::Invite(email) => AdmissionService::new(
            store,
            CloudPolicy::pilot().map_err(|_| CloudError::Unavailable)?,
        )
        .invite_by(email, now, actor),
        AdminAction::Suspend(id) | AdminAction::Resume(id) | AdminAction::Revoke(id) => {
            if !hex(id, 32) {
                return Err(CloudError::InvalidRequest);
            }
            let path = format!("participants/{id}");
            let audit = format!("audit/{}", uuid::Uuid::new_v4().simple());
            store.transact(&[path.clone(),audit.clone()],|docs|{
                let member=docs.get_mut(&path).ok_or(CloudError::NotAdmitted)?;
                let kind=match action{AdminAction::Suspend(_)=>{member["active"]=false.into();"suspend"},AdminAction::Resume(_)=>{member["active"]=true.into();"resume"},_=>{let old=member["revokedBefore"].as_u64().ok_or(CloudError::Unavailable)?;member["revokedBefore"]=old.max(now).into();"revoke"}};
                docs.insert(audit.clone(),serde_json::json!({"kind":kind,"participantId":id,"actor":hash(actor),"at":now}));Ok(())
            })
        }
    }
}
