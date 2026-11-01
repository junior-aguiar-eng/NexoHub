use nexohub_server::cloud::{
    CloudError,
    policy::CloudPolicy,
    storage::{MemoryObjects, Storage, read_limited},
};
use std::{
    io::Cursor,
    sync::Arc,
    time::{Duration, Instant},
};

fn storage() -> Storage<MemoryObjects> {
    Storage::new(
        Arc::new(MemoryObjects::default()),
        CloudPolicy::pilot().unwrap(),
    )
}
fn soon() -> Instant {
    Instant::now() + Duration::from_secs(60)
}

#[test]
fn read_limited_refuses_instead_of_truncating() {
    let data = vec![7u8; 11];
    assert_eq!(
        read_limited(Cursor::new(&data), 10, soon()).unwrap_err(),
        CloudError::InvalidRequest
    );
    assert_eq!(read_limited(Cursor::new(&data), 11, soon()).unwrap(), data);
}

#[test]
fn read_limited_enforces_deadline() {
    let past = Instant::now() - Duration::from_secs(1);
    assert_eq!(
        read_limited(Cursor::new(vec![1u8; 4]), 10, past).unwrap_err(),
        CloudError::Unavailable
    );
}

#[test]
fn upload_stores_object_and_generation_changes_on_replace() {
    let s = storage();
    let a = s
        .put_input("job-a", Cursor::new(b"abc".to_vec()), 10, soon())
        .unwrap();
    let b = s
        .put_input("job-a", Cursor::new(b"abd".to_vec()), 10, soon())
        .unwrap();
    assert_ne!(a, b);
    assert_eq!(
        s.check_generation("job-a", a).unwrap_err(),
        CloudError::InputChanged
    );
    assert!(s.check_generation("job-a", b).is_ok());
    assert_eq!(s.stored_bytes(), 3);
}

#[test]
fn global_storage_cap_is_atomic_and_released_on_abandon() {
    let mut p = CloudPolicy::pilot().unwrap();
    p.transfer.global_stored_bytes = 10;
    let s = Storage::new(Arc::new(MemoryObjects::default()), p);
    s.put_input("a", Cursor::new(vec![0u8; 6]), 20, soon())
        .unwrap();
    assert_eq!(
        s.put_input("b", Cursor::new(vec![0u8; 6]), 20, soon())
            .unwrap_err(),
        CloudError::QuotaExceeded
    );
    assert_eq!(s.stored_bytes(), 6);
    s.abandon("a").unwrap();
    assert_eq!(s.stored_bytes(), 0);
    s.put_input("b", Cursor::new(vec![0u8; 6]), 20, soon())
        .unwrap();
}

#[test]
fn download_limits_count_and_bytes_and_denial_sends_nothing() {
    let s = storage();
    s.put_output("job", vec![1u8; 10 * 1024 * 1024]).unwrap();
    for _ in 0..3 {
        assert_eq!(s.download("job", None).unwrap().len(), 10 * 1024 * 1024);
    }
    assert_eq!(
        s.download("job", None).unwrap_err(),
        CloudError::QuotaExceeded
    );
}

#[test]
fn download_total_bytes_capped_and_range_counts_only_range() {
    let mut p = CloudPolicy::pilot().unwrap();
    p.transfer.max_download_bytes_per_job = 15;
    let s = Storage::new(Arc::new(MemoryObjects::default()), p);
    s.put_output("job", (0u8..10).collect()).unwrap();
    assert_eq!(s.download("job", Some((2, 5))).unwrap(), vec![2, 3, 4, 5]);
    // 4 usados; um download completo de 10 ainda cabe (14), o próximo não.
    assert_eq!(s.download("job", None).unwrap().len(), 10);
    assert_eq!(
        s.download("job", Some((0, 1))).unwrap_err(),
        CloudError::QuotaExceeded
    );
    assert_eq!(
        s.download("job", Some((5, 99))).unwrap_err(),
        CloudError::InvalidRequest
    );
}

#[test]
fn concurrent_downloads_never_exceed_count() {
    let s = Arc::new(storage());
    s.put_output("job", vec![1u8; 100]).unwrap();
    let ok: usize = (0..16)
        .map(|_| {
            let s = s.clone();
            std::thread::spawn(move || s.download("job", None).is_ok())
        })
        .collect::<Vec<_>>()
        .into_iter()
        .map(|h| usize::from(h.join().unwrap()))
        .sum();
    assert_eq!(ok, 3);
}

#[test]
fn output_larger_than_policy_is_refused() {
    let s = storage();
    assert_eq!(
        s.put_output("job", vec![0u8; 30 * 1024 * 1024 + 1])
            .unwrap_err(),
        CloudError::InvalidRequest
    );
}

#[test]
fn rejects_unsafe_object_names() {
    let s = storage();
    assert_eq!(
        s.put_input("../x", Cursor::new(vec![1u8]), 10, soon())
            .unwrap_err(),
        CloudError::InvalidRequest
    );
}
