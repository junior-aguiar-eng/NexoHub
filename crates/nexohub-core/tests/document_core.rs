use lopdf::{Document as PdfDocument, Object, dictionary};
use nexohub_core::anchor_tools::{
    AnchorSelector, CreateAnchorRequest, ListAnchorsRequest, create_anchor, list_anchors,
};
use nexohub_core::commands::CreateProjectRequest;
use nexohub_core::domain::ArtifactKind;
use nexohub_core::hardening::HardeningLimits;
use nexohub_core::overlay_tools::{
    CreatePdfOverlayRequest, ListPdfOverlaysRequest, PdfOverlayKind, create_pdf_overlay,
    list_pdf_overlays,
};
use nexohub_core::pdf_tools::{CompressPdfRequest, OrganizePdfRequest, compress_pdf, organize_pdf};
use nexohub_core::text_tools::{CreateTextRevisionRequest, create_text_revision};
use nexohub_core::{ErrorCode, ProjectStore};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

struct TestDirectory {
    path: PathBuf,
}

impl TestDirectory {
    fn new(label: &str) -> Self {
        let path = std::env::temp_dir().join(format!("nexohub-{label}-{}", Uuid::new_v4()));
        fs::create_dir(&path).expect("diretório de teste deve ser criado");
        Self { path }
    }

    fn project_path(&self) -> PathBuf {
        self.path.join("Projeto.nexohub")
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn write_source(root: &Path, name: &str, bytes: &[u8]) -> PathBuf {
    fs::create_dir_all(root).expect("diretório temporário deve ser criado");
    let path = root.join(name);
    fs::write(&path, bytes).expect("fixture sintética deve ser escrita");
    path
}

fn synthetic_pdf() -> Vec<u8> {
    synthetic_pdf_with_pages(1)
}

fn synthetic_pdf_with_pages(page_count: usize) -> Vec<u8> {
    let mut pdf = PdfDocument::with_version("1.5");
    let pages_id = pdf.new_object_id();
    let page_ids = (0..page_count)
        .map(|_| {
            pdf.add_object(dictionary! {
                "Type" => "Page",
                "Parent" => pages_id,
                "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
            })
        })
        .collect::<Vec<_>>();
    pdf.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => page_ids.into_iter().map(Into::into).collect::<Vec<Object>>(),
            "Count" => page_count as i64,
        }),
    );
    let catalog_id = pdf.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    pdf.trailer.set("Root", catalog_id);
    let mut bytes = Vec::new();
    pdf.save_to(&mut bytes)
        .expect("fixture PDF deve ser criada");
    bytes
}

#[test]
fn rejects_relative_and_parent_traversal_project_paths() {
    let relative = match ProjectStore::create("Projeto.nexohub", "Inválido") {
        Ok(_) => panic!("caminho relativo deve ser rejeitado"),
        Err(error) => error,
    };
    assert_eq!(relative.code, ErrorCode::InvalidArgument);

    let temporary = TestDirectory::new("traversal");
    fs::create_dir_all(&temporary.path).expect("diretório deve existir");
    let traversal = temporary
        .path
        .join("segmento")
        .join("..")
        .join("Projeto.nexohub");
    let error = match ProjectStore::create(traversal, "Inválido") {
        Ok(_) => panic!("segmento pai deve ser rejeitado"),
        Err(error) => error,
    };
    assert_eq!(error.code, ErrorCode::InvalidArgument);
}

#[test]
fn rebuilds_cache_without_deleting_persistent_blobs() {
    let temporary = TestDirectory::new("cache-rebuild");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "original.txt", b"original persistente");
    let artifact_id = {
        let mut store = ProjectStore::create(&project_path, "Cache").expect("projeto");
        store
            .import_document(&source, None, "text/plain")
            .expect("importação")
            .artifact
            .id
    };

    fs::remove_dir_all(project_path.join("cache")).expect("cache deve ser removível");
    let store = ProjectStore::open(&project_path).expect("cache deve ser reconstruído");

    assert!(project_path.join("cache").is_dir());
    assert_eq!(
        store
            .read_artifact_bytes(&artifact_id)
            .expect("blob deve sobreviver"),
        b"original persistente"
    );
}

#[test]
fn reports_corrupted_project_database() {
    let temporary = TestDirectory::new("corrupted-db");
    let project_path = temporary.project_path();
    drop(ProjectStore::create(&project_path, "Corrompido").expect("projeto"));
    fs::write(
        project_path.join("project.sqlite3"),
        b"not a sqlite database",
    )
    .expect("fixture corrompida");

    let error = match ProjectStore::open(&project_path) {
        Ok(_) => panic!("corrupção deve ser estruturada"),
        Err(error) => error,
    };
    assert_eq!(error.code, ErrorCode::ProjectCorrupted);
}

