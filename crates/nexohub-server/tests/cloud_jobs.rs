use nexohub_server::cloud::{
    CloudError,
    jobs::{JobEngine, JobState, Proof, Reconciliation},
    policy::CloudPolicy,
    providers::{FakeProvider, Provider, ProviderDone, ProviderError},
    quotes::CloudTool,
};

const T: u64 = 1_000;
const OK: Result<ProviderDone, ProviderError> = Ok(ProviderDone {
    cost_usd_micros: 500,
});

fn engine() -> JobEngine {
    JobEngine::new(CloudPolicy::pilot().unwrap())
}
fn job(e: &JobEngine, id: &str, who: &str) {
    e.enqueue(id, who, CloudTool::Ocr, 1_000, T).unwrap();
}

#[test]
fn duplicate_delivery_calls_provider_once() {
    let e = engine();
    let p = FakeProvider::new(OK);
    job(&e, "a", "p1");
    job(&e, "a", "p1"); // mesma mensagem reentregue
    assert_eq!(e.dispatch_pending(), vec!["a"]);
    let lease = e.claim("a", T).unwrap();
    assert_eq!(e.claim("a", T).unwrap_err(), CloudError::Busy); // segundo worker
    e.execute(&lease, &p, T).unwrap();
    assert_eq!(e.execute(&lease, &p, T).unwrap_err(), CloudError::Conflict);
    assert_eq!(p.calls(), 1);
    assert_eq!(e.state("a").unwrap(), JobState::Settled);
    assert_eq!(e.held_slots(), 0);
}

#[test]
fn restart_after_send_never_resends_and_keeps_slot() {
    let e = engine();
    let p = FakeProvider::new(Err(ProviderError::Unknown));
    job(&e, "a", "p1");
    let lease = e.claim("a", T).unwrap();
    assert_eq!(
        e.execute(&lease, &p, T).unwrap_err(),
        CloudError::ReconciliationRequired
    );
    assert_eq!(e.state("a").unwrap(), JobState::NeedsReconciliation);
    assert_eq!(e.held_slots(), 1);
    // Reinício/novo worker tenta de novo: nada é reenviado.
    assert_eq!(
        e.claim("a", T + 10_000).unwrap_err(),
        CloudError::ReconciliationRequired
    );
    assert_eq!(p.calls(), 1);
}

struct Racing<'a> {
    engine: &'a JobEngine,
    seen: std::sync::Mutex<Option<CloudError>>,
    calls: std::sync::atomic::AtomicU64,
}
impl Provider for Racing<'_> {
    fn invoke(&self, _key: &str, _tool: CloudTool) -> Result<ProviderDone, ProviderError> {
        self.calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        // Enquanto a chamada está em andamento, o lease vence e outro worker tenta assumir.
        *self.seen.lock().unwrap() = self.engine.claim("a", T + 10_000).err();
        Ok(ProviderDone {
            cost_usd_micros: 500,
        })
    }
}

#[test]
fn expired_lease_after_external_start_does_not_free_or_repeat() {
    let e = engine();
    job(&e, "a", "p1");
    let lease = e.claim("a", T).unwrap();
    let p = Racing {
        engine: &e,
        seen: Default::default(),
        calls: Default::default(),
    };
    // O segundo worker não repete a chamada nem libera a vaga; a resposta original ainda liquida.
    e.execute(&lease, &p, T).unwrap();
    assert_eq!(
        *p.seen.lock().unwrap(),
        Some(CloudError::ReconciliationRequired)
    );
    assert_eq!(p.calls.load(std::sync::atomic::Ordering::SeqCst), 1);
    assert_eq!(e.state("a").unwrap(), JobState::Settled);
}

#[test]
fn lease_expired_before_start_can_be_reclaimed_with_new_fence() {
    let e = engine();
    let p = FakeProvider::new(OK);
    job(&e, "a", "p1");
    let old = e.claim("a", T).unwrap();
    let new = e.claim("a", T + 1_000).unwrap(); // lease do primeiro expirou sem iniciar
    assert!(new.fence > old.fence);
    assert_eq!(
        e.execute(&old, &p, T + 1_000).unwrap_err(),
        CloudError::Conflict
    );
    assert_eq!(p.calls(), 0);
    e.execute(&new, &p, T + 1_000).unwrap();
    assert_eq!(p.calls(), 1);
}

#[test]
fn unknown_then_proof_settles_or_releases() {
    let e = engine();
    let p = FakeProvider::new(Err(ProviderError::Unknown));
    job(&e, "a", "p1");
    job(&e, "b", "p2");
    for id in ["a", "b"] {
        let l = e.claim(id, T).unwrap();
        let _ = e.execute(&l, &p, T);
    }
    assert_eq!(
        e.reconcile("a", Some(Proof::Completed(900)), T + 5)
            .unwrap(),
        Reconciliation::Resolved
    );
    assert_eq!(e.state("a").unwrap(), JobState::Settled);
    assert_eq!(
        e.reconcile("b", Some(Proof::NotConsumed), T + 5).unwrap(),
        Reconciliation::Resolved
    );
    assert_eq!(e.state("b").unwrap(), JobState::Failed);
    assert_eq!(e.held_slots(), 0);
    assert_eq!(
        e.reconcile("a", Some(Proof::Completed(1)), T + 9).unwrap(),
        Reconciliation::AlreadyFinal
    );
}

