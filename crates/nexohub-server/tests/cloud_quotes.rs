use nexohub_server::cloud::{
    CloudError,
    policy::CloudPolicy,
    pricing::PriceBook,
    quotes::{CloudTool, Inspected, QuoteRequest, QuoteService},
};

const NOW: u64 = 1_793_400_000;

fn service() -> QuoteService {
    QuoteService::new(CloudPolicy::pilot().unwrap(), PriceBook::pilot().unwrap())
}
fn ocr(pages: u64, bytes: u64) -> QuoteRequest {
    QuoteRequest {
        tool: CloudTool::Ocr,
        mime: "application/pdf".into(),
        declared_bytes: bytes,
        pages,
        characters: 0,
    }
}
fn inspected(pages: u64, bytes: u64) -> Inspected {
    Inspected {
        mime: "application/pdf".into(),
        bytes,
        expanded_bytes: bytes,
        pages,
        characters: 0,
        object_generation: 1,
    }
}

#[test]
fn quote_has_expiry_version_maximum_and_requires_confirmation() {
    let q = service().quote(&ocr(3, 1_000_000), NOW).unwrap();
    assert_eq!(q.units.ocr_pages, 3);
    assert_eq!(q.expires_at, NOW + 300);
    assert!(q.requires_upload && q.requires_confirmation);
    assert!(q.maximum_usd_micros > 0);
    assert!(!q.policy_version.is_empty() && !q.price_version.is_empty());
}

#[test]
fn rejects_limits_instead_of_truncating() {
    let s = service();
    assert_eq!(
        s.quote(&ocr(16, 1), NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
    assert_eq!(
        s.quote(&ocr(0, 1), NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
    assert_eq!(
        s.quote(&ocr(1, 20 * 1024 * 1024 + 1), NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
    let mut text = QuoteRequest {
        tool: CloudTool::TranslateText,
        mime: "text/plain".into(),
        declared_bytes: 0,
        pages: 0,
        characters: 5_001,
    };
    assert_eq!(s.quote(&text, NOW).unwrap_err(), CloudError::InvalidRequest);
    text.characters = 5_000;
    assert!(s.quote(&text, NOW).is_ok());
}

#[test]
fn rejects_mime_not_allowed_for_tool() {
    let mut r = ocr(1, 10);
    r.mime = "application/zip".into();
    assert_eq!(
        service().quote(&r, NOW).unwrap_err(),
        CloudError::InvalidRequest
    );
}

#[test]
fn stale_price_makes_quote_unavailable() {
    let far = NOW + 8 * 86_400;
    assert_eq!(
        service().quote(&ocr(1, 10), far).unwrap_err(),
        CloudError::PriceUnavailable
    );
}

#[test]
fn finalize_accepts_matching_inspection() {
    let s = service();
    let q = s.quote(&ocr(3, 1_000_000), NOW).unwrap();
    let f = s.finalize(&q, &inspected(3, 1_000_000), NOW + 10).unwrap();
    assert_eq!(f.units, q.units);
    assert_eq!(f.object_generation, 1);
}

#[test]
fn finalize_requires_new_confirmation_when_units_change() {
    let s = service();
    let q = s.quote(&ocr(3, 1_000), NOW).unwrap();
    assert_eq!(
        s.finalize(&q, &inspected(4, 1_000), NOW + 10).unwrap_err(),
        CloudError::InputChanged
    );
}

#[test]
fn finalize_rejects_expired_quote_and_abusive_expansion() {
    let s = service();
    let q = s.quote(&ocr(3, 1_000), NOW).unwrap();
    assert_eq!(
        s.finalize(&q, &inspected(3, 1_000), NOW + 301).unwrap_err(),
        CloudError::QuoteExpired
    );
    let mut bomb = inspected(3, 1_000);
    bomb.expanded_bytes = 1_000 * 1_000_000;
    assert_eq!(
        s.finalize(&q, &bomb, NOW + 10).unwrap_err(),
        CloudError::InvalidRequest
    );
    let mut mime = inspected(3, 1_000);
    mime.mime = "application/zip".into();
    assert_eq!(
        s.finalize(&q, &mime, NOW + 10).unwrap_err(),
        CloudError::InputChanged
    );
}

#[test]
fn characters_are_counted_as_scalars_not_bytes() {
    let s = service();
    let req = QuoteRequest {
        tool: CloudTool::TranslateText,
        mime: "text/plain".into(),
        declared_bytes: 0,
        pages: 0,
        characters: 5,
    };
    let q = s.quote(&req, NOW).unwrap();
    let text = "ação✓€"; // 6 escalares, mais bytes que caracteres
    assert_eq!(Inspected::from_text(text, 1).characters, 6);
    assert_eq!(
        s.finalize(&q, &Inspected::from_text(text, 1), NOW + 1)
            .unwrap_err(),
        CloudError::InputChanged
    );
}
