use nexohub_core::commands::CreateProjectRequest;
use nexohub_core::domain::ArtifactKind;
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

    assert_eq!(request_json["projectPath"], "C:/Projetos/Exemplo.nexohub");
    assert_eq!(request_json["name"], "Exemplo");
    assert_eq!(error_json, "PROJECT_NOT_FOUND");
}
