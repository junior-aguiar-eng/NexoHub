use nexohub_server::cloud::{
    outputs::{OutputError, normalize_ocr, normalize_translation, validate_office_pdf},
    policy::CloudPolicy,
};
use serde_json::{Value, json};

fn policy() -> CloudPolicy {
    CloudPolicy::pilot().unwrap()
}
fn vertices(l: f64, t: f64, r: f64, b: f64) -> Value {
    json!({"normalizedVertices":[{"x":l,"y":t},{"x":r,"y":t},{"x":r,"y":b},{"x":l,"y":b}]})
}
fn line(start: u64, end: u64, confidence: f64, poly: Value) -> Value {
    json!({"layout":{
        "textAnchor":{"textSegments":[{"startIndex":start,"endIndex":end}]},
        "confidence":confidence,
        "boundingPoly":poly}})
}
fn doc(text: &str, pages: Vec<Value>) -> Value {
    json!({"text": text, "pages": pages})
}
fn page(number: u64, lines: Vec<Value>) -> Value {
    json!({"pageNumber": number, "lines": lines})
}

#[test]
fn ocr_maps_provider_lines_to_the_local_engine_contract() {
    // Mesma caixa do teste do motor local: (20,10)-(120,30) numa página 200×100.
    let response = doc(
        "NexoHub",
        vec![page(
            1,
            vec![line(0, 7, 0.9876543, vertices(0.1, 0.1, 0.6, 0.3))],
        )],
    );
    let out = normalize_ocr(&response, 1).unwrap();
    assert_eq!(out.text, "NexoHub");
    assert_eq!(out.pages, 1);
    assert_eq!(out.lines.len(), 1);
    let l = &out.lines[0];
    assert_eq!(l.page_number, 1);
    assert_eq!(l.confidence, 0.987654);
    assert_eq!(l.bounds, (0.1, 0.1, 0.5, 0.2)); // (esquerda, topo, largura, altura)
}

#[test]
fn ocr_text_indices_count_unicode_characters_not_bytes() {
    // "ação ✓€ fim": os caracteres multibyte deslocam os índices em bytes, não em caracteres.
    let text = "ação ✓€ fim";
    let response = doc(
        text,
        vec![page(
            1,
            vec![
                line(0, 4, 0.9, vertices(0.0, 0.0, 0.4, 0.1)),
                line(5, 7, 0.9, vertices(0.0, 0.2, 0.2, 0.3)),
                line(8, 11, 0.9, vertices(0.0, 0.4, 0.3, 0.5)),
            ],
        )],
    );
    let out = normalize_ocr(&response, 1).unwrap();
    let texts: Vec<_> = out.lines.iter().map(|l| l.text.as_str()).collect();
    assert_eq!(texts, ["ação", "✓€", "fim"]);
    assert_eq!(out.text, "ação\n✓€\nfim");
}

#[test]
fn ocr_start_index_may_be_omitted_when_zero() {
    let l = json!({"layout":{
        "textAnchor":{"textSegments":[{"endIndex":3}]},
        "confidence":0.5,
        "boundingPoly": vertices(0.0, 0.0, 0.5, 0.5)}});
    let out = normalize_ocr(&doc("abc", vec![page(1, vec![l])]), 1).unwrap();
    assert_eq!(out.text, "abc");
}

#[test]
fn ocr_must_return_exactly_the_quoted_pages() {
    let one = page(1, vec![line(0, 1, 0.9, vertices(0.0, 0.0, 0.5, 0.5))]);
    let two = page(2, vec![]);
    assert_eq!(
        normalize_ocr(&doc("a", vec![one.clone()]), 2).unwrap_err(),
        OutputError::PageMismatch
    );
    assert_eq!(
        normalize_ocr(&doc("a", vec![one.clone(), two.clone()]), 1).unwrap_err(),
        OutputError::PageMismatch
    );
    assert_eq!(
        normalize_ocr(&doc("a", vec![one.clone(), one.clone()]), 2).unwrap_err(),
        OutputError::PageMismatch
    );
    assert_eq!(
        normalize_ocr(&doc("a", vec![page(0, vec![])]), 1).unwrap_err(),
        OutputError::PageMismatch
    );
    assert_eq!(
        normalize_ocr(&doc("a", vec![page(3, vec![])]), 1).unwrap_err(),
        OutputError::PageMismatch
    );
    assert!(normalize_ocr(&doc("a", vec![two, one]), 2).is_ok()); // ordem das páginas não importa
}