#[test]
fn enforces_configured_project_artifact_budget() {
    let temporary = TestDirectory::new("project-budget");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "large.bin", &[7_u8; 32]);
    let limits = HardeningLimits {
        max_project_artifact_bytes: 16,
        ..HardeningLimits::default()
    };
    let mut store = ProjectStore::create_with_limits(&project_path, "Limite", limits)
        .expect("projeto deve ser criado");

    let error = store
        .import_document(&source, None, "application/octet-stream")
        .expect_err("quota deve impedir escrita");
    assert_eq!(error.code, ErrorCode::ResourceLimit);
    assert!(store.list_documents().expect("listagem").is_empty());
}

#[test]
fn creates_project_structure_and_initial_migration() {
    let temporary = TestDirectory::new("create");
    let project_path = temporary.project_path();

    let store =
        ProjectStore::create(&project_path, "Projeto de teste").expect("projeto deve ser criado");

    assert_eq!(
        store.project().expect("projeto deve existir").name,
        "Projeto de teste"
    );
    assert_eq!(store.schema_version().expect("migration deve existir"), 3);
    assert!(project_path.join("project.sqlite3").is_file());
    for directory in ["blobs", "cache", "previews", "exports"] {
        assert!(project_path.join(directory).is_dir());
    }

    let error = match ProjectStore::create(&project_path, "Outro") {
        Ok(_) => panic!("projeto existente não pode ser sobrescrito"),
        Err(error) => error,
    };
    assert_eq!(error.code, ErrorCode::ProjectAlreadyExists);
}

#[test]
fn upgrades_schema_one_project_with_anchor_migration() {
    let temporary = TestDirectory::new("migration-anchor");
    let project_path = temporary.project_path();
    let store = ProjectStore::create(&project_path, "Migration").expect("projeto deve ser criado");
    drop(store);
    let connection = rusqlite::Connection::open(project_path.join("project.sqlite3"))
        .expect("banco de teste deve abrir");
    connection
        .execute_batch("DROP TABLE anchors; DELETE FROM schema_migrations WHERE version >= 2;")
        .expect("schema deve simular a versão 1");
    drop(connection);

    let reopened = ProjectStore::open(&project_path).expect("migrations 2 e 3 devem ser aplicadas");

    assert_eq!(reopened.schema_version().expect("schema deve atualizar"), 3);
}

#[test]
fn imports_and_deduplicates_blobs_by_blake3_hash() {
    let temporary = TestDirectory::new("dedup");
    let project_path = temporary.project_path();
    let source_a = write_source(&temporary.path, "a.txt", b"conteudo identico");
    let source_b = write_source(&temporary.path, "b.txt", b"conteudo identico");
    let expected_hash = blake3::hash(b"conteudo identico").to_hex().to_string();
    let mut store =
        ProjectStore::create(&project_path, "Deduplicação").expect("projeto deve ser criado");

    let first = store
        .import_document(&source_a, None, "text/plain")
        .expect("primeira importação deve funcionar");
    let second = store
        .import_document(&source_b, Some("Segundo"), "text/plain")
        .expect("segunda importação deve funcionar");

    assert_eq!(first.artifact.kind, ArtifactKind::Original);
    assert_eq!(first.artifact.hash, expected_hash);
    assert_eq!(second.artifact.hash, expected_hash);
    assert_ne!(first.document.id, second.document.id);
    assert_eq!(
        store
            .list_documents()
            .expect("documentos devem ser listados")
            .len(),
        2
    );

    let prefix = &expected_hash[..2];
    let blobs = fs::read_dir(project_path.join("blobs").join(prefix))
        .expect("prefixo deve existir")
        .collect::<Result<Vec<_>, _>>()
        .expect("blobs devem ser enumerados");
    assert_eq!(blobs.len(), 1);
}

#[test]
fn persists_documents_after_reopening_project() {
    let temporary = TestDirectory::new("reopen");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "documento.md", b"# Persistente");
    let document_id = {
        let mut store =
            ProjectStore::create(&project_path, "Persistência").expect("projeto deve ser criado");
        store
            .import_document(&source, None, "text/markdown")
            .expect("documento deve ser importado")
            .document
            .id
    };

    let reopened = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    let document = reopened
        .get_document(&document_id)
        .expect("documento deve persistir");
    let artifacts = reopened
        .list_artifacts(&document_id)
        .expect("artifact deve persistir");

    assert_eq!(document.title, "documento.md");
    assert_eq!(artifacts.len(), 1);
    assert_eq!(reopened.schema_version().expect("schema deve persistir"), 3);
}

