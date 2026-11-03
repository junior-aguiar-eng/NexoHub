//! Ensaio de carga do piloto contra o emulador do Firestore: 300 participantes sintéticos,
//! duas instâncias independentes do ledger e o relógio injetado. Não usa nuvem real nem dinheiro.
use nexohub_server::cloud::{
    CloudError,
    admission::AdmissionService,
    auth::{AccountStatus, FirebaseVerifier, IdentityAuthority, PublicKeys, VerifiedIdentity},
    firestore::FirestoreStore,
    ledger::{BillingPeriod, Ledger, Reservation, ReservationRequest, Units},
    policy::CloudPolicy,
    providers::{FakeProvider, ProviderDone, ProviderError},
};
use serde_json::Value;
use std::{
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    thread,
    time::Instant,
};

#[allow(dead_code)] // cada teste usa só parte dos auxiliares compartilhados
mod common;

const LOAD: &str = include_str!("fixtures/firebase-load.json");
/// Máximo reservado por trabalho: dois trabalhos esgotam exatamente a franquia de 200.000.
const JOB_MAX: u64 = 100_000;
const OK: Result<ProviderDone, ProviderError> = Ok(ProviderDone {
    cost_usd_micros: JOB_MAX,
});

struct Authority(Value);
impl IdentityAuthority for Authority {
    fn public_keys(&self) -> Result<PublicKeys, CloudError> {
        Ok(PublicKeys {
            jwks: self.0["jwks"].clone(),
            max_age_seconds: 300,
        })
    }
    fn account_status(&self, uid: &str) -> Result<AccountStatus, CloudError> {
        Ok(AccountStatus {
            uid: uid.into(),
            email: format!("{uid}@example.invalid"),
            email_verified: true,
            disabled: false,
            valid_since: 0,
        })
    }
}

#[derive(Clone)]
struct Member {
    who: VerifiedIdentity,
    id: String,
}

struct Lab {
    store: Arc<FirestoreStore>,
    /// Duas instâncias independentes contra o mesmo Firestore, como duas réplicas do Cloud Run.
    a: Arc<Ledger>,
    b: Arc<Ledger>,
    members: Vec<Member>,
    now: u64,
}

fn identities() -> (Vec<VerifiedIdentity>, u64) {
    let data: Value = serde_json::from_str(LOAD).unwrap();
    let now = data["now"].as_u64().unwrap();
    let verifier =
        FirebaseVerifier::new("demo-nexohub-hybrid", Arc::new(Authority(data.clone()))).unwrap();
    let list = data["tokens"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| verifier.authenticate(t.as_str().unwrap(), now).unwrap())
        .collect();
    (list, now)
}

/// Convida e admite `n` participantes em 6 threads (a lista de vagas é um único documento).
fn lab(n: usize) -> Lab {
    let (all, now) = identities();
    let store = Arc::new(common::store());
    let policy = CloudPolicy::pilot().unwrap();
    let admission = Arc::new(AdmissionService::new(store.clone(), policy.clone()));
    for who in &all {
        admission.invite(who.email(), now).unwrap();
    }
    let chunks: Vec<Vec<VerifiedIdentity>> = all
        .iter()
        .take(n)
        .cloned()
        .collect::<Vec<_>>()
        .chunks(n.div_ceil(6).max(1))
        .map(<[_]>::to_vec)
        .collect();
    let members = chunks
        .into_iter()
        .map(|chunk| {
            let admission = admission.clone();
            thread::spawn(move || {
                chunk
                    .into_iter()
                    .map(|who| {
                        let id = retry(|| admission.admit(&who, now)).unwrap().id;
                        Member { who, id }
                    })
                    .collect::<Vec<_>>()
            })
        })
        .collect::<Vec<_>>()
        .into_iter()
        .flat_map(|h| h.join().unwrap())
        .collect();
    Lab {
        a: Arc::new(Ledger::new(store.clone(), policy.clone())),
        b: Arc::new(Ledger::new(store.clone(), policy)),
        store,
        members,
        now,
    }
}

