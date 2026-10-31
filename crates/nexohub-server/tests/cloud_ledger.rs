use nexohub_server::cloud::{
    CloudError,
    admission::AdmissionService,
    firestore::FirestoreStore,
    ledger::{Ledger, ReservationRequest, Units},
    policy::CloudPolicy,
    pricing::PriceBook,
};
use std::sync::Arc;

mod common;

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn persistent_membership_budget_reservations_and_settlement() {
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let principal = common::identity();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite("person@example.invalid", now).unwrap();
    let member = admission.admit(&principal, now).unwrap();
    assert_eq!(admission.admit(&principal, now).unwrap().id, member.id);
    assert_eq!(
        admission
            .admit(&common::identity_named("emailLink", now), now)
            .unwrap()
            .id,
        member.id
    );
    let ledger = Ledger::new(store.clone(), policy.clone());
    let request = ReservationRequest {
        key: "job-a".into(),
        input_digest: "a".repeat(64),
        units: Units {
            ocr_pages: 3,
            characters: 0,
            office_files: 0,
        },
        maximum_usd_micros: 6_000,
    };
    let first = ledger.reserve(&principal, &request, now).unwrap();
    let replay = ledger.reserve(&principal, &request, now).unwrap();
    assert_eq!(first.id, replay.id);
    assert_eq!(
        ledger.usage(&principal, now).unwrap().reserved_usd_micros,
        6_000
    );
    let mut changed = request.clone();
    changed.input_digest = "b".repeat(64);
    assert_eq!(
        ledger.reserve(&principal, &changed, now).unwrap_err(),
        CloudError::Conflict
    );
    ledger.mark_running(&principal, &first.id, now).unwrap();
    assert!(
        ledger
            .cancel_before_start(&principal, &first.id, now)
            .is_err()
    );
    ledger.mark_unknown(&principal, &first.id, now).unwrap();
    assert_eq!(
        ledger.usage(&principal, now).unwrap().reserved_usd_micros,
        6_000
    );
    ledger
        .settle_confirmed(&principal, &first.id, 4_000, now)
        .unwrap();
    ledger
        .settle_confirmed(&principal, &first.id, 4_000, now)
        .unwrap();
    assert!(
        ledger
            .settle_confirmed(&principal, &first.id, 5_000, now)
            .is_err()
    );
    drop(ledger);
    let reopened = Ledger::new(store.clone(), policy);
    let usage = reopened.usage(&principal, now).unwrap();
    assert_eq!(usage.used_usd_micros, 4_000);
    assert_eq!(usage.reserved_usd_micros, 0);
    assert_eq!(usage.used.ocr_pages, 3);
    let _ = AdmissionService::new(store, CloudPolicy::pilot().unwrap());
}