#[test]
fn keeps_original_immutable_after_twenty_operations() {
    let temporary = TestDirectory::new("immutable");
    let project_path = temporary.project_path();
    let original_bytes = b"original juridicamente preservado";
    let source = write_source(&temporary.path, "original.bin", original_bytes);
    let mut store =
        ProjectStore::create(&project_path, "Imutabilidade").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "application/octet-stream")
        .expect("original deve ser importado");
    let original_hash = imported.artifact.hash.clone();
    let mut input_artifact_id = imported.artifact.id.clone();

    fs::write(&source, b"origem externa alterada").expect("origem externa deve poder mudar");
    for index in 1..=20 {
        let derived = format!("resultado derivado {index}");
        let (artifact, operation) = store
            .create_derived_artifact(
                &imported.document.id,
                &input_artifact_id,
                "text/plain",
                derived.as_bytes(),
                "teste.derivacao",
                json!({ "etapa": index }),
            )
            .expect("operação deve gerar novo artifact");
        assert_ne!(artifact.id, input_artifact_id);
        assert_eq!(operation.parameters, json!({ "etapa": index }));
        input_artifact_id = artifact.id;
    }

    drop(store);
    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir após as operações");
    let original_after = store
        .read_artifact_bytes(&imported.artifact.id)
        .expect("original deve permanecer legível");
    let artifacts = store
        .list_artifacts(&imported.document.id)
        .expect("histórico deve ser listado");

    assert_eq!(original_after, original_bytes);
    assert_eq!(
        blake3::hash(&original_after).to_hex().as_str(),
        original_hash
    );
    assert_eq!(artifacts.len(), 21);
    assert_eq!(artifacts[0].id, imported.artifact.id);
    assert_eq!(artifacts[0].kind, ArtifactKind::Original);
}

#[test]
fn serializes_ipc_contracts_with_stable_names() {
    let request = CreateProjectRequest {
        project_path: "C:/Projetos/Exemplo.nexohub".to_owned(),
        name: "Exemplo".to_owned(),
    };
    let request_json = serde_json::to_value(request).expect("request deve ser serializável");
    let error_json = serde_json::to_value(ErrorCode::ProjectNotFound)
        .expect("código de erro deve ser serializável");
    let pdf_error_json =
        serde_json::to_value(ErrorCode::PdfProcessing).expect("código PDF deve ser serializável");

    assert_eq!(request_json["projectPath"], "C:/Projetos/Exemplo.nexohub");
    assert_eq!(request_json["name"], "Exemplo");
    assert_eq!(error_json, "PROJECT_NOT_FOUND");
    assert_eq!(pdf_error_json, "PDF_PROCESSING");
}

#[test]
fn compresses_pdf_as_derived_artifact_without_changing_original() {
    let temporary = TestDirectory::new("pdf-compress");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "original.pdf", &synthetic_pdf());
    let mut store =
        ProjectStore::create(&project_path, "Compressão PDF").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "application/pdf")
        .expect("PDF deve ser importado");
    let original_bytes = store
        .read_artifact_bytes(&imported.artifact.id)
        .expect("original deve ser legível");
    drop(store);

    let result = compress_pdf(CompressPdfRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: imported.document.id.clone(),
        artifact_id: imported.artifact.id.clone(),
        compression_level: 9,
    })
    .expect("compressão deve gerar artifact derivado");

    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    assert_eq!(result.artifact.kind, ArtifactKind::Derived);
    assert_eq!(result.operation.tool_id, "pdf-compress");
    assert_eq!(
        result.operation.parameters,
        json!({ "compressionLevel": 9 })
    );
    assert_eq!(
        store
            .read_artifact_bytes(&imported.artifact.id)
            .expect("original deve permanecer legível"),
        original_bytes
    );
    assert!(
        PdfDocument::load_mem(
            &store
                .read_artifact_bytes(&result.artifact.id)
                .expect("derivado deve ser legível")
        )
        .is_ok()
    );
}

#[test]
fn organizes_pdf_pages_as_derived_artifact_without_changing_original() {
    let temporary = TestDirectory::new("organize-pdf");
    let project_path = temporary.project_path();
    let source = write_source(
        &temporary.path,
        "document.pdf",
        &synthetic_pdf_with_pages(3),
    );
    let mut store = ProjectStore::create(&project_path, "PDF para organização")
        .expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "application/pdf")
        .expect("PDF deve ser importado");
    let original_bytes = store
        .read_artifact_bytes(&imported.artifact.id)
        .expect("original deve ser legível");
    drop(store);

    let result = organize_pdf(OrganizePdfRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: imported.document.id.clone(),
        artifact_id: imported.artifact.id.clone(),
        page_order: vec![3, 1],
        rotation_degrees: Some(90),
    })
    .expect("organização deve gerar artifact derivado");

    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    assert_eq!(result.artifact.kind, ArtifactKind::Derived);
    assert_eq!(result.operation.tool_id, "pdf-organize");
    assert_eq!(
        result.operation.parameters,
        json!({
            "pageOrder": [3, 1],
            "rotation": 90
        })
    );
    assert_eq!(
        store
            .read_artifact_bytes(&imported.artifact.id)
            .expect("original deve permanecer inalterado"),
        original_bytes
    );

    let derived_bytes = store
        .read_artifact_bytes(&result.artifact.id)
        .expect("derivado deve ser legível");
    let derived_pdf = PdfDocument::load_mem(&derived_bytes).expect("derivado deve ser PDF válido");
    assert_eq!(derived_pdf.get_pages().len(), 2);
}