/// Cliente que insiste quando o Firestore esgota as tentativas por contenção; nunca quando a
/// recusa é de regra (Busy, cota, orçamento).
/// Quantas vezes o cliente precisou repetir por contenção (exaustão das tentativas do Firestore).
static RETRIES: AtomicUsize = AtomicUsize::new(0);

fn retry<T>(mut f: impl FnMut() -> Result<T, CloudError>) -> Result<T, CloudError> {
    let mut last = CloudError::Unavailable;
    for _ in 0..8 {
        match f() {
            Err(CloudError::Unavailable | CloudError::Conflict) => {
                RETRIES.fetch_add(1, Ordering::Relaxed);
                last = CloudError::Unavailable
            }
            other => return other,
        }
        thread::sleep(std::time::Duration::from_millis(40));
    }
    Err(last)
}

fn request(key: &str, maximum: u64) -> ReservationRequest {
    ReservationRequest {
        key: key.into(),
        input_digest: "a".repeat(64),
        units: Units {
            ocr_pages: 3,
            characters: 0,
            office_files: 0,
        },
        maximum_usd_micros: maximum,
    }
}

fn holds(lab: &Lab) -> Value {
    lab.store.get("pilot/holds").unwrap().unwrap_or(Value::Null)
}
fn count(v: &Value, field: &str) -> u64 {
    v[field].as_u64().unwrap_or(0)
}

