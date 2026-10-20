use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use lopdf::{Document, Object};
use nexohub_server::create_app;
use serde_json::{Value, json};
use tower::ServiceExt;

fn sample_pdf() -> Vec<u8> {
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let content_id = doc.add_object(lopdf::Stream::new(
        lopdf::Dictionary::new(),
        b"BT /F1 12 Tf 72 712 Td (NexoHub Test) Tj ET".to_vec(),
    ));
    let page_id = doc.add_object(lopdf::Dictionary::from_iter([
        ("Type", Object::Name(b"Page".to_vec())),
        ("Parent", Object::Reference(pages_id)),
        (
            "MediaBox",
            Object::Array(vec![
                Object::Integer(0),
                Object::Integer(0),
                Object::Integer(595),
                Object::Integer(842),
            ]),
        ),
        ("Contents", Object::Reference(content_id)),
    ]));
    let pages = lopdf::Dictionary::from_iter([
        ("Type", Object::Name(b"Pages".to_vec())),
        ("Count", Object::Integer(1)),
        ("Kids", Object::Array(vec![Object::Reference(page_id)])),
    ]);
    doc.set_object(pages_id, pages);
    let catalog = lopdf::Dictionary::from_iter([
        ("Type", Object::Name(b"Catalog".to_vec())),
        ("Pages", Object::Reference(pages_id)),
    ]);
    let catalog_id = doc.add_object(catalog);
    doc.trailer.set("Root", Object::Reference(catalog_id));
    let mut buffer = Vec::new();
    doc.save_to(&mut buffer).expect("save pdf");
    buffer
}

#[tokio::test]
async fn test_health_endpoint() {
    let app = create_app(None);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/health")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "healthy");
    assert_eq!(json["service"], "nexohub-server");
}

#[tokio::test]
async fn test_invoke_unknown_command_returns_bad_request() {
    let app = create_app(None);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/comando_inexistente")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(json!({}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], "INVALID_ARGUMENT");
}

#[tokio::test]
async fn test_invoke_project_lifecycle() {
    let app = create_app(None);
    let temp_dir = tempfile::tempdir().unwrap();
    let project_path = temp_dir.path().join("teste_servidor.nexohub");
    let project_str = project_path.to_string_lossy().to_string();

    let create_payload = json!({
        "projectPath": project_str,
        "name": "Projeto Web Integracao"
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/create_project")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(create_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["name"], "Projeto Web Integracao");

    let open_payload = json!({
        "projectPath": project_str
    });

    let res_open = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/open_project")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(open_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res_open.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_stateless_compress_pdf() {
    let app = create_app(None);
    let pdf_bytes = sample_pdf();

    let payload = json!({
        "bytes": pdf_bytes,
        "compressionLevel": 6
    });

    let res = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/tools/compress_pdf")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert!(json["bytes"].is_array());
    assert!(json["compressedSize"].as_u64().unwrap() > 0);
    assert_eq!(json["originalSize"], pdf_bytes.len());
}

#[tokio::test]
async fn test_invoke_pick_project_folder_and_import_bytes() {
    let app = create_app(None);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/pick_project_folder")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(json!({}).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::OK);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    let project_path = json["path"].as_str().unwrap().to_string();
    assert_eq!(json["name"], "Sessão Web");

    // Inicializa o projeto
    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/create_project")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "projectPath": project_path,
                        "name": "Sessão Web Criada"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_res.status(), StatusCode::OK);

    // Importa bytes de documento
    let pdf_bytes = sample_pdf();
    let import_res = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/import_document_bytes")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "projectPath": project_path,
                        "title": "contrato_web.pdf",
                        "mimeType": "application/pdf",
                        "bytes": pdf_bytes
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(import_res.status(), StatusCode::OK);
    let import_body = import_res.into_body().collect().await.unwrap().to_bytes();
    let import_json: Value = serde_json::from_slice(&import_body).unwrap();
    assert_eq!(import_json["document"]["title"], "contrato_web.pdf");
    assert_eq!(import_json["artifact"]["kind"], "ORIGINAL");
}
