use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use lopdf::{Document, Object};
use nexohub_server::create_app;
use serde_json::{Value, json};
use tower::ServiceExt;

async fn invoke(
    app: &axum::Router,
    command: &str,
    payload: Value,
    token: Option<&str>,
) -> axum::response::Response {
    let mut request = Request::builder()
        .uri(format!("/api/v1/invoke/{command}"))
        .method("POST")
        .header("content-type", "application/json");
    if let Some(token) = token {
        request = request.header("authorization", format!("Bearer {token}"));
    }
    app.clone()
        .oneshot(request.body(Body::from(payload.to_string())).unwrap())
        .await
        .unwrap()
}

async fn allocate_session(app: &axum::Router) -> (String, String) {
    let response = invoke(app, "pick_project_folder", json!({}), None).await;
    assert_eq!(response.status(), StatusCode::OK);
    let token = response
        .headers()
        .get("x-nexohub-session")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let body = response.into_body().collect().await.unwrap().to_bytes();
    let folder: Value = serde_json::from_slice(&body).unwrap();
    (folder["path"].as_str().unwrap().to_owned(), token)
}

#[tokio::test]
async fn test_session_credential_is_separate_from_project_path() {
    let app = create_app(None);
    let (path, token) = allocate_session(&app).await;
    assert!(
        !token.is_empty(),
        "A sessão precisa de uma credencial própria."
    );
    assert!(!path.contains(&token));
}

#[tokio::test]
async fn test_create_project_requires_a_server_allocated_session() {
    let app = create_app(None);
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("nao-autorizado.nexohub");
    let response = invoke(
        &app,
        "create_project",
        json!({
            "projectPath": path,
            "name": "Não autorizado"
        }),
        None,
    )
    .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert!(!path.exists());
}

#[tokio::test]
async fn test_session_cannot_read_or_modify_another_session() {
    let app = create_app(None);
    let (victim_path, victim_token) = allocate_session(&app).await;
    let (_, attacker_token) = allocate_session(&app).await;
    let created = invoke(
        &app,
        "create_project",
        json!({
            "projectPath": victim_path,
            "name": "Projeto privado"
        }),
        Some(&victim_token),
    )
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    let imported = invoke(
        &app,
        "import_document_bytes",
        json!({
            "projectPath": victim_path,
            "title": "privado.txt",
            "mimeType": "text/plain",
            "bytes": b"conteudo privado".to_vec()
        }),
        Some(&victim_token),
    )
    .await;
    assert_eq!(imported.status(), StatusCode::OK);
    let body = imported.into_body().collect().await.unwrap().to_bytes();
    let document: Value = serde_json::from_slice(&body).unwrap();
    for token in [
        None,
        Some("credencial-invalida"),
        Some(attacker_token.as_str()),
    ] {
        for command in [
            "create_project",
            "open_project",
            "list_documents",
            "get_document",
            "list_artifacts",
            "read_artifact_bytes",
            "import_document_bytes",
            "compress_pdf",
            "organize_pdf",
            "record_launcher_result",
            "execute_ocr",
            "inspect_docx",
            "create_docx",
            "translate_text",
            "list_translation_models",
            "extract_information",
            "execute_extract_pdf_images",
        ] {
            let response = invoke(
                &app,
                command,
                json!({
                    "projectPath": victim_path,
                    "documentId": document["document"]["id"],
                    "artifactId": document["artifact"]["id"],
                    "title": "alterado.txt", "mimeType": "text/plain", "bytes": [1],
                    "compressionLevel": 6, "pageOrder": [1], "text": "teste", "targetLanguage": "pt"
                }),
                token,
            )
            .await;
            assert_eq!(
                response.status(),
                StatusCode::FORBIDDEN,
                "Comando: {command}"
            );
        }
    }
    let wrapped = invoke(
        &app,
        "list_documents",
        json!({
            "request": { "projectPath": victim_path }
        }),
        Some(&attacker_token),
    )
    .await;
    assert_eq!(wrapped.status(), StatusCode::FORBIDDEN);
    let own = invoke(
        &app,
        "list_documents",
        json!({ "projectPath": victim_path }),
        Some(&victim_token),
    )
    .await;
    assert_eq!(own.status(), StatusCode::OK);
    let body = own.into_body().collect().await.unwrap().to_bytes();
    let documents: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(documents.as_array().unwrap().len(), 1);
}

#[tokio::test]
async fn test_session_cannot_grant_arbitrary_temporary_paths() {
    let app = create_app(None);
    let (_, token) = allocate_session(&app).await;
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("fora-da-sessao.nexohub");
    for command in ["create_project", "open_project"] {
        let response = invoke(
            &app,
            command,
            json!({
                "projectPath": path, "name": "Fora da sessão"
            }),
            Some(&token),
        )
        .await;
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
    let response = invoke(
        &app,
        "open_project",
        json!({
            "projectPath": std::env::temp_dir()
        }),
        Some(&token),
    )
    .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
    assert!(!path.exists());
}

#[cfg(unix)]
#[tokio::test]
async fn test_session_rejects_project_symlink_to_another_session() {
    let app = create_app(None);
    let (victim_path, victim_token) = allocate_session(&app).await;
    let (attacker_path, attacker_token) = allocate_session(&app).await;
    let created = invoke(
        &app,
        "create_project",
        json!({
            "projectPath": victim_path, "name": "Projeto privado"
        }),
        Some(&victim_token),
    )
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    std::os::unix::fs::symlink(&victim_path, &attacker_path).unwrap();
    let response = invoke(
        &app,
        "list_documents",
        json!({
            "projectPath": attacker_path
        }),
        Some(&attacker_token),
    )
    .await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

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
    let (path, token) = allocate_session(&app).await;
    let created = invoke(
        &app,
        "create_project",
        json!({
            "projectPath": path, "name": "Projeto Web Integracao"
        }),
        Some(&token),
    )
    .await;
    assert_eq!(created.status(), StatusCode::OK);
    let body = created.into_body().collect().await.unwrap().to_bytes();
    let project: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(project["name"], "Projeto Web Integracao");
    let opened = invoke(
        &app,
        "open_project",
        json!({ "projectPath": path }),
        Some(&token),
    )
    .await;
    assert_eq!(opened.status(), StatusCode::OK);
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
    let token = res
        .headers()
        .get("x-nexohub-session")
        .unwrap()
        .to_str()
        .unwrap()
        .to_owned();
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
                .header("authorization", format!("Bearer {token}"))
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
                .header("authorization", format!("Bearer {token}"))
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

#[tokio::test]
async fn test_import_document_is_forbidden_on_server() {
    let app = create_app(None);

    let res = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/import_document")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "projectPath": "/tmp/session.nexohub",
                        "sourcePath": "/etc/passwd",
                        "mimeType": "text/plain"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::FORBIDDEN);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], "PERMISSION_DENIED");
}

#[tokio::test]
async fn test_create_project_outside_sandbox_is_forbidden() {
    let app = create_app(None);

    #[cfg(windows)]
    let illegal_path = "C:\\Windows\\system32\\evil.nexohub";
    #[cfg(not(windows))]
    let illegal_path = "/etc/evil.nexohub";

    let res = app
        .oneshot(
            Request::builder()
                .uri("/api/v1/invoke/create_project")
                .method("POST")
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({
                        "projectPath": illegal_path,
                        "name": "Evil Project"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(res.status(), StatusCode::FORBIDDEN);
    let body = res.into_body().collect().await.unwrap().to_bytes();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], "PERMISSION_DENIED");
}
