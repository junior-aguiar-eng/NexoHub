use nexohub_server::cloud::policy::CloudPolicy;

#[test]
fn policy_matches_design_and_keeps_cloud_disabled() {
    let policy = CloudPolicy::pilot().unwrap();
    assert!(!policy.cloud_enabled);
    assert_eq!(policy.max_participants, 300);
    assert_eq!(policy.budget.tasks_usd_micros, 60_000_000);
    assert_eq!(policy.budget.operations_usd_micros, 15_000_000);
    assert_eq!(policy.budget.safety_usd_micros, 25_000_000);
    assert_eq!(policy.budget.participant_usd_micros, 200_000);
    assert_eq!(policy.ocr.monthly_pages, 50);
    assert_eq!(policy.ocr.max_pages, 15);
    assert_eq!(policy.ocr.max_bytes, 20 * 1024 * 1024);
    assert_eq!(policy.translation.monthly_characters, 5_000);
    assert_eq!(policy.office.monthly_files, 10);
    assert_eq!(policy.concurrency.global_running, 2);
    assert_eq!(policy.concurrency.participant_running, 1);
    assert_eq!(policy.retention.result_seconds, 3_600);
    assert_eq!(
        (policy.ocr.max_megapixels, policy.ocr.timeout_seconds),
        (25, 120)
    );
    assert_eq!(
        (
            policy.translation.max_characters,
            policy.translation.max_target_languages,
            policy.translation.timeout_seconds
        ),
        (5_000, 1, 60)
    );
    assert_eq!(
        (
            policy.office.max_input_bytes,
            policy.office.max_output_pages,
            policy.office.timeout_seconds
        ),
        (10 * 1024 * 1024, 50, 120)
    );
    assert_eq!(
        (
            policy.concurrency.global_queued,
            policy.concurrency.participant_queued
        ),
        (20, 1)
    );
    assert_eq!(
        (
            policy.inspection.participant_daily,
            policy.inspection.participant_monthly,
            policy.inspection.global_monthly
        ),
        (5, 60, 6_000)
    );
    assert_eq!(
        (
            policy.transfer.upload_timeout_seconds,
            policy.transfer.max_output_bytes,
            policy.transfer.max_downloads,
            policy.transfer.max_download_bytes_per_job,
            policy.transfer.global_stored_bytes
        ),
        (
            120,
            30 * 1024 * 1024,
            3,
            90 * 1024 * 1024,
            2 * 1024 * 1024 * 1024
        )
    );
    assert_eq!(
        (
            policy.retention.cleanup_interval_seconds,
            policy.retention.lifecycle_fallback_seconds,
            policy.retention.audit_days
        ),
        (900, 86_400, 90)
    );
    assert_eq!(
        (
            policy.timing.quote_seconds,
            policy.timing.queue_seconds,
            policy.timing.unknown_provider_quarantine_seconds,
            policy.timing.month_guard_seconds,
            policy.timing.max_price_age_seconds
        ),
        (300, 300, 600, 900, 604_800)
    );
    assert_eq!(policy.timing.billing_time_zone, "America/Los_Angeles");
}

#[test]
fn policy_rejects_oversubscribed_participant_allowances() {
    let mut policy = CloudPolicy::pilot().unwrap();
    policy.budget.participant_usd_micros = 200_001;
    assert!(policy.validate().is_err());
}

#[test]
fn policy_cannot_expand_budget_or_activate_unimplemented_cloud() {
    let mut policy = CloudPolicy::pilot().unwrap();
    policy.cloud_enabled = true;
    assert!(policy.validate().is_err());
    policy.cloud_enabled = false;
    policy.budget.tasks_usd_micros += 1;
    assert!(policy.validate().is_err());
}

#[test]
fn policy_rejects_zero_and_excessive_resource_limits() {
    for value in [0, 16, u64::MAX] {
        let mut policy = CloudPolicy::pilot().unwrap();
        policy.ocr.max_pages = value;
        assert!(policy.validate().is_err());
    }
    let mut policy = CloudPolicy::pilot().unwrap();
    policy.concurrency.global_running = 3;
    assert!(policy.validate().is_err());
    policy.concurrency.global_running = 2;
    policy.office.timeout_seconds = 121;
    assert!(policy.validate().is_err());
}

#[test]
fn policy_rejects_arithmetic_overflow_and_unknown_configuration() {
    let mut policy = CloudPolicy::pilot().unwrap();
    policy.budget.participant_usd_micros = u64::MAX;
    assert!(policy.validate().is_err());
    let mut policy = CloudPolicy::pilot().unwrap();
    policy.budget.safety_usd_micros = u64::MAX;
    assert!(policy.validate().is_err());
    let json = serde_json::to_value(CloudPolicy::pilot().unwrap()).unwrap();
    let mut changed = json.clone();
    changed["allowUnmeteredCloud"] = true.into();
    assert!(CloudPolicy::from_json(&changed.to_string()).is_err());
    let mut changed = json;
    changed["ocr"]["maxBytes"] = (-1).into();
    assert!(CloudPolicy::from_json(&changed.to_string()).is_err());
}

#[test]
fn configuration_cannot_remove_limits_or_hide_unknown_nested_options() {
    let mut value = serde_json::to_value(CloudPolicy::pilot().unwrap()).unwrap();
    value["budget"]["ignorePendingReservations"] = true.into();
    assert!(CloudPolicy::from_json(&value.to_string()).is_err());
    value["budget"]
        .as_object_mut()
        .unwrap()
        .remove("ignorePendingReservations");
    value.as_object_mut().unwrap().remove("concurrency");
    assert!(CloudPolicy::from_json(&value.to_string()).is_err());
}

#[test]
fn safety_and_month_guard_cannot_be_removed() {
    let mut policy = CloudPolicy::pilot().unwrap();
    policy.budget.safety_usd_micros = 24_999_999;
    assert!(policy.validate().is_err());
    let mut policy = CloudPolicy::pilot().unwrap();
    policy.timing.month_guard_seconds = 899;
    assert!(policy.validate().is_err());
    policy.timing.month_guard_seconds = 900;
    policy.max_participants = 301;
    assert!(policy.validate().is_err());
}