#[test]
fn rejects_invalid_pdf_without_creating_derived_artifact() {
    let temporary = TestDirectory::new("invalid-pdf");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "invalid.pdf", b"not a pdf");
    let mut store =
        ProjectStore::create(&project_path, "PDF inválido").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "application/pdf")
        .expect("fixture deve ser importada");
    drop(store);

    let error = compress_pdf(CompressPdfRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: imported.document.id.clone(),
        artifact_id: imported.artifact.id,
        compression_level: 6,
    })
    .expect_err("PDF inválido deve falhar de forma estruturada");

    assert_eq!(error.code, ErrorCode::PdfProcessing);
    assert_eq!(
        ProjectStore::open(&project_path)
            .expect("projeto deve reabrir")
            .list_artifacts(&imported.document.id)
            .expect("artifacts devem ser listados")
            .len(),
        1
    );
}

#[test]
fn rejects_pdf_above_configured_page_limit_without_derived_artifact() {
    let temporary = TestDirectory::new("huge-page-count");
    let project_path = temporary.project_path();
    let source = write_source(
        &temporary.path,
        "many-pages.pdf",
        &synthetic_pdf_with_pages(1_001),
    );
    let mut store = ProjectStore::create(&project_path, "Muitas páginas").expect("projeto");
    let imported = store
        .import_document(&source, None, "application/pdf")
        .expect("original deve ser importado");
    drop(store);

    let error = compress_pdf(CompressPdfRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: imported.document.id.clone(),
        artifact_id: imported.artifact.id,
        compression_level: 6,
    })
    .expect_err("PDF acima de mil páginas deve ser rejeitado");

    assert_eq!(error.code, ErrorCode::ResourceLimit);
    assert_eq!(
        ProjectStore::open(&project_path)
            .expect("projeto deve reabrir")
            .list_artifacts(&imported.document.id)
            .expect("artifacts")
            .len(),
        1
    );
}

#[test]
fn creates_utf8_text_revision_and_preserves_source_artifact() {
    let temporary = TestDirectory::new("text-revision");
    let project_path = temporary.project_path();
    let original = "Versão original";
    let source = write_source(&temporary.path, "nota.md", original.as_bytes());
    let mut store = ProjectStore::create(&project_path, "Texto").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "text/markdown")
        .expect("texto deve ser importado");
    drop(store);

    let result = create_text_revision(CreateTextRevisionRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: imported.document.id.clone(),
        artifact_id: imported.artifact.id.clone(),
        content: "Nova revisão com acentuação jurídica: órgão".to_owned(),
    })
    .expect("revisão deve ser criada");

    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    assert_eq!(result.artifact.kind, ArtifactKind::Derived);
    assert_eq!(result.artifact.mime_type, "text/markdown");
    assert_eq!(result.operation.tool_id, "text-edit");
    assert_eq!(
        store
            .read_artifact_bytes(&imported.artifact.id)
            .expect("original deve permanecer legível"),
        original.as_bytes()
    );
    assert_eq!(
        String::from_utf8(
            store
                .read_artifact_bytes(&result.artifact.id)
                .expect("revisão deve ser legível")
        )
        .expect("revisão deve permanecer UTF-8"),
        "Nova revisão com acentuação jurídica: órgão"
    );
}

#[test]
fn rejects_text_revision_for_non_text_artifact() {
    let temporary = TestDirectory::new("text-invalid-mime");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "arquivo.bin", b"binario");
    let mut store =
        ProjectStore::create(&project_path, "Binário").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "application/octet-stream")
        .expect("arquivo deve ser importado");
    drop(store);

    let error = create_text_revision(CreateTextRevisionRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        document_id: imported.document.id,
        artifact_id: imported.artifact.id,
        content: "não deve persistir".to_owned(),
    })
    .expect_err("tipo incompatível deve ser rejeitado");

    assert_eq!(error.code, ErrorCode::InvalidArgument);
}