/// Ciclo completo de um trabalho: reserva → assume → executa → liquida.
fn run_job(lab: &Lab, m: &Member, key: &str, ledger: &Ledger) -> Result<Reservation, CloudError> {
    let job = retry(|| ledger.reserve(&m.who, &request(key, JOB_MAX), lab.now))?;
    let lease = retry(|| ledger.claim_job(&m.id, &job.id, lab.now))?;
    ledger.execute(&m.id, &lease, &FakeProvider::new(OK), lab.now)?;
    Ok(job)
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn roster_admits_exactly_300_and_refuses_the_301st() {
    let started = Instant::now();
    let lab = lab(300);
    println!(
        "admissão concorrente de 300 em {:?}; repetições por contenção: {}",
        started.elapsed(),
        RETRIES.load(Ordering::Relaxed)
    );
    assert_eq!(lab.members.len(), 300);
    let roster = lab.store.get("pilot/roster").unwrap().unwrap();
    assert_eq!(roster["count"], 300);
    let (all, now) = identities();
    let admission = AdmissionService::new(lab.store.clone(), CloudPolicy::pilot().unwrap());
    assert_eq!(
        admission.admit(&all[300], now).err(),
        Some(CloudError::QuotaExceeded)
    );
    // Quem já está dentro continua entrando (idempotente) e o contador não muda.
    assert_eq!(admission.admit(&all[0], now).unwrap().id, lab.members[0].id);
    assert_eq!(
        lab.store.get("pilot/roster").unwrap().unwrap()["count"],
        300
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn queue_fills_to_exactly_20_when_40_participants_race() {
    let lab = lab(40);
    let results: Vec<_> = lab
        .members
        .iter()
        .enumerate()
        .map(|(i, m)| {
            let ledger = if i % 2 == 0 {
                lab.a.clone()
            } else {
                lab.b.clone()
            };
            let (m, now) = (m.clone(), lab.now);
            thread::spawn(move || retry(|| ledger.reserve(&m.who, &request("job", JOB_MAX), now)))
        })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|h| h.join().unwrap())
        .collect();
    let ok = results.iter().filter(|r| r.is_ok()).count();
    let busy = results
        .iter()
        .filter(|r| matches!(r, Err(CloudError::Busy)))
        .count();
    assert_eq!((ok, busy), (20, 20), "{results:?}");
    let h = holds(&lab);
    assert_eq!(count(&h, "queued"), 20);
    assert_eq!(count(&h, "reservedUsdMicros"), 20 * JOB_MAX);
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn at_most_two_jobs_run_at_once_across_two_instances() {
    let lab = lab(20);
    let jobs: Vec<_> = lab
        .members
        .iter()
        .map(|m| {
            (
                m.clone(),
                lab.a
                    .reserve(&m.who, &request("job", JOB_MAX), lab.now)
                    .unwrap(),
            )
        })
        .collect();
    let granted: Vec<_> = jobs
        .iter()
        .enumerate()
        .map(|(i, (m, job))| {
            let ledger = if i % 2 == 0 {
                lab.a.clone()
            } else {
                lab.b.clone()
            };
            let (pid, id, now) = (m.id.clone(), job.id.clone(), lab.now);
            thread::spawn(move || retry(|| ledger.claim_job(&pid, &id, now)))
        })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|h| h.join().unwrap())
        .collect();
    assert_eq!(
        granted.iter().filter(|r| r.is_ok()).count(),
        2,
        "{granted:?}"
    );
    assert_eq!(
        granted
            .iter()
            .filter(|r| matches!(r, Err(CloudError::Busy)))
            .count(),
        18
    );
    assert_eq!(count(&holds(&lab), "running"), 2);

    // Liquidar um libera exatamente uma vaga: o teto de 2 continua valendo.
    let leases: Vec<_> = granted.into_iter().flatten().collect();
    let (m0, _) = jobs.iter().find(|(_, j)| j.id == leases[0].job_id).unwrap();
    lab.a
        .execute(&m0.id, &leases[0], &FakeProvider::new(OK), lab.now)
        .unwrap();
    assert_eq!(count(&holds(&lab), "running"), 1);
    let next = jobs
        .iter()
        .find(|(_, j)| leases.iter().all(|l| l.job_id != j.id))
        .unwrap();
    assert!(lab.b.claim_job(&next.0.id, &next.1.id, lab.now).is_ok());
    assert_eq!(count(&holds(&lab), "running"), 2);
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn retries_of_the_same_job_from_two_instances_reserve_only_once() {
    let lab = lab(1);
    let m = lab.members[0].clone();
    let ids: Vec<_> = (0..40)
        .map(|i| {
            let ledger = if i % 2 == 0 {
                lab.a.clone()
            } else {
                lab.b.clone()
            };
            let (m, now) = (m.clone(), lab.now);
            thread::spawn(move || {
                retry(|| ledger.reserve(&m.who, &request("mesmo", JOB_MAX), now))
                    .unwrap()
                    .id
            })
        })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|h| h.join().unwrap())
        .collect();
    assert!(ids.iter().all(|id| *id == ids[0]));
    let h = holds(&lab);
    assert_eq!(
        (count(&h, "queued"), count(&h, "reservedUsdMicros")),
        (1, JOB_MAX)
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn all_300_exhausting_their_balance_never_exceed_the_60_dollar_pool() {
    let started = Instant::now();
    let lab = lab(300);
    for (i, m) in lab.members.iter().enumerate() {
        let ledger = if i % 2 == 0 { &lab.a } else { &lab.b };
        run_job(&lab, m, "um", ledger).unwrap();
        run_job(&lab, m, "dois", ledger).unwrap();
    }
    println!(
        "600 trabalhos completos em {:?}; repetições por contenção (acumuladas): {}",
        started.elapsed(),
        RETRIES.load(Ordering::Relaxed)
    );

    let period = BillingPeriod::at(lab.now).unwrap();
    let pool = lab
        .store
        .get(&format!("periods/{}", period.id))
        .unwrap()
        .unwrap();
    // 300 × 200.000 = 60.000.000 micro-USD = exatamente o pool de tarefas, nem um a mais.
    assert_eq!(pool["usedUsdMicros"], 60_000_000);
    let used: u64 = lab
        .members
        .iter()
        .map(|m| lab.a.usage(&m.who, lab.now).unwrap().used_usd_micros)
        .sum();
    assert_eq!(used, 60_000_000);
    let h = holds(&lab);
    assert_eq!(
        (
            count(&h, "queued"),
            count(&h, "running"),
            count(&h, "reservedUsdMicros")
        ),
        (0, 0, 0)
    );

    // Esgotado: nenhum participante consegue mais nada, e o motivo é de saldo.
    for m in lab.members.iter().step_by(37) {
        let err = lab
            .b
            .reserve(&m.who, &request("extra", 1), lab.now)
            .unwrap_err();
        assert!(
            matches!(err, CloudError::BudgetExceeded | CloudError::QuotaExceeded),
            "{err:?}"
        );
    }
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn the_last_micro_dollar_is_exact_and_one_more_is_refused() {
    let lab = lab(1);
    let m = &lab.members[0];
    run_job(&lab, m, "um", &lab.a).unwrap(); // usa 100.000 de 200.000
    let remaining = lab.a.usage(&m.who, lab.now).unwrap().remaining_usd_micros;
    assert_eq!(remaining, 100_000);
    assert_eq!(
        lab.b
            .reserve(&m.who, &request("acima", remaining + 1), lab.now)
            .unwrap_err(),
        CloudError::QuotaExceeded
    );
    assert!(
        lab.b
            .reserve(&m.who, &request("exato", remaining), lab.now)
            .is_ok()
    );
    assert_eq!(
        lab.a.usage(&m.who, lab.now).unwrap().remaining_usd_micros,
        0
    );
}

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST local"]
fn month_rollover_renews_balances_and_the_boundary_guard_refuses_new_work() {
    let lab = lab(1);
    let m = &lab.members[0];
    run_job(&lab, m, "um", &lab.a).unwrap();
    run_job(&lab, m, "dois", &lab.a).unwrap();
    assert_eq!(
        lab.a.usage(&m.who, lab.now).unwrap().remaining_usd_micros,
        0
    );
    assert!(
        lab.a
            .reserve(&m.who, &request("sem-saldo", 1), lab.now)
            .is_err()
    );

    // Tokens emitidos nos instantes certos (a identidade sintética vale 1 h).
    let data: Value = serde_json::from_str(LOAD).unwrap();
    let verifier =
        FirebaseVerifier::new("demo-nexohub-hybrid", Arc::new(Authority(data.clone()))).unwrap();
    let at = |name: &str| {
        let r = &data["rollover"];
        let t = r[format!("{name}At")].as_u64().unwrap();
        (
            verifier.authenticate(r[name].as_str().unwrap(), t).unwrap(),
            t,
        )
    };

    // Janela de proteção: nos últimos 15 min do mês nenhum trabalho novo entra.
    assert_eq!(
        BillingPeriod::at(lab.now).unwrap().ends_at,
        data["rollover"]["monthEnd"]
    );
    let (late, late_at) = at("guard");
    assert_eq!(
        lab.a
            .reserve(&late, &request("guarda", JOB_MAX), late_at)
            .unwrap_err(),
        CloudError::Busy
    );

    // No mês seguinte a franquia volta inteira e o trabalho entra normalmente.
    let (next, next_at) = at("next");
    let renewed = lab.b.usage(&next, next_at).unwrap();
    assert_eq!(
        (renewed.used_usd_micros, renewed.remaining_usd_micros),
        (0, 200_000)
    );
    assert!(
        lab.b
            .reserve(&next, &request("mes-novo", JOB_MAX), next_at)
            .is_ok()
    );
    // O mês anterior segue como estava: nada foi devolvido nem duplicado.
    assert_eq!(
        lab.a.usage(&m.who, lab.now).unwrap().used_usd_micros,
        200_000
    );
}