#[test]
fn conservative_price_reserves_time_transfers_and_rejects_stale_or_excessive_input() {
    let policy = CloudPolicy::pilot().unwrap();
    let mut price = PriceBook::pilot().unwrap();
    price.verified_at = common::now();
    let units = Units {
        ocr_pages: 15,
        characters: 0,
        office_files: 0,
    };
    let maximum = price.estimate(&units, &policy, common::now()).unwrap();
    assert!(
        maximum > 22_500 + 9_744,
        "API+CPU apenas não cobre transferências/inicialização"
    );
    assert!(
        price
            .estimate(
                &Units {
                    ocr_pages: 16,
                    ..Units::default()
                },
                &policy,
                common::now()
            )
            .is_err()
    );
    assert!(
        price
            .estimate(&units, &policy, common::now() + 604_801)
            .is_err()
    );
    assert!(
        price
            .estimate(
                &Units {
                    characters: u64::MAX,
                    ..Units::default()
                },
                &policy,
                common::now()
            )
            .is_err()
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn one_of_one_hundred_concurrent_reservations_wins_last_global_cent() {
    let store = Arc::new(common::store());
    let now = common::now();
    let principal = Arc::new(common::identity());
    let policy = CloudPolicy::pilot().unwrap();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite("person@example.invalid", now).unwrap();
    admission.admit(&principal, now).unwrap();
    let ledger = Ledger::new(store.clone(), policy.clone());
    ledger.usage(&principal, now).unwrap();
    let period = nexohub_server::cloud::ledger::BillingPeriod::at(now).unwrap();
    store
        .transact(&[format!("periods/{}", period.id)], |docs| {
            docs.get_mut(&format!("periods/{}", period.id)).unwrap()["usedUsdMicros"] =
                59_990_000.into();
            Ok(())
        })
        .unwrap();
    let mut threads = Vec::new();
    for i in 0..100 {
        let identity = principal.clone();
        let host = std::env::var("FIRESTORE_EMULATOR_HOST").unwrap();
        let project = store.project_id().to_owned();
        let policy = policy.clone();
        threads.push(std::thread::spawn(move || {
            let independent = Arc::new(FirestoreStore::emulator(&host, &project).unwrap());
            Ledger::new(independent, policy).reserve(
                &identity,
                &ReservationRequest {
                    key: format!("request-{i}"),
                    input_digest: "a".repeat(64),
                    units: Units {
                        ocr_pages: 1,
                        ..Units::default()
                    },
                    maximum_usd_micros: 6_000,
                },
                now,
            )
        }));
    }
    let results: Vec<_> = threads.into_iter().map(|t| t.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert!(
        results
            .iter()
            .filter_map(|r| r.as_ref().err())
            .all(|e| *e == CloudError::BudgetExceeded)
    );
}

#[test]
fn invalid_price_configuration_fails_closed() {
    let policy = CloudPolicy::pilot().unwrap();
    let units = Units {
        ocr_pages: 1,
        ..Units::default()
    };
    let source = include_str!("../../../scripts/cloud/hybrid-pricing.json");
    for field in [
        "cpuNanosPerVcpuSecond",
        "startupSeconds",
        "storageNanosPerGibSecond",
    ] {
        let mut value: serde_json::Value = serde_json::from_str(source).unwrap();
        value[field] = u64::MAX.into();
        value["verifiedAt"] = common::now().into();
        let price: PriceBook = serde_json::from_value(value).unwrap();
        assert_eq!(
            price.estimate(&units, &policy, common::now()),
            Err(CloudError::PriceUnavailable)
        );
    }
}

#[test]
fn expired_identity_cannot_reuse_verified_principal_for_reservation() {
    let store = Arc::new(FirestoreStore::emulator("127.0.0.1:1", "demo-no-network").unwrap());
    let ledger = Ledger::new(store, CloudPolicy::pilot().unwrap());
    let result = ledger.usage(&common::identity(), common::now() + 3600);
    assert!(matches!(result, Err(CloudError::Unauthorized)));
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn one_of_one_hundred_concurrent_reservations_wins_last_individual_cent() {
    let store = Arc::new(common::store());
    let now = common::now();
    let principal = Arc::new(common::identity());
    let policy = CloudPolicy::pilot().unwrap();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite("person@example.invalid", now).unwrap();
    let member = admission.admit(&principal, now).unwrap();
    let ledger = Ledger::new(store.clone(), policy.clone());
    ledger.usage(&principal, now).unwrap();
    let period = nexohub_server::cloud::ledger::BillingPeriod::at(now).unwrap();
    let path = format!("periods/{}/participants/{}", period.id, member.id);
    store
        .transact(std::slice::from_ref(&path), |docs| {
            docs.insert(
                path.clone(),
                serde_json::json!({"usedUsdMicros":190_000,"used":Units::default()}),
            );
            Ok(())
        })
        .unwrap();
    let mut threads = Vec::new();
    for i in 0..100 {
        let identity = principal.clone();
        let host = std::env::var("FIRESTORE_EMULATOR_HOST").unwrap();
        let project = store.project_id().to_owned();
        let policy = policy.clone();
        threads.push(std::thread::spawn(move || {
            let independent = Arc::new(FirestoreStore::emulator(&host, &project).unwrap());
            Ledger::new(independent, policy).reserve(
                &identity,
                &ReservationRequest {
                    key: format!("request-{i}"),
                    input_digest: "a".repeat(64),
                    units: Units {
                        ocr_pages: 1,
                        ..Units::default()
                    },
                    maximum_usd_micros: 6_000,
                },
                now,
            )
        }));
    }
    let results: Vec<_> = threads.into_iter().map(|t| t.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert!(
        results
            .iter()
            .filter_map(|r| r.as_ref().err())
            .all(|e| *e == CloudError::QuotaExceeded)
    );
}

fn request(key: &str, pages: u64, cost: u64) -> ReservationRequest {
    ReservationRequest {
        key: key.into(),
        input_digest: "a".repeat(64),
        units: Units {
            ocr_pages: pages,
            ..Units::default()
        },
        maximum_usd_micros: cost,
    }
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn admission_limits_recreated_identity_and_revocation_are_durable() {
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let identity = common::identity();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite(identity.email(), now).unwrap();
    store
        .transact(&["pilot/roster".into()], |docs| {
            docs.insert("pilot/roster".into(), serde_json::json!({"count":300}));
            Ok(())
        })
        .unwrap();
    assert!(matches!(
        admission.admit(&identity, now),
        Err(CloudError::QuotaExceeded)
    ));
    store
        .transact(&["pilot/roster".into()], |docs| {
            docs.insert("pilot/roster".into(), serde_json::json!({"count":299}));
            Ok(())
        })
        .unwrap();
    let member = admission.admit(&identity, now).unwrap();
    assert!(matches!(
        admission.admit(&common::identity_named("otherUid", now), now),
        Err(CloudError::NotAdmitted)
    ));
    let path = format!("participants/{}", member.id);
    store
        .transact(std::slice::from_ref(&path), |docs| {
            docs.get_mut(&path).unwrap()["revokedBefore"] = now.into();
            Ok(())
        })
        .unwrap();
    assert!(matches!(
        admission.admit(&identity, now),
        Err(CloudError::Revoked)
    ));
    assert!(matches!(
        Ledger::new(store, policy).reserve(&identity, &request("revoked", 1, 6000), now),
        Err(CloudError::Revoked)
    ));
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn queues_slots_units_and_cancel_do_not_leak_or_duplicate_balance() {
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let identity = common::identity();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite(identity.email(), now).unwrap();
    admission.admit(&identity, now).unwrap();
    let ledger = Ledger::new(store, policy);
    let first = ledger
        .reserve(&identity, &request("first", 15, 6000), now)
        .unwrap();
    assert!(matches!(
        ledger.reserve(&identity, &request("full-queue", 1, 6000), now),
        Err(CloudError::Busy)
    ));
    ledger.mark_running(&identity, &first.id, now).unwrap();
    let second = ledger
        .reserve(&identity, &request("second", 15, 6000), now)
        .unwrap();
    assert_eq!(
        ledger.mark_running(&identity, &second.id, now),
        Err(CloudError::Busy)
    );
    ledger
        .cancel_before_start(&identity, &second.id, now)
        .unwrap();
    ledger
        .cancel_before_start(&identity, &second.id, now)
        .unwrap();
    assert_eq!(
        ledger.usage(&identity, now).unwrap().reserved_usd_micros,
        6000
    );
    ledger
        .settle_confirmed(&identity, &first.id, 6000, now)
        .unwrap();
    for key in ["third", "fourth"] {
        let job = ledger
            .reserve(&identity, &request(key, 15, 6000), now)
            .unwrap();
        ledger.mark_running(&identity, &job.id, now).unwrap();
        ledger
            .settle_confirmed(&identity, &job.id, 6000, now)
            .unwrap();
    }
    assert!(matches!(
        ledger.reserve(&identity, &request("over-pages", 6, 6000), now),
        Err(CloudError::QuotaExceeded)
    ));
    let last = ledger
        .reserve(&identity, &request("last-five", 5, 6000), now)
        .unwrap();
    ledger
        .cancel_before_start(&identity, &last.id, now)
        .unwrap();
    assert_eq!(ledger.usage(&identity, now).unwrap().used.ocr_pages, 45);
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn unknown_work_holds_money_units_and_slot_across_month_boundary() {
    use nexohub_server::cloud::ledger::BillingPeriod;
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let identity = common::identity();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite(identity.email(), now).unwrap();
    admission.admit(&identity, now).unwrap();
    let ledger = Ledger::new(store, policy);
    let paid = ledger
        .reserve(&identity, &request("previous-charge", 1, 6000), now)
        .unwrap();
    ledger.mark_running(&identity, &paid.id, now).unwrap();
    ledger
        .settle_confirmed(&identity, &paid.id, 4000, now)
        .unwrap();
    assert_eq!(ledger.usage(&identity, now).unwrap().used_usd_micros, 4000);
    let first = ledger
        .reserve(&identity, &request("unknown", 15, 6000), now)
        .unwrap();
    ledger.mark_running(&identity, &first.id, now).unwrap();
    ledger.mark_unknown(&identity, &first.id, now).unwrap();
    let next = BillingPeriod::at(now).unwrap().ends_at;
    assert_eq!(next, 2_001_222_000);
    let fresh = common::identity_named("nextMonth", next);
    let usage = ledger.usage(&fresh, next).unwrap();
    assert_eq!(usage.reserved_usd_micros, 6000);
    assert_eq!(usage.reserved.ocr_pages, 15);
    assert_eq!(usage.used_usd_micros, 0);
    assert_eq!(
        ledger.settle_confirmed(&fresh, &first.id, 4000, next),
        Err(CloudError::Conflict)
    );
    let queued = ledger
        .reserve(&fresh, &request("new-month", 1, 6000), next)
        .unwrap();
    assert_eq!(
        ledger.mark_running(&fresh, &queued.id, next),
        Err(CloudError::Busy)
    );
    ledger
        .cancel_before_start(&fresh, &queued.id, next)
        .unwrap();
    assert_eq!(
        ledger.usage(&fresh, next).unwrap().remaining_usd_micros,
        194_000
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn month_guard_and_one_of_one_hundred_queue_contenders() {
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let identity = Arc::new(common::identity());
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite(identity.email(), now).unwrap();
    admission.admit(&identity, now).unwrap();
    let guard = 2_001_222_000 - 900;
    let fresh = common::identity_named("monthGuard", guard);
    assert!(matches!(
        Ledger::new(store.clone(), policy.clone()).reserve(
            &fresh,
            &request("guard", 1, 6000),
            guard
        ),
        Err(CloudError::Busy)
    ));
    let mut threads = Vec::new();
    for i in 0..100 {
        let identity = identity.clone();
        let host = std::env::var("FIRESTORE_EMULATOR_HOST").unwrap();
        let project = store.project_id().to_owned();
        let policy = policy.clone();
        threads.push(std::thread::spawn(move || {
            Ledger::new(
                Arc::new(FirestoreStore::emulator(&host, &project).unwrap()),
                policy,
            )
            .reserve(&identity, &request(&format!("slot-{i}"), 1, 6000), now)
        }));
    }
    let results: Vec<_> = threads.into_iter().map(|t| t.join().unwrap()).collect();
    assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 1);
    assert!(
        results
            .iter()
            .filter_map(|r| r.as_ref().err())
            .all(|e| *e == CloudError::Busy)
    );
    let usage = Ledger::new(store, policy).usage(&identity, now).unwrap();
    assert_eq!(usage.reserved_usd_micros, 6000);
    assert_eq!(usage.reserved.ocr_pages, 1);
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn expired_invite_can_be_renewed_without_changing_participant_identity() {
    use sha2::{Digest, Sha256};
    let store = Arc::new(common::store());
    let admission = AdmissionService::new(store.clone(), CloudPolicy::pilot().unwrap());
    let now = common::now();
    let email = "person@example.invalid";
    admission.invite(email, now).unwrap();
    let path = format!("invitations/{:x}", Sha256::digest(email.as_bytes()));
    let before = store.get(&path).unwrap().unwrap();
    admission.invite(email, now + 604_801).unwrap();
    let after = store.get(&path).unwrap().unwrap();
    assert_eq!(after["participantId"], before["participantId"]);
    assert_eq!(
        after["expiresAt"].as_u64().unwrap(),
        now + 604_801 + 604_800
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn concurrent_invitations_cannot_bind_one_uid_to_multiple_participants() {
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite("person@example.invalid", now).unwrap();
    admission.invite("alternate@example.invalid", now).unwrap();
    let barrier = Arc::new(std::sync::Barrier::new(40));
    let mut threads = Vec::new();
    for i in 0..40 {
        let identity =
            common::identity_named(if i % 2 == 0 { "google" } else { "otherEmail" }, now);
        let policy = policy.clone();
        let project = store.project_id().to_owned();
        let barrier = barrier.clone();
        let host = std::env::var("FIRESTORE_EMULATOR_HOST").unwrap();
        threads.push(std::thread::spawn(move || {
            let admission = AdmissionService::new(
                Arc::new(FirestoreStore::emulator(&host, &project).unwrap()),
                policy,
            );
            barrier.wait();
            admission.admit(&identity, now)
        }));
    }
    let ids: std::collections::BTreeSet<_> = threads
        .into_iter()
        .filter_map(|t| t.join().unwrap().ok())
        .map(|m| m.id)
        .collect();
    assert_eq!(ids.len(), 1);
    assert_eq!(store.get("pilot/roster").unwrap().unwrap()["count"], 1);
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn subsidy_uses_exact_integer_micros_and_suspended_participant_cannot_reserve() {
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let identity = common::identity();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite(identity.email(), now).unwrap();
    let member = admission.admit(&identity, now).unwrap();
    let ledger = Ledger::new(store.clone(), policy);
    assert!(matches!(
        ledger.reserve(&identity, &request("one-micro-over", 1, 200_001), now),
        Err(CloudError::QuotaExceeded)
    ));
    let exact = ledger
        .reserve(&identity, &request("exact", 1, 200_000), now)
        .unwrap();
    assert_eq!(
        ledger.usage(&identity, now).unwrap().remaining_usd_micros,
        0
    );
    ledger
        .cancel_before_start(&identity, &exact.id, now)
        .unwrap();
    assert_eq!(
        ledger.usage(&identity, now).unwrap().remaining_usd_micros,
        200_000
    );
    let path = format!("participants/{}", member.id);
    store
        .transact(std::slice::from_ref(&path), |docs| {
            docs.get_mut(&path).unwrap()["active"] = false.into();
            Ok(())
        })
        .unwrap();
    assert!(matches!(
        ledger.reserve(&identity, &request("suspended", 1, 6000), now),
        Err(CloudError::NotAdmitted)
    ));
}