#[test]
fn persists_pdf_overlay_without_changing_pdf_blob() {
    let temporary = TestDirectory::new("pdf-overlay");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "annotated.pdf", &synthetic_pdf());
    let mut store =
        ProjectStore::create(&project_path, "Overlay PDF").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "application/pdf")
        .expect("PDF deve ser importado");
    let original = store
        .read_artifact_bytes(&imported.artifact.id)
        .expect("PDF original deve ser legível");
    drop(store);

    let overlay = create_pdf_overlay(CreatePdfOverlayRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        artifact_id: imported.artifact.id.clone(),
        kind: PdfOverlayKind::Highlight,
        page_number: 1,
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.1,
        payload: json!({ "color": "accent" }),
    })
    .expect("overlay deve ser criado");

    let overlays = list_pdf_overlays(ListPdfOverlaysRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        artifact_id: imported.artifact.id.clone(),
    })
    .expect("overlays devem ser listados");
    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    assert_eq!(overlay.kind, "HIGHLIGHT");
    assert_eq!(overlay.data["pageNumber"], 1);
    assert_eq!(overlays, vec![overlay]);
    assert_eq!(
        store
            .read_artifact_bytes(&imported.artifact.id)
            .expect("PDF deve permanecer legível"),
        original
    );
    assert_eq!(
        store
            .list_artifacts(&imported.document.id)
            .expect("artifacts devem ser listados")
            .len(),
        1
    );
}

#[test]
fn rejects_pdf_overlay_outside_normalized_page_bounds() {
    let temporary = TestDirectory::new("pdf-overlay-bounds");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "bounds.pdf", &synthetic_pdf());
    let mut store =
        ProjectStore::create(&project_path, "Geometria").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "application/pdf")
        .expect("PDF deve ser importado");
    drop(store);

    let error = create_pdf_overlay(CreatePdfOverlayRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        artifact_id: imported.artifact.id,
        kind: PdfOverlayKind::Note,
        page_number: 1,
        x: 0.9,
        y: 0.2,
        width: 0.2,
        height: 0.1,
        payload: json!({}),
    })
    .expect_err("overlay fora da página deve ser rejeitado");

    assert_eq!(error.code, ErrorCode::InvalidArgument);
}

#[test]
fn persists_typed_anchor_without_changing_target_artifact() {
    let temporary = TestDirectory::new("anchor-text");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "anchor.md", b"fundamento juridico");
    let mut store =
        ProjectStore::create(&project_path, "Anchors").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "text/markdown")
        .expect("texto deve ser importado");
    let original = store
        .read_artifact_bytes(&imported.artifact.id)
        .expect("artifact deve ser legível");
    drop(store);

    let anchor = create_anchor(CreateAnchorRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        artifact_id: imported.artifact.id.clone(),
        selector: AnchorSelector::TextRange { start: 0, end: 10 },
        quote: Some("fundamento".to_owned()),
    })
    .expect("anchor deve ser criado");
    let anchors = list_anchors(ListAnchorsRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        artifact_id: imported.artifact.id.clone(),
    })
    .expect("anchors devem ser listados");
    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");

    assert_eq!(anchor.kind, "TEXT_RANGE");
    assert_eq!(anchor.selector["type"], "TEXT_RANGE");
    assert_eq!(anchor.quote.as_deref(), Some("fundamento"));
    assert_eq!(anchors, vec![anchor]);
    assert_eq!(
        store
            .read_artifact_bytes(&imported.artifact.id)
            .expect("artifact deve permanecer legível"),
        original
    );
}

#[test]
fn rejects_anchor_selector_incompatible_with_artifact() {
    let temporary = TestDirectory::new("anchor-incompatible");
    let project_path = temporary.project_path();
    let source = write_source(&temporary.path, "anchor.txt", b"texto");
    let mut store =
        ProjectStore::create(&project_path, "Anchor inválido").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, None, "text/plain")
        .expect("texto deve ser importado");
    drop(store);

    let error = create_anchor(CreateAnchorRequest {
        project_path: project_path.to_string_lossy().into_owned(),
        artifact_id: imported.artifact.id,
        selector: AnchorSelector::PdfRegion {
            page_number: 1,
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.2,
        },
        quote: None,
    })
    .expect_err("região PDF não pode apontar para texto");

    assert_eq!(error.code, ErrorCode::InvalidArgument);
}