#[test]
fn ocr_rejects_values_outside_the_contract_instead_of_fixing_them() {
    let ok_box = || vertices(0.1, 0.1, 0.5, 0.2);
    let check = |l: Value, expected: OutputError| {
        assert_eq!(
            normalize_ocr(&doc("abc", vec![page(1, vec![l])]), 1).unwrap_err(),
            expected
        );
    };
    check(line(0, 3, 1.2, ok_box()), OutputError::InvalidShape); // confiança > 1
    check(line(0, 3, -0.1, ok_box()), OutputError::InvalidShape);
    check(line(0, 4, 0.9, ok_box()), OutputError::InvalidShape); // índice além do texto
    check(line(2, 1, 0.9, ok_box()), OutputError::InvalidShape); // intervalo invertido
    check(
        line(0, 3, 0.9, vertices(0.1, 0.1, 1.5, 0.2)),
        OutputError::InvalidShape,
    ); // fora da página
    check(
        line(0, 3, 0.9, vertices(0.1, 0.1, 0.1, 0.2)),
        OutputError::InvalidShape,
    ); // sem largura
    check(
        line(
            0,
            3,
            0.9,
            json!({"normalizedVertices":[{"x":0.1,"y":0.1},{"x":0.5,"y":0.1}]}),
        ),
        OutputError::InvalidShape,
    );
}

#[test]
fn ocr_clamps_tiny_rounding_overshoot_but_not_more() {
    let out = normalize_ocr(
        &doc(
            "abc",
            vec![page(
                1,
                vec![line(0, 3, 0.9, vertices(-0.004, 0.0, 1.004, 0.5))],
            )],
        ),
        1,
    )
    .unwrap();
    assert_eq!(out.lines[0].bounds, (0.0, 0.0, 1.0, 0.5));
}

#[test]
fn ocr_skips_blank_lines_flattens_newlines_and_refuses_control_characters() {
    let response = doc(
        "um\ndois   \u{0}x",
        vec![page(
            1,
            vec![
                line(0, 7, 0.9, vertices(0.0, 0.0, 0.5, 0.1)),
                line(7, 10, 0.9, vertices(0.0, 0.2, 0.5, 0.3)), // só espaços: ignorada
            ],
        )],
    );
    let out = normalize_ocr(&response, 1).unwrap();
    assert_eq!(out.lines.len(), 1);
    assert_eq!(out.lines[0].text, "um dois");
    let bad = doc(
        "a\u{0}b",
        vec![page(1, vec![line(0, 3, 0.9, vertices(0.0, 0.0, 0.5, 0.1))])],
    );
    assert_eq!(
        normalize_ocr(&bad, 1).unwrap_err(),
        OutputError::InvalidText
    );
}

#[test]
fn ocr_keeps_reading_order_and_groups_lines_by_page() {
    let l = |a, b, y| line(a, b, 0.9, vertices(0.0, y, 0.5, y + 0.1));
    let response = doc(
        "abcdef",
        vec![
            page(2, vec![l(4, 6, 0.0)]),
            page(1, vec![l(0, 2, 0.0), l(2, 4, 0.2)]),
        ],
    );
    let out = normalize_ocr(&response, 2).unwrap();
    let got: Vec<_> = out
        .lines
        .iter()
        .map(|l| (l.page_number, l.text.as_str()))
        .collect();
    assert_eq!(got, [(1, "ab"), (1, "cd"), (2, "ef")]);
}

#[test]
fn ocr_refuses_oversized_output_and_unknown_shapes() {
    let huge = "a".repeat(4_000_001);
    assert_eq!(
        normalize_ocr(&doc(&huge, vec![page(1, vec![])]), 1).unwrap_err(),
        OutputError::TooLarge
    );
    assert_eq!(
        normalize_ocr(&json!({}), 1).unwrap_err(),
        OutputError::InvalidShape
    );
    assert_eq!(
        normalize_ocr(&json!({"text":"a","pages":"x"}), 1).unwrap_err(),
        OutputError::InvalidShape
    );
    assert_eq!(
        normalize_ocr(&doc("", vec![]), 0).unwrap_err(),
        OutputError::PageMismatch
    );
}

