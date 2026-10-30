use nexohub_server::cloud::admin::{AdminAction, AdminCommand};
#[test]
fn admin_is_dry_run_by_default_and_rejects_shell_and_project_confusion() {
    let args = vec![
        "--project",
        "demo-nh",
        "--service-account",
        "operator@demo-nh.iam.gserviceaccount.com",
        "invite",
        "person@example.invalid",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect::<Vec<_>>();
    let command = AdminCommand::parse(&args).unwrap();
    assert!(!command.apply);
    assert!(matches!(command.action, AdminAction::Invite(_)));
    let mut wrong = args.clone();
    wrong[3] = "operator@other.iam.gserviceaccount.com".into();
    assert!(AdminCommand::parse(&wrong).is_err());
    for invalid in ["bad;command", "bad@example.invalid & command", ""] {
        let mut wrong = args.clone();
        wrong[3] = invalid.into();
        assert!(AdminCommand::parse(&wrong).is_err());
    }
    let mut apply = args;
    apply.insert(0, "--apply".into());
    assert!(AdminCommand::parse(&apply).unwrap().apply);
}
#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn administrative_suspension_and_revocation_are_atomic_and_audited() {
    mod common {
        include!("common/mod.rs");
    }
    use nexohub_server::cloud::{
        CloudError, admin::apply_action, admission::AdmissionService, policy::CloudPolicy,
    };
    use std::sync::Arc;
    let store = Arc::new(common::store());
    let now = common::now();
    let identity = common::identity();
    let admission = AdmissionService::new(store.clone(), CloudPolicy::pilot().unwrap());
    admission.invite(identity.email(), now).unwrap();
    let member = admission.admit(&identity, now).unwrap();
    apply_action(
        store.clone(),
        &AdminAction::Suspend(member.id.clone()),
        "test-operator",
        now,
    )
    .unwrap();
    assert!(matches!(
        admission.member(&identity),
        Err(CloudError::NotAdmitted)
    ));
    apply_action(
        store.clone(),
        &AdminAction::Resume(member.id.clone()),
        "test-operator",
        now,
    )
    .unwrap();
    assert!(admission.member(&identity).is_ok());
    apply_action(
        store.clone(),
        &AdminAction::Revoke(member.id.clone()),
        "test-operator",
        now,
    )
    .unwrap();
    assert!(matches!(
        admission.member(&identity),
        Err(CloudError::Revoked)
    ));
}