#[test]
fn creates_and_inspects_docx_via_sidecar() {
    let temporary = TestDirectory::new("docx-sidecar");
    let project_path = temporary.project_path();
    let project_path_str = project_path.to_string_lossy().into_owned();
    let _ = nexohub_core::grant_broker::grant_path(&project_path);

    let store =
        ProjectStore::create(&project_path, "Projeto DOCX").expect("projeto deve ser criado");
    drop(store);

    let create_result =
        nexohub_core::python_engine::create_docx(nexohub_core::python_engine::CreateDocxRequest {
            project_path: project_path_str.clone(),
            document_id: None,
            name: "Relatorio.docx".to_string(),
            title: Some("Relatório Técnico NexoHub".to_string()),
            paragraphs: vec![
                nexohub_core::python_engine::DocxParagraphInput {
                    text: "Primeiro parágrafo do relatório técnico.".to_string(),
                    style: "Normal".to_string(),
                },
                nexohub_core::python_engine::DocxParagraphInput {
                    text: "Conclusões preliminares da análise documental.".to_string(),
                    style: "Heading 1".to_string(),
                },
            ],
            tables: vec![],
        })
        .expect("criação de docx deve ter sucesso");

    assert_eq!(
        create_result.artifact.mime_type,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    let inspect_result = nexohub_core::python_engine::inspect_docx(
        nexohub_core::python_engine::InspectDocxRequest {
            project_path: project_path_str,
            document_id: create_result.artifact.document_id,
            artifact_id: create_result.artifact.id,
        },
    )
    .expect("inspeção de docx deve ter sucesso");

    assert_eq!(
        inspect_result.title.as_deref(),
        Some("Relatório Técnico NexoHub")
    );
    assert_eq!(inspect_result.paragraphs.len(), 2);
    assert_eq!(
        inspect_result.paragraphs[0].text,
        "Primeiro parágrafo do relatório técnico."
    );
}

#[test]
fn executes_ocr_as_derived_artifact_without_changing_original() {
    let temporary = TestDirectory::new("ocr-derived");
    let project_path = temporary.project_path();
    let project_path_str = project_path.to_string_lossy().into_owned();
    let _ = nexohub_core::grant_broker::grant_path(&project_path);

    // 1x1 PNG sintético válido
    let png_bytes = nexohub_core::python_engine::base64_decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    )
    .expect("png bytes válidos");

    let source = write_source(&temporary.path, "digitalizacao.png", &png_bytes);
    let _ = nexohub_core::grant_broker::grant_path(&source);

    let mut store =
        ProjectStore::create(&project_path, "Projeto OCR").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, Some("Documento Digitalizado"), "image/png")
        .expect("imagem deve ser importada");
    drop(store);

    let ocr_result =
        nexohub_core::python_engine::execute_ocr(nexohub_core::python_engine::ExecuteOcrRequest {
            project_path: project_path_str.clone(),
            document_id: imported.document.id.clone(),
            artifact_id: imported.artifact.id.clone(),
        })
        .expect("OCR via sidecar deve ser concluído");

    assert_eq!(ocr_result.pages, 1);
    assert_eq!(ocr_result.engine, "rapidocr");
    assert_eq!(ocr_result.artifact.kind, ArtifactKind::Derived);
    assert_eq!(ocr_result.artifact.mime_type, "text/plain");
    assert_eq!(ocr_result.operation.tool_id, "pdf-ocr");

    // Verifica que o original permaneceu estritamente inalterado
    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    let original_bytes = store
        .read_artifact_bytes(&imported.artifact.id)
        .expect("original deve ser lido");
    assert_eq!(original_bytes, png_bytes);

    let derived_bytes = store
        .read_artifact_bytes(&ocr_result.artifact.id)
        .expect("derivado deve ser lido");
    assert_eq!(derived_bytes, ocr_result.text.as_bytes());
}

#[test]
fn audits_healthy_project_integrity() {
    let temporary = TestDirectory::new("audit-healthy");
    let project_path = temporary.project_path();
    let project_path_str = project_path.to_string_lossy().into_owned();
    let _ = nexohub_core::grant_broker::grant_path(&project_path);

    let pdf_bytes = synthetic_pdf();
    let source = write_source(&temporary.path, "contrato.pdf", &pdf_bytes);
    let _ = nexohub_core::grant_broker::grant_path(&source);

    let mut store =
        ProjectStore::create(&project_path, "Projeto Auditoria").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, Some("Contrato"), "application/pdf")
        .expect("pdf deve ser importado");
    drop(store);

    let compressed = compress_pdf(CompressPdfRequest {
        project_path: project_path_str.clone(),
        document_id: imported.document.id.clone(),
        artifact_id: imported.artifact.id.clone(),
        compression_level: 6,
    })
    .expect("compressão deve funcionar");
    assert_ne!(compressed.artifact.id, imported.artifact.id);

    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    let report = store
        .audit_project_integrity()
        .expect("auditoria deve executar com sucesso");

    assert!(report.is_healthy);
    assert_eq!(report.total_artifacts, 2);
    assert_eq!(report.valid_artifacts, 2);
    assert!(report.corrupted_artifacts.is_empty());
    assert!(report.missing_blobs.is_empty());

    // Também testar via command handler público
    let cmd_report =
        nexohub_core::commands::audit_project(nexohub_core::commands::AuditProjectRequest {
            project_path: project_path_str,
        })
        .expect("comando audit_project deve executar");
    assert!(cmd_report.is_healthy);
    assert_eq!(cmd_report.total_artifacts, 2);
}