#[test]
fn translation_returns_plain_text_bytes_never_the_provider_json() {
    let response = json!({"translations":[{"translatedText":"Olá, João: não há 3 ações.","detectedLanguageCode":"en"}]});
    let out = normalize_translation(&response, 20, &policy()).unwrap();
    assert_eq!(out.mime, "text/plain");
    assert_eq!(
        String::from_utf8(out.bytes).unwrap(),
        "Olá, João: não há 3 ações."
    );
}

#[test]
fn translation_requires_exactly_one_non_empty_clean_result() {
    let p = policy();
    let one = |t: &str| json!({"translations":[{"translatedText": t}]});
    assert_eq!(
        normalize_translation(&json!({}), 5, &p).unwrap_err(),
        OutputError::InvalidShape
    );
    assert_eq!(
        normalize_translation(&json!({"translations":[]}), 5, &p).unwrap_err(),
        OutputError::InvalidShape
    );
    assert_eq!(
        normalize_translation(
            &json!({"translations":[{"translatedText":"a"},{"translatedText":"b"}]}),
            5,
            &p
        )
        .unwrap_err(),
        OutputError::InvalidShape
    );
    assert_eq!(
        normalize_translation(&one("  \n"), 5, &p).unwrap_err(),
        OutputError::InvalidText
    );
    assert_eq!(
        normalize_translation(&one("a\u{0}b"), 5, &p).unwrap_err(),
        OutputError::InvalidText
    );
    assert_eq!(
        normalize_translation(&json!({"translations":[{"translatedText": 5}]}), 5, &p).unwrap_err(),
        OutputError::InvalidShape
    );
    assert!(normalize_translation(&one("linha 1\nlinha 2\tok"), 5, &p).is_ok());
}

#[test]
fn translation_caps_expansion() {
    let p = policy();
    let long = "a".repeat(20_001);
    let response = json!({"translations":[{"translatedText": long}]});
    assert_eq!(
        normalize_translation(&response, 5_000, &p).unwrap_err(),
        OutputError::TooLarge
    );
}

fn pdf(pages: usize) -> Vec<u8> {
    use lopdf::{Document, Object, dictionary};
    let mut doc = Document::with_version("1.5");
    let pages_id = doc.new_object_id();
    let mut kids: Vec<Object> = Vec::new();
    for _ in 0..pages {
        let id = doc.add_object(dictionary! {
            "Type" => "Page", "Parent" => pages_id,
            "MediaBox" => vec![0.into(), 0.into(), 200.into(), 200.into()],
        });
        kids.push(id.into());
    }
    doc.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages", "Kids" => kids, "Count" => pages as i64,
        }),
    );
    let catalog = doc.add_object(dictionary! {"Type" => "Catalog", "Pages" => pages_id});
    doc.trailer.set("Root", catalog);
    let mut out = Vec::new();
    doc.save_to(&mut out).unwrap();
    out
}

#[test]
fn office_pdf_is_returned_unchanged_with_its_page_count() {
    let bytes = pdf(3);
    let out = validate_office_pdf(bytes.clone(), &policy()).unwrap();
    assert_eq!(out.pages, 3);
    assert_eq!(out.bytes, bytes);
}

#[test]
fn office_pdf_rejects_non_pdf_garbage_empty_and_oversized_outputs() {
    let p = policy();
    assert_eq!(
        validate_office_pdf(b"PK\x03\x04docx".to_vec(), &p).unwrap_err(),
        OutputError::InvalidPdf
    );
    assert_eq!(
        validate_office_pdf(b"%PDF-1.7 isto nao e um pdf".to_vec(), &p).unwrap_err(),
        OutputError::InvalidPdf
    );
    assert_eq!(
        validate_office_pdf(pdf(0), &p).unwrap_err(),
        OutputError::InvalidPdf
    );
    assert_eq!(
        validate_office_pdf(pdf(51), &p).unwrap_err(),
        OutputError::TooLarge
    );
    assert!(validate_office_pdf(pdf(50), &p).is_ok());
    let mut big = b"%PDF-1.7".to_vec();
    big.resize(30 * 1024 * 1024 + 1, b' ');
    assert_eq!(
        validate_office_pdf(big, &p).unwrap_err(),
        OutputError::TooLarge
    );
}
