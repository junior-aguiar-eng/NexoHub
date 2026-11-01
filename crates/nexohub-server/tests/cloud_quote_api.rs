use nexohub_server::cloud::{
    CloudError,
    policy::CloudPolicy,
    quote_api::QuoteApi,
    quotes::{CloudTool, QuoteRequest},
};

const NOW: u64 = 1_793_400_000;

fn api() -> QuoteApi {
    QuoteApi::new(&CloudPolicy::pilot().unwrap()).unwrap()
}
fn text(chars: u64) -> QuoteRequest {
    QuoteRequest {
        tool: CloudTool::TranslateText,
        mime: "text/plain".into(),
        declared_bytes: 0,
        pages: 0,
        characters: chars,
    }
}

#[test]
fn full_flow_for_text_quote_upload_inspect() {
    let a = api();
    let (id, q) = a.create("p1", &text(6), NOW).unwrap();
    a.authorize_upload("p1", &id, NOW + 1).unwrap();
    a.upload("p1", &id, "ação✓€".as_bytes(), NOW + 2).unwrap();
    let done = a.inspect("p1", &id, NOW + 3).unwrap();
    assert_eq!(done.units, q.units);
}

#[test]
fn steps_cannot_be_skipped_or_repeated() {
    let a = api();
    let (id, _) = a.create("p1", &text(3), NOW).unwrap();
    assert_eq!(
        a.upload("p1", &id, b"abc", NOW).unwrap_err(),
        CloudError::Conflict
    );
    assert_eq!(a.inspect("p1", &id, NOW).unwrap_err(), CloudError::Conflict);
    a.authorize_upload("p1", &id, NOW).unwrap();
    assert_eq!(
        a.authorize_upload("p1", &id, NOW).unwrap_err(),
        CloudError::Conflict
    );
}

#[test]
fn other_participant_sees_nonexistent_quote() {
    let a = api();
    let (id, _) = a.create("p1", &text(3), NOW).unwrap();
    assert_eq!(
        a.authorize_upload("p2", &id, NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
}

#[test]
fn expired_quote_is_refused_at_every_step() {
    let a = api();
    let (id, _) = a.create("p1", &text(3), NOW).unwrap();
    assert_eq!(
        a.authorize_upload("p1", &id, NOW + 301).unwrap_err(),
        CloudError::QuoteExpired
    );
}

#[test]
fn changed_content_requires_new_confirmation() {
    let a = api();
    let (id, _) = a.create("p1", &text(3), NOW).unwrap();
    a.authorize_upload("p1", &id, NOW).unwrap();
    a.upload("p1", &id, b"abcd", NOW).unwrap();
    assert_eq!(
        a.inspect("p1", &id, NOW).unwrap_err(),
        CloudError::InputChanged
    );
}

#[test]
fn reupload_before_inspection_replaces_object() {
    let a = api();
    let (id, _) = a.create("p1", &text(3), NOW).unwrap();
    a.authorize_upload("p1", &id, NOW).unwrap();
    a.upload("p1", &id, b"abcd", NOW).unwrap();
    a.upload("p1", &id, b"abc", NOW).unwrap();
    assert!(a.inspect("p1", &id, NOW).is_ok());
}

#[test]
fn oversized_upload_and_invalid_utf8_are_refused() {
    let a = api();
    let (id, _) = a.create("p1", &text(3), NOW).unwrap();
    a.authorize_upload("p1", &id, NOW).unwrap();
    assert_eq!(
        a.upload("p1", &id, &vec![b'a'; 20_001], NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
    a.upload("p1", &id, &[0xff, 0xfe, 0xfd], NOW).unwrap();
    assert_eq!(
        a.inspect("p1", &id, NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
}

#[test]
fn pdf_inspection_is_unavailable_until_an_inspector_exists() {
    let a = api();
    let req = QuoteRequest {
        tool: CloudTool::Ocr,
        mime: "application/pdf".into(),
        declared_bytes: 10,
        pages: 1,
        characters: 0,
    };
    let (id, _) = a.create("p1", &req, NOW).unwrap();
    a.authorize_upload("p1", &id, NOW).unwrap();
    a.upload("p1", &id, b"%PDF-1.7", NOW).unwrap();
    assert_eq!(
        a.inspect("p1", &id, NOW).unwrap_err(),
        CloudError::Unavailable
    );
}

fn inspected_quote(a: &QuoteApi, owner: &str) -> String {
    let (id, _) = a.create(owner, &text(3), NOW).unwrap();
    a.authorize_upload(owner, &id, NOW).unwrap();
    a.upload(owner, &id, b"abc", NOW).unwrap();
    a.inspect(owner, &id, NOW + 3).unwrap();
    id
}

#[test]
fn confirm_requires_inspection_and_is_idempotent() {
    let a = api();
    let (early, _) = a.create("p1", &text(3), NOW).unwrap();
    assert_eq!(
        a.confirm("p1", &early, NOW).unwrap_err(),
        CloudError::Conflict
    );
    let id = inspected_quote(&a, "p1");
    let first = a.confirm("p1", &id, NOW + 4).unwrap();
    let again = a.confirm("p1", &id, NOW + 5).unwrap();
    assert_eq!(first.key, again.key);
    assert_eq!(first.input_digest, again.input_digest);
    assert_eq!(first.input_digest.len(), 64);
    assert_eq!(first.units.characters, 3);
    assert!(first.maximum_usd_micros > 0);
}

#[test]
fn confirm_digest_follows_the_stored_content() {
    let a = api();
    let (one, two) = (inspected_quote(&a, "p1"), inspected_quote(&a, "p1"));
    assert_eq!(
        a.confirm("p1", &one, NOW).unwrap().input_digest,
        a.confirm("p1", &two, NOW).unwrap().input_digest
    );
    let (id, _) = a.create("p1", &text(3), NOW).unwrap();
    a.authorize_upload("p1", &id, NOW).unwrap();
    a.upload("p1", &id, b"xyz", NOW).unwrap();
    a.inspect("p1", &id, NOW).unwrap();
    assert_ne!(
        a.confirm("p1", &id, NOW).unwrap().input_digest,
        a.confirm("p1", &one, NOW).unwrap().input_digest
    );
}

#[test]
fn confirm_refuses_expired_quote_and_other_owner() {
    let a = api();
    let id = inspected_quote(&a, "p1");
    assert_eq!(
        a.confirm("p2", &id, NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
    assert_eq!(
        a.confirm("p1", &id, NOW + 301).unwrap_err(),
        CloudError::QuoteExpired
    );
}