#[test]
fn detects_corrupted_blob_in_project_audit() {
    let temporary = TestDirectory::new("audit-corrupt");
    let project_path = temporary.project_path();
    let _ = nexohub_core::grant_broker::grant_path(&project_path);

    let pdf_bytes = synthetic_pdf();
    let source = write_source(&temporary.path, "documento.pdf", &pdf_bytes);
    let _ = nexohub_core::grant_broker::grant_path(&source);

    let mut store =
        ProjectStore::create(&project_path, "Projeto Corrompido").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, Some("Documento"), "application/pdf")
        .expect("pdf deve ser importado");
    let original_hash = imported.artifact.hash.clone();
    drop(store);

    // Localizar o arquivo físico do blob no disco e corromper 1 byte
    let blob_file = project_path
        .join("blobs")
        .join(&original_hash[..2])
        .join(&original_hash);

    assert!(
        blob_file.exists(),
        "blob físico deve existir no caminho esperado"
    );

    let mut content = std::fs::read(&blob_file).expect("deve ler o blob");
    // Altera o primeiro byte para invalidar o hash BLAKE3
    content[0] ^= 0xFF;
    std::fs::write(&blob_file, &content).expect("deve regravar o blob corrompido");

    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    let report = store
        .audit_project_integrity()
        .expect("auditoria deve executar mesmo com corrupção");

    assert!(
        !report.is_healthy,
        "projeto corrompido não deve ser saudável"
    );
    assert_eq!(report.corrupted_artifacts.len(), 1);
    assert_eq!(report.corrupted_artifacts[0].expected_hash, original_hash);
    assert_ne!(report.corrupted_artifacts[0].actual_hash, original_hash);
    assert_eq!(
        report.corrupted_artifacts[0].artifact_id,
        imported.artifact.id
    );
}

#[test]
fn retrieves_complete_document_lineage_graph() {
    let temporary = TestDirectory::new("doc-lineage");
    let project_path = temporary.project_path();
    let project_path_str = project_path.to_string_lossy().into_owned();
    let _ = nexohub_core::grant_broker::grant_path(&project_path);

    let pdf_bytes = synthetic_pdf();
    let source = write_source(&temporary.path, "original.pdf", &pdf_bytes);
    let _ = nexohub_core::grant_broker::grant_path(&source);

    let mut store =
        ProjectStore::create(&project_path, "Projeto Grafo").expect("projeto deve ser criado");
    let imported = store
        .import_document(&source, Some("Documento Linhagem"), "application/pdf")
        .expect("pdf deve ser importado");
    drop(store);

    // Passo 1: compressão (gera derived 1 a partir do original)
    let compressed = compress_pdf(CompressPdfRequest {
        project_path: project_path_str.clone(),
        document_id: imported.document.id.clone(),
        artifact_id: imported.artifact.id.clone(),
        compression_level: 6,
    })
    .expect("compressão");

    // Passo 2: organização (gera derived 2 a partir do derived 1)
    let organized = organize_pdf(OrganizePdfRequest {
        project_path: project_path_str.clone(),
        document_id: imported.document.id.clone(),
        artifact_id: compressed.artifact.id.clone(),
        page_order: vec![1],
        rotation_degrees: Some(90),
    })
    .expect("organização");

    // Consulta linhagem pelo storage
    let store = ProjectStore::open(&project_path).expect("projeto deve reabrir");
    let lineage = store
        .get_document_lineage(&imported.document.id)
        .expect("linhagem deve ser obtida com sucesso");

    assert_eq!(lineage.document_id, imported.document.id);
    assert_eq!(lineage.edges.len(), 2);

    // Aresta 1: original -> compressed
    assert_eq!(lineage.edges[0].input_artifact_id, imported.artifact.id);
    assert_eq!(lineage.edges[0].output_artifact_id, compressed.artifact.id);
    assert_eq!(lineage.edges[0].tool_id, "pdf-compress");

    // Aresta 2: compressed -> organized
    assert_eq!(lineage.edges[1].input_artifact_id, compressed.artifact.id);
    assert_eq!(lineage.edges[1].output_artifact_id, organized.artifact.id);
    assert_eq!(lineage.edges[1].tool_id, "pdf-organize");

    // Consulta linhagem via comando público
    let cmd_lineage = nexohub_core::commands::get_document_lineage(
        nexohub_core::commands::GetDocumentLineageRequest {
            project_path: project_path_str,
            document_id: imported.document.id,
        },
    )
    .expect("comando get_document_lineage deve funcionar");

    assert_eq!(cmd_lineage.edges.len(), 2);
}

