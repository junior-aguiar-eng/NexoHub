use lopdf::{Document as PdfDocument, Object, dictionary};
use nexohub_core::commands::CreateProjectRequest;
use nexohub_core::domain::ArtifactKind;
use nexohub_core::overlay_tools::{
    CreatePdfOverlayRequest, ListPdfOverlaysRequest, PdfOverlayKind, create_pdf_overlay,
    list_pdf_overlays,
};
use nexohub_core::pdf_tools::{CompressPdfRequest, compress_pdf};
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
        Self {
            path: std::env::temp_dir().join(format!("nexohub-{label}-{}", Uuid::new_v4())),
        }
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
    let mut pdf = PdfDocument::with_version("1.5");
    let pages_id = pdf.new_object_id();
    let page_id = pdf.add_object(dictionary! {
        "Type" => "Page",
        "Parent" => pages_id,
        "MediaBox" => vec![0.into(), 0.into(), 595.into(), 842.into()],
    });
    pdf.objects.insert(
        pages_id,
        Object::Dictionary(dictionary! {
            "Type" => "Pages",
            "Kids" => vec![page_id.into()],
            "Count" => 1,
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
fn creates_project_structure_and_initial_migration() {
    let temporary = TestDirectory::new("create");
    let project_path = temporary.project_path();

    let store =
        ProjectStore::create(&project_path, "Projeto de teste").expect("projeto deve ser criado");

    assert_eq!(
        store.project().expect("projeto deve existir").name,
        "Projeto de teste"
    );
    assert_eq!(store.schema_version().expect("migration deve existir"), 1);
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
    assert_eq!(reopened.schema_version().expect("schema deve persistir"), 1);
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