#[test]
fn proof_above_reserved_maximum_is_refused() {
    let e = engine();
    let p = FakeProvider::new(Err(ProviderError::Unknown));
    job(&e, "a", "p1");
    let l = e.claim("a", T).unwrap();
    let _ = e.execute(&l, &p, T);
    assert_eq!(
        e.reconcile("a", Some(Proof::Completed(1_001)), T)
            .unwrap_err(),
        CloudError::InvalidRequest
    );
    assert_eq!(e.state("a").unwrap(), JobState::NeedsReconciliation);
}

#[test]
fn ten_minutes_without_proof_quarantines_engine_without_freeing_slot() {
    let e = engine();
    let p = FakeProvider::new(Err(ProviderError::Unknown));
    job(&e, "a", "p1");
    let l = e.claim("a", T).unwrap();
    let _ = e.execute(&l, &p, T);
    assert_eq!(
        e.reconcile("a", None, T + 599).unwrap(),
        Reconciliation::Pending
    );
    assert_eq!(
        e.reconcile("a", None, T + 600).unwrap(),
        Reconciliation::Quarantined
    );
    assert_eq!(e.held_slots(), 1);
    e.enqueue("c", "p2", CloudTool::Ocr, 1_000, T + 600)
        .unwrap();
    assert_eq!(e.claim("c", T + 601).unwrap_err(), CloudError::Busy);
    e.reconcile("a", Some(Proof::NotConsumed), T + 700).unwrap();
    assert!(e.claim("c", T + 701).is_ok());
}

#[test]
fn concurrency_limits_global_and_per_participant() {
    let e = engine();
    for (id, who) in [("a", "p1"), ("b", "p1"), ("c", "p2"), ("d", "p3")] {
        job(&e, id, who);
    }
    e.claim("a", T).unwrap();
    assert_eq!(e.claim("b", T).unwrap_err(), CloudError::Busy); // 1 por participante
    e.claim("c", T).unwrap();
    assert_eq!(e.claim("d", T).unwrap_err(), CloudError::Busy); // 2 globais
}

#[test]
fn queue_wait_is_capped_at_five_minutes() {
    let e = engine();
    job(&e, "a", "p1");
    assert_eq!(e.claim("a", T + 301).unwrap_err(), CloudError::Busy);
    assert_eq!(e.state("a").unwrap(), JobState::Cancelled);
}

#[test]
fn cancel_before_call_releases_but_after_call_keeps_cost() {
    let e = engine();
    let p = FakeProvider::new(Err(ProviderError::Unknown));
    job(&e, "a", "p1");
    let lease = e.claim("a", T).unwrap();
    e.cancel("a").unwrap();
    assert_eq!(e.held_slots(), 0);
    assert_eq!(e.execute(&lease, &p, T).unwrap_err(), CloudError::Conflict);
    assert_eq!(p.calls(), 0);

    job(&e, "b", "p1");
    let l = e.claim("b", T).unwrap();
    let _ = e.execute(&l, &p, T);
    assert_eq!(e.cancel("b").unwrap_err(), CloudError::Conflict);
    assert_eq!(e.held_slots(), 1);
}

#[test]
fn rejected_before_consumption_releases_slot() {
    let e = engine();
    let p = FakeProvider::new(Err(ProviderError::Rejected));
    job(&e, "a", "p1");
    let l = e.claim("a", T).unwrap();
    assert_eq!(e.execute(&l, &p, T).unwrap_err(), CloudError::Unavailable);
    assert_eq!(e.state("a").unwrap(), JobState::Failed);
    assert_eq!(e.held_slots(), 0);
}

#[test]
fn cost_above_reservation_is_not_settled() {
    let e = engine();
    let p = FakeProvider::new(Ok(ProviderDone {
        cost_usd_micros: 2_000,
    }));
    job(&e, "a", "p1");
    let l = e.claim("a", T).unwrap();
    assert_eq!(
        e.execute(&l, &p, T).unwrap_err(),
        CloudError::ReconciliationRequired
    );
    assert_eq!(e.state("a").unwrap(), JobState::NeedsReconciliation);
}

#[test]
fn enqueue_with_other_owner_conflicts() {
    let e = engine();
    job(&e, "a", "p1");
    assert_eq!(
        e.enqueue("a", "p2", CloudTool::Ocr, 1_000, T).unwrap_err(),
        CloudError::Conflict
    );
}