#[test]
fn rejects_translation_when_offline_model_is_missing_without_fake_output() {
    let result =
        nexohub_core::commands::translate_text(nexohub_core::python_engine::TranslateTextRequest {
            text: "Texto de teste para validação de indisponibilidade".to_string(),
            source_language: Some("pt-BR".to_string()),
            target_language: "en".to_string(),
            model_id: Some("modelo-inexistente-ou-ausente".to_string()),
            project_path: None,
            document_id: None,
            artifact_id: None,
        });

    // Deve falhar explicitamente por indisponibilidade do modelo, NUNCA simulando ou chamando rede
    assert!(
        result.is_err(),
        "deve falhar quando o modelo local não está presente"
    );
}

#[test]
fn lists_installed_translation_models_via_command() {
    let temporary = TestDirectory::new("models-list");
    let models_root = temporary.path.join("models");
    fs::create_dir_all(&models_root).expect("diretório de modelos");

    // Cria modelo válido sintético
    let model_dir = models_root.join("opus-pt-en");
    fs::create_dir_all(&model_dir).expect("pasta do modelo");
    let manifest = json!({
        "formatVersion": 1,
        "name": "OPUS Português para Inglês",
        "family": "opus-mt-tc-big",
        "quantization": "float32",
        "sourceLanguages": ["pt-BR", "pt"],
        "targetLanguages": ["en"],
        "license": "CC-BY-4.0",
    });
    fs::write(
        model_dir.join("nexohub-model.json"),
        manifest.to_string().as_bytes(),
    )
    .expect("manifesto");

    unsafe {
        std::env::set_var("NEXOHUB_TRANSLATION_MODELS_DIR", &models_root);
    }

    let result = nexohub_core::commands::list_translation_models(
        nexohub_core::python_engine::ListTranslationModelsRequest { project_path: None },
    )
    .expect("listagem de modelos deve ter sucesso");

    unsafe {
        std::env::remove_var("NEXOHUB_TRANSLATION_MODELS_DIR");
    }

    assert_eq!(result.models.len(), 1);
    assert_eq!(result.models[0].model_id, "opus-pt-en");
    assert_eq!(result.models[0].name, "OPUS Português para Inglês");
    assert_eq!(result.models[0].source_languages, vec!["pt-BR", "pt"]);
    assert_eq!(result.models[0].target_languages, vec!["en"]);
    assert_eq!(result.models[0].license, "CC-BY-4.0");
}

#[test]
fn paginates_documents_and_artifacts_with_cache_acceleration() {
    let temporary = TestDirectory::new("pagination-cache");
    let mut store =
        ProjectStore::create(temporary.project_path(), "Projeto Paginação").expect("criar projeto");

    let source1 = write_source(&temporary.path, "doc1.txt", b"conteudo 1");
    let source2 = write_source(&temporary.path, "doc2.txt", b"conteudo 2");
    let source3 = write_source(&temporary.path, "doc3.txt", b"conteudo 3");

    let imported1 = store
        .import_document(&source1, Some("Doc 1"), "text/plain")
        .expect("doc 1");
    let imported2 = store
        .import_document(&source2, Some("Doc 2"), "text/plain")
        .expect("doc 2");
    let _imported3 = store
        .import_document(&source3, Some("Doc 3"), "text/plain")
        .expect("doc 3");

    // Validação de paginação segura
    let page1 = store.list_documents_paged(0, 2).expect("pagina 1");
    assert_eq!(page1.len(), 2);
    assert_eq!(page1[0].id, imported1.document.id);
    assert_eq!(page1[1].id, imported2.document.id);

    let page2 = store.list_documents_paged(2, 2).expect("pagina 2");
    assert_eq!(page2.len(), 1);

    // Validação de limites inválidos
    assert_eq!(
        store.list_documents_paged(0, 0).unwrap_err().code,
        ErrorCode::InvalidArgument
    );
    assert_eq!(
        store.list_documents_paged(0, 10_001).unwrap_err().code,
        ErrorCode::ResourceLimit
    );

    // Validação de cache de documento e artifact
    let cached_doc = store
        .get_document(&imported1.document.id)
        .expect("obter documento");
    assert_eq!(cached_doc.title, "Doc 1");

    let cached_art = store
        .get_artifact(&imported1.artifact.id)
        .expect("obter artifact");
    assert_eq!(cached_art.hash, imported1.artifact.hash);
}
