use nexohub_server::cloud::{CloudError, firestore::FirestoreStore};
use serde_json::json;
use std::sync::Arc;

#[test]
#[ignore = "Requer FIRESTORE_EMULATOR_HOST em loopback; não usa nuvem"]
fn transactions_are_persistent_and_contend_across_independent_clients() {
    let host = std::env::var("FIRESTORE_EMULATOR_HOST").expect("Emulador obrigatório");
    let project = format!("demo-nh-{}", uuid::Uuid::new_v4().simple());
    let first = Arc::new(FirestoreStore::emulator(&host, &project).unwrap());
    first
        .transact(&["test/counter".into()], |docs| {
            docs.insert("test/counter".into(), json!({"remaining": 10_000}));
            Ok(())
        })
        .unwrap();
    let mut threads = Vec::new();
    for _ in 0..100 {
        let store = FirestoreStore::emulator(&host, &project).unwrap();
        threads.push(std::thread::spawn(move || {
            store.transact(&["test/counter".into()], |docs| {
                let balance = docs["test/counter"]["remaining"].as_u64().unwrap();
                if balance < 6_000 {
                    return Err(CloudError::BudgetExceeded);
                }
                docs.insert("test/counter".into(), json!({"remaining": balance - 6_000}));
                Ok(())
            })
        }));
    }
    let successes = threads
        .into_iter()
        .map(|t| t.join().unwrap())
        .filter(Result::is_ok)
        .count();
    assert_eq!(successes, 1);
    drop(first);
    let reopened = FirestoreStore::emulator(&host, &project).unwrap();
    assert_eq!(
        reopened.get("test/counter").unwrap().unwrap()["remaining"],
        4_000
    );
}

#[test]
fn emulator_constructor_refuses_remote_targets_and_real_projects() {
    assert!(FirestoreStore::emulator("example.com:8080", "demo-test").is_err());
    assert!(FirestoreStore::emulator("127.0.0.1:8080", "production-project").is_err());
}
