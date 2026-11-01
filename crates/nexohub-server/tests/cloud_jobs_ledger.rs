use nexohub_server::cloud::{
    CloudError,
    admission::AdmissionService,
    auth::VerifiedIdentity,
    firestore::FirestoreStore,
    jobs::{Proof, Reconciliation},
    ledger::{Ledger, Reservation, ReservationRequest, Units},
    policy::CloudPolicy,
    providers::{FakeProvider, ProviderDone, ProviderError},
};
use std::sync::Arc;

mod common;

const OK: Result<ProviderDone, ProviderError> = Ok(ProviderDone {
    cost_usd_micros: 4_000,
});

struct World {
    store: Arc<FirestoreStore>,
    ledger: Arc<Ledger>,
    now: u64,
}
fn world() -> World {
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let now = common::now();
    let admission = AdmissionService::new(store.clone(), policy.clone());
    admission.invite("person@example.invalid", now).unwrap();
    admission.invite("alternate@example.invalid", now).unwrap();
    World {
        ledger: Arc::new(Ledger::new(store.clone(), policy)),
        store,
        now,
    }
}
fn member(w: &World, who: &VerifiedIdentity) -> String {
    let policy = CloudPolicy::pilot().unwrap();
    AdmissionService::new(w.store.clone(), policy)
        .admit(who, w.now)
        .unwrap()
        .id
}
fn reserve(w: &World, who: &VerifiedIdentity, key: &str) -> Reservation {
    w.ledger
        .reserve(
            who,
            &ReservationRequest {
                key: key.into(),
                input_digest: "a".repeat(64),
                units: Units {
                    ocr_pages: 3,
                    characters: 0,
                    office_files: 0,
                },
                maximum_usd_micros: 6_000,
            },
            w.now,
        )
        .unwrap()
}
fn state(w: &World, id: &str) -> String {
    w.store.get(&format!("reservations/{id}")).unwrap().unwrap()["state"]
        .as_str()
        .unwrap()
        .to_owned()
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn claim_execute_settles_once_and_duplicates_are_refused() {
    let w = world();
    let who = common::identity();
    let pid = member(&w, &who);
    let job = reserve(&w, &who, "a");
    let p = FakeProvider::new(OK);
    let lease = w.ledger.claim_job(&pid, &job.id, w.now).unwrap();
    assert_eq!(
        w.ledger.claim_job(&pid, &job.id, w.now).unwrap_err(),
        CloudError::Busy
    );
    w.ledger.execute(&pid, &lease, &p, w.now).unwrap();
    assert_eq!(
        w.ledger.execute(&pid, &lease, &p, w.now).unwrap_err(),
        CloudError::Conflict
    );
    assert_eq!(p.calls(), 1);
    assert_eq!(state(&w, &job.id), "settled");
    let usage = w.ledger.usage(&who, w.now).unwrap();
    assert_eq!(
        (usage.used_usd_micros, usage.reserved_usd_micros),
        (4_000, 0)
    );
    assert_eq!(usage.used.ocr_pages, 3);
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn restart_after_external_start_never_resends_and_keeps_money_held() {
    let w = world();
    let who = common::identity();
    let pid = member(&w, &who);
    let job = reserve(&w, &who, "a");
    let lease = w.ledger.claim_job(&pid, &job.id, w.now).unwrap();
    w.ledger.begin_external(&pid, &lease, w.now).unwrap();
    // O worker morre aqui. Um ledger novo (outra instância) assume depois do lease.
    let other = Ledger::new(w.store.clone(), CloudPolicy::pilot().unwrap());
    assert_eq!(
        other.claim_job(&pid, &job.id, w.now + 1_000).unwrap_err(),
        CloudError::ReconciliationRequired
    );
    assert_eq!(state(&w, &job.id), "needs_reconciliation");
    assert_eq!(
        w.ledger.usage(&who, w.now).unwrap().reserved_usd_micros,
        6_000
    );
    // Segunda tentativa de executar com o mesmo lease é recusada.
    let p = FakeProvider::new(OK);
    assert!(w.ledger.execute(&pid, &lease, &p, w.now + 1_000).is_err());
    assert_eq!(p.calls(), 0);
    assert_eq!(
        other
            .reconcile_job(&pid, &job.id, Some(Proof::Completed(4_000)), w.now + 1_001)
            .unwrap(),
        Reconciliation::Resolved
    );
    let usage = w.ledger.usage(&who, w.now).unwrap();
    assert_eq!(
        (usage.used_usd_micros, usage.reserved_usd_micros),
        (4_000, 0)
    );
    assert_eq!(
        other
            .reconcile_job(&pid, &job.id, Some(Proof::Completed(1)), w.now + 2_000)
            .unwrap(),
        Reconciliation::AlreadyFinal
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn only_one_of_many_concurrent_workers_wins_the_claim() {
    let w = world();
    let who = common::identity();
    let pid = member(&w, &who);
    let job = reserve(&w, &who, "a");
    let wins: usize = (0..8)
        .map(|_| {
            let (ledger, pid, id, now) = (w.ledger.clone(), pid.clone(), job.id.clone(), w.now);
            std::thread::spawn(move || ledger.claim_job(&pid, &id, now).is_ok())
        })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|h| usize::from(h.join().unwrap()))
        .sum();
    assert_eq!(wins, 1);
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn cancel_releases_before_the_call_and_is_refused_after() {
    let w = world();
    let who = common::identity();
    let pid = member(&w, &who);
    let job = reserve(&w, &who, "a");
    let stale = w.ledger.claim_job(&pid, &job.id, w.now).unwrap();
    w.ledger.cancel_job(&pid, &job.id, w.now).unwrap();
    assert_eq!(w.ledger.usage(&who, w.now).unwrap().reserved_usd_micros, 0);
    assert_eq!(
        w.ledger.begin_external(&pid, &stale, w.now).unwrap_err(),
        CloudError::Conflict
    );

    let job = reserve(&w, &who, "b");
    let lease = w.ledger.claim_job(&pid, &job.id, w.now).unwrap();
    w.ledger.begin_external(&pid, &lease, w.now).unwrap();
    assert_eq!(
        w.ledger.cancel_job(&pid, &job.id, w.now).unwrap_err(),
        CloudError::Conflict
    );
    assert_eq!(
        w.ledger.usage(&who, w.now).unwrap().reserved_usd_micros,
        6_000
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn unknown_outcome_quarantines_engine_until_proof() {
    let w = world();
    let who = common::identity();
    let pid = member(&w, &who);
    let first = reserve(&w, &who, "a");
    let lease = w.ledger.claim_job(&pid, &first.id, w.now).unwrap();
    let p = FakeProvider::new(Err(ProviderError::Unknown));
    assert_eq!(
        w.ledger.execute(&pid, &lease, &p, w.now).unwrap_err(),
        CloudError::ReconciliationRequired
    );
    let quarantined = || {
        w.store.get("pilot/holds").unwrap().unwrap()["quarantined"]
            .as_array()
            .map(|v| v.len())
            .unwrap_or(0)
    };
    assert_eq!(
        w.ledger
            .reconcile_job(&pid, &first.id, None, w.now + 599)
            .unwrap(),
        Reconciliation::Pending
    );
    assert_eq!(quarantined(), 0);
    assert_eq!(
        w.ledger
            .reconcile_job(&pid, &first.id, None, w.now + 600)
            .unwrap(),
        Reconciliation::Quarantined
    );
    assert_eq!(quarantined(), 1);
    // A vaga continua ocupada e o dinheiro retido; o motor segue em quarentena.
    assert_eq!(
        w.ledger.usage(&who, w.now).unwrap().reserved_usd_micros,
        6_000
    );
    assert_eq!(
        w.ledger
            .reconcile_job(&pid, &first.id, Some(Proof::NotConsumed), w.now + 700)
            .unwrap(),
        Reconciliation::Resolved
    );
    assert_eq!(quarantined(), 0);
    assert_eq!(state(&w, &first.id), "failed");
    assert_eq!(w.ledger.usage(&who, w.now).unwrap().reserved_usd_micros, 0);
    let second = reserve(&w, &who, "b");
    assert!(w.ledger.claim_job(&pid, &second.id, w.now + 10).is_ok());
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn queue_wait_is_capped_and_releases_the_reservation() {
    let w = world();
    let who = common::identity();
    let pid = member(&w, &who);
    let job = reserve(&w, &who, "a");
    assert_eq!(
        w.ledger.claim_job(&pid, &job.id, w.now + 301).unwrap_err(),
        CloudError::Busy
    );
    assert_eq!(state(&w, &job.id), "cancelled");
    assert_eq!(w.ledger.usage(&who, w.now).unwrap().reserved_usd_micros, 0);
}
