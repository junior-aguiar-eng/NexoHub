//! Persistência local SQLite e operações do Document Core.

use crate::blob_store::BlobStore;
use crate::domain::{
    Anchor, Artifact, ArtifactKind, Document, ImportedDocument, Operation, OperationInput,
    OperationOutput, OperationStatus, Overlay, Project,
};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::hardening::HardeningLimits;
use crate::migrations;
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const DATABASE_FILE: &str = "project.sqlite3";
const PROJECT_EXTENSION: &str = "nexohub";
const MAX_METADATA_BYTES: usize = 16 * 1024;
const MAX_JSON_BYTES: usize = 1024 * 1024;
const MAX_LIST_ITEMS: usize = 10_000;
const STALE_STAGING_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const PENDING_RECOVERY_GRACE: Duration = Duration::from_secs(60 * 60);

/// Repositório local de um único projeto `.nexohub`.
pub struct ProjectStore {
    root: PathBuf,
    connection: Connection,
    blobs: BlobStore,
    limits: HardeningLimits,
}

impl ProjectStore {
    /// Cria a estrutura persistente sem sobrescrever um projeto existente.
    pub fn create(root: impl AsRef<Path>, name: &str) -> CoreResult<Self> {
        Self::create_with_limits(root, name, HardeningLimits::from_env()?)
    }

    pub fn create_with_limits(
        root: impl AsRef<Path>,
        name: &str,
        limits: HardeningLimits,
    ) -> CoreResult<Self> {
        let root = resolve_new_project_root(root.as_ref())?;
        validate_text(name, "O nome do projeto é obrigatório.")?;
        if root.exists() {
            return Err(CoreError::new(
                ErrorCode::ProjectAlreadyExists,
                "Já existe um arquivo ou diretório no caminho do projeto.",
            ));
        }

        let parent = root.parent().ok_or_else(CoreError::io)?;
        let file_name = root
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(CoreError::io)?;
        let staging_root = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
        fs::create_dir(&staging_root).map_err(|_| CoreError::io())?;
        let mut created_root = CreatedProjectRoot::new(staging_root.clone());
        for directory in ["blobs", "cache", "previews", "exports"] {
            fs::create_dir(staging_root.join(directory)).map_err(|_| CoreError::io())?;
        }

        let mut connection = create_connection(&staging_root.join(DATABASE_FILE))?;
        let now = current_time_millis()?;
        migrations::apply(&mut connection, now)?;

        let project = Project {
            id: Uuid::new_v4().to_string(),
            name: name.trim().to_owned(),
            created_at: now,
            updated_at: now,
        };
        connection
            .execute(
                "INSERT INTO projects(id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
                params![
                    project.id,
                    project.name,
                    project.created_at,
                    project.updated_at
                ],
            )
            .map_err(|_| CoreError::database())?;

        drop(connection);
        fs::rename(&staging_root, &root).map_err(|_| CoreError::io())?;
        created_root.persist();
        Self::open_with_limits(root, limits)
    }

    /// Reabre um projeto existente e aplica migrations pendentes.
    pub fn open(root: impl AsRef<Path>) -> CoreResult<Self> {
        Self::open_with_limits(root, HardeningLimits::from_env()?)
    }

    pub fn open_with_limits(root: impl AsRef<Path>, limits: HardeningLimits) -> CoreResult<Self> {
        let root = resolve_existing_project_root(root.as_ref())?;
        let database = root.join(DATABASE_FILE);
        if !root.is_dir() || !database.is_file() {
            return Err(CoreError::new(
                ErrorCode::ProjectNotFound,
                "O projeto local não foi encontrado.",
            ));
        }

        ensure_project_layout(&root)?;
        recover_stale_staging(&root.join("blobs"));
        let mut connection = open_existing_connection(&database)?;
        migrations::apply(&mut connection, current_time_millis()?)?;
        let store = Self {
            root: root.clone(),
            connection,
            blobs: BlobStore::new(&root, limits.max_import_bytes),
            limits,
        };
        store.validate_project_state()?;
        store.recover_pending_blobs(PENDING_RECOVERY_GRACE)?;
        Ok(store)
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    #[must_use]
    pub fn limits(&self) -> &HardeningLimits {
        &self.limits
    }

    /// Retorna os metadados do projeto aberto.
    pub fn project(&self) -> CoreResult<Project> {
        self.connection
            .query_row(
                "SELECT id, name, created_at, updated_at FROM projects LIMIT 1",
                [],
                |row| {
                    Ok(Project {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(|_| CoreError::database())?
            .ok_or_else(|| {
                CoreError::integrity("O banco local não contém os metadados do projeto.")
            })
    }

    fn validate_project_state(&self) -> CoreResult<()> {
        let project_count: i64 = self
            .connection
            .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
            .map_err(|_| CoreError::corrupted_project())?;
        if project_count != 1 {
            return Err(CoreError::corrupted_project());
        }
        self.project().map_err(|_| CoreError::corrupted_project())?;
        Ok(())
    }

    fn recover_pending_blobs(&self, minimum_age: Duration) -> CoreResult<()> {
        let prefixes = fs::read_dir(self.root.join("blobs")).map_err(|_| CoreError::io())?;
        for prefix in prefixes.flatten() {
            if !prefix
                .file_type()
                .map(|kind| kind.is_dir())
                .unwrap_or(false)
            {
                continue;
            }
            let entries = fs::read_dir(prefix.path()).map_err(|_| CoreError::io())?;
            for entry in entries.flatten() {
                let name = entry.file_name();
                let Some(name) = name.to_str() else {
                    continue;
                };
                let Some(hash) = pending_marker_hash(name) else {
                    continue;
                };
                let old_enough = entry
                    .metadata()
                    .ok()
                    .and_then(|metadata| metadata.modified().ok())
                    .and_then(|modified| modified.elapsed().ok())
                    .is_some_and(|age| age >= minimum_age);
                if !old_enough {
                    continue;
                }
                let referenced: bool = self
                    .connection
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM artifacts WHERE hash = ?1)",
                        [hash],
                        |row| row.get(0),
                    )
                    .map_err(|_| CoreError::database())?;
                if !referenced {
                    let _ = fs::remove_file(prefix.path().join(hash));
                }
                let _ = fs::remove_file(entry.path());
            }
        }
        Ok(())
    }

    /// Importa um arquivo como documento e artifact original imutável.
    pub fn import_document(
        &mut self,
        source: impl AsRef<Path>,
        title: Option<&str>,
        mime_type: &str,
    ) -> CoreResult<ImportedDocument> {
        validate_text(mime_type, "O tipo MIME é obrigatório.")?;
        let source = source.as_ref();
        let resolved_title = match title.map(str::trim).filter(|value| !value.is_empty()) {
            Some(value) => value.to_owned(),
            None => source
                .file_name()
                .and_then(|value| value.to_str())
                .filter(|value| !value.trim().is_empty())
                .map(str::to_owned)
                .ok_or_else(|| {
                    CoreError::new(
                        ErrorCode::InvalidArgument,
                        "Não foi possível determinar o título do documento.",
                    )
                })?,
        };
        validate_text(&resolved_title, "O título do documento é obrigatório.")?;

        let source_size = source.metadata().map_err(|_| CoreError::io())?.len();
        self.ensure_project_capacity(source_size)?;
        let stored = self.blobs.put_file(source)?;
        let project = self.project()?;
        let now = current_time_millis()?;
        let document = Document {
            id: Uuid::new_v4().to_string(),
            project_id: project.id,
            title: resolved_title,
            created_at: now,
            updated_at: now,
        };
        let artifact = Artifact {
            id: Uuid::new_v4().to_string(),
            document_id: document.id.clone(),
            kind: ArtifactKind::Original,
            mime_type: mime_type.trim().to_owned(),
            hash: stored.hash.clone(),
            size: stored.size,
            storage_path: stored.relative_path.clone(),
            created_at: now,
        };

        let transaction = self
            .connection
            .transaction()
            .map_err(|_| CoreError::database())?;
        transaction
            .execute(
                "INSERT INTO documents(id, project_id, title, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    document.id,
                    document.project_id,
                    document.title,
                    document.created_at,
                    document.updated_at
                ],
            )
            .map_err(|_| CoreError::database())?;
        insert_artifact(&transaction, &artifact)?;
        transaction
            .execute(
                "UPDATE projects SET updated_at = ?1 WHERE id = ?2",
                params![now, document.project_id],
            )
            .map_err(|_| CoreError::database())?;
        transaction.commit().map_err(|_| CoreError::database())?;
        self.blobs.commit(&stored);

        Ok(ImportedDocument { document, artifact })
    }

    /// Lista documentos na ordem de criação.
    pub fn list_documents(&self) -> CoreResult<Vec<Document>> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT id, project_id, title, created_at, updated_at
                 FROM documents ORDER BY created_at, rowid LIMIT 10001",
            )
            .map_err(|_| CoreError::database())?;
        let rows = statement
            .query_map([], map_document)
            .map_err(|_| CoreError::database())?;
        enforce_list_limit(
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|_| CoreError::database())?,
        )
    }

    /// Obtém um documento do projeto.
    pub fn get_document(&self, document_id: &str) -> CoreResult<Document> {
        validate_identifier(document_id)?;
        self.connection
            .query_row(
                "SELECT id, project_id, title, created_at, updated_at
                 FROM documents WHERE id = ?1",
                [document_id],
                map_document,
            )
            .optional()
            .map_err(|_| CoreError::database())?
            .ok_or_else(|| {
                CoreError::new(
                    ErrorCode::DocumentNotFound,
                    "O documento solicitado não foi encontrado.",
                )
            })
    }

    /// Lista todos os artifacts de um documento sem alterar o histórico.
    pub fn list_artifacts(&self, document_id: &str) -> CoreResult<Vec<Artifact>> {
        self.get_document(document_id)?;
        let mut statement = self
            .connection
            .prepare(
                "SELECT id, document_id, kind, mime_type, hash, size, storage_path, created_at
                 FROM artifacts WHERE document_id = ?1 ORDER BY created_at, rowid LIMIT 10001",
            )
            .map_err(|_| CoreError::database())?;
        let rows = statement
            .query_map([document_id], map_artifact)
            .map_err(|_| CoreError::database())?;
        enforce_list_limit(
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|_| CoreError::database())?,
        )
    }

    /// Produz um novo artifact e registra sua operação, sem reescrever inputs.
    pub fn create_derived_artifact(
        &mut self,
        document_id: &str,
        input_artifact_id: &str,
        mime_type: &str,
        bytes: &[u8],
        tool_id: &str,
        parameters: Value,
    ) -> CoreResult<(Artifact, Operation)> {
        self.get_document(document_id)?;
        validate_text(mime_type, "O tipo MIME é obrigatório.")?;
        validate_text(tool_id, "O identificador da ferramenta é obrigatório.")?;
        let input = self.get_artifact(input_artifact_id)?;
        if input.document_id != document_id {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "O artifact de entrada não pertence ao documento informado.",
            ));
        }

        let parameters_json = serde_json::to_string(&parameters).map_err(|_| {
            CoreError::new(
                ErrorCode::InvalidArgument,
                "Os parâmetros da operação não formam JSON válido.",
            )
        })?;
        validate_json_size(&parameters_json)?;
        self.ensure_project_capacity(bytes.len() as u64)?;
        let stored = self.blobs.put_bytes(bytes)?;
        let now = current_time_millis()?;
        let artifact = Artifact {
            id: Uuid::new_v4().to_string(),
            document_id: document_id.to_owned(),
            kind: ArtifactKind::Derived,
            mime_type: mime_type.trim().to_owned(),
            hash: stored.hash.clone(),
            size: stored.size,
            storage_path: stored.relative_path.clone(),
            created_at: now,
        };
        let operation = Operation {
            id: Uuid::new_v4().to_string(),
            tool_id: tool_id.trim().to_owned(),
            status: OperationStatus::Succeeded,
            parameters,
            created_at: now,
            started_at: Some(now),
            finished_at: Some(now),
            error: None,
        };

        let transaction = self
            .connection
            .transaction()
            .map_err(|_| CoreError::database())?;
        insert_artifact(&transaction, &artifact)?;
        transaction
            .execute(
                "INSERT INTO operations(
                    id, tool_id, status, parameters_json, created_at, started_at, finished_at,
                    error_code, error_message
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, NULL)",
                params![
                    operation.id,
                    operation.tool_id,
                    operation.status.as_str(),
                    parameters_json,
                    operation.created_at,
                    operation.started_at,
                    operation.finished_at
                ],
            )
            .map_err(|_| CoreError::database())?;
        let input_edge = OperationInput {
            operation_id: operation.id.clone(),
            artifact_id: input.id,
        };
        let output_edge = OperationOutput {
            operation_id: operation.id.clone(),
            artifact_id: artifact.id.clone(),
        };
        transaction
            .execute(
                "INSERT INTO operation_inputs(operation_id, artifact_id) VALUES (?1, ?2)",
                params![input_edge.operation_id, input_edge.artifact_id],
            )
            .map_err(|_| CoreError::database())?;
        transaction
            .execute(
                "INSERT INTO operation_outputs(operation_id, artifact_id) VALUES (?1, ?2)",
                params![output_edge.operation_id, output_edge.artifact_id],
            )
            .map_err(|_| CoreError::database())?;
        transaction
            .execute(
                "UPDATE documents SET updated_at = ?1 WHERE id = ?2",
                params![now, document_id],
            )
            .map_err(|_| CoreError::database())?;
        transaction.commit().map_err(|_| CoreError::database())?;
        self.blobs.commit(&stored);

        Ok((artifact, operation))
    }

    /// Lê e verifica um blob pelo hash registrado no artifact.
    pub fn read_artifact_bytes(&self, artifact_id: &str) -> CoreResult<Vec<u8>> {
        let artifact = self.get_artifact(artifact_id)?;
        self.blobs.read(&artifact.hash)
    }

    /// Persiste metadados visuais sem alterar o artifact ao qual pertencem.
    pub fn create_overlay(
        &mut self,
        artifact_id: &str,
        kind: &str,
        data: Value,
    ) -> CoreResult<Overlay> {
        self.get_artifact(artifact_id)?;
        validate_text(kind, "A categoria do overlay é obrigatória.")?;
        let data_json = serde_json::to_string(&data).map_err(|_| {
            CoreError::new(
                ErrorCode::InvalidArgument,
                "Os dados do overlay são inválidos.",
            )
        })?;
        validate_json_size(&data_json)?;
        let overlay = Overlay {
            id: Uuid::new_v4().to_string(),
            artifact_id: artifact_id.to_owned(),
            kind: kind.trim().to_owned(),
            data,
            created_at: current_time_millis()?,
        };
        self.connection
            .execute(
                "INSERT INTO overlays(id, artifact_id, kind, data_json, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![
                    overlay.id,
                    overlay.artifact_id,
                    overlay.kind,
                    data_json,
                    overlay.created_at
                ],
            )
            .map_err(|_| CoreError::database())?;
        Ok(overlay)
    }

    /// Lista overlays na ordem de criação, sem materializá-los no PDF.
    pub fn list_overlays(&self, artifact_id: &str) -> CoreResult<Vec<Overlay>> {
        self.get_artifact(artifact_id)?;
        let mut statement = self
            .connection
            .prepare(
                "SELECT id, artifact_id, kind, data_json, created_at
                  FROM overlays WHERE artifact_id = ?1 ORDER BY created_at, rowid LIMIT 10001",
            )
            .map_err(|_| CoreError::database())?;
        let rows = statement
            .query_map([artifact_id], map_overlay)
            .map_err(|_| CoreError::database())?;
        enforce_list_limit(
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|_| CoreError::database())?,
        )
    }

    /// Persiste um localizador sem acoplar a seleção ao viewer.
    pub fn create_anchor(
        &mut self,
        artifact_id: &str,
        kind: &str,
        selector: Value,
        quote: Option<&str>,
    ) -> CoreResult<Anchor> {
        self.get_artifact(artifact_id)?;
        validate_text(kind, "A categoria do anchor é obrigatória.")?;
        let selector_json = serde_json::to_string(&selector).map_err(|_| {
            CoreError::new(
                ErrorCode::InvalidArgument,
                "O seletor do anchor é inválido.",
            )
        })?;
        validate_json_size(&selector_json)?;
        let anchor = Anchor {
            id: Uuid::new_v4().to_string(),
            artifact_id: artifact_id.to_owned(),
            kind: kind.trim().to_owned(),
            selector,
            quote: quote
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned),
            created_at: current_time_millis()?,
        };
        self.connection
            .execute(
                "INSERT INTO anchors(id, artifact_id, kind, selector_json, quote, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    anchor.id,
                    anchor.artifact_id,
                    anchor.kind,
                    selector_json,
                    anchor.quote,
                    anchor.created_at
                ],
            )
            .map_err(|_| CoreError::database())?;
        Ok(anchor)
    }

    pub fn list_anchors(&self, artifact_id: &str) -> CoreResult<Vec<Anchor>> {
        self.get_artifact(artifact_id)?;
        let mut statement = self
            .connection
            .prepare(
                "SELECT id, artifact_id, kind, selector_json, quote, created_at
                  FROM anchors WHERE artifact_id = ?1 ORDER BY created_at, rowid LIMIT 10001",
            )
            .map_err(|_| CoreError::database())?;
        let rows = statement
            .query_map([artifact_id], map_anchor)
            .map_err(|_| CoreError::database())?;
        enforce_list_limit(
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|_| CoreError::database())?,
        )
    }

    /// Versão aplicada do schema, usada por diagnósticos e testes de migration.
    pub fn schema_version(&self) -> CoreResult<i64> {
        self.connection
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .map_err(|_| CoreError::database())
    }

    pub(crate) fn get_artifact(&self, artifact_id: &str) -> CoreResult<Artifact> {
        validate_identifier(artifact_id)?;
        self.connection
            .query_row(
                "SELECT id, document_id, kind, mime_type, hash, size, storage_path, created_at
                 FROM artifacts WHERE id = ?1",
                [artifact_id],
                map_artifact,
            )
            .optional()
            .map_err(|_| CoreError::database())?
            .ok_or_else(|| {
                CoreError::new(
                    ErrorCode::ArtifactNotFound,
                    "O artifact solicitado não foi encontrado.",
                )
            })
    }

    fn ensure_project_capacity(&self, incoming_bytes: u64) -> CoreResult<()> {
        let used: i64 = self
            .connection
            .query_row("SELECT COALESCE(SUM(size), 0) FROM artifacts", [], |row| {
                row.get(0)
            })
            .map_err(|_| CoreError::database())?;
        let used = u64::try_from(used).map_err(|_| CoreError::corrupted_project())?;
        if used.saturating_add(incoming_bytes) > self.limits.max_project_artifact_bytes {
            return Err(CoreError::new(
                ErrorCode::ResourceLimit,
                format!(
                    "A operação excede o limite configurado de {} bytes por projeto.",
                    self.limits.max_project_artifact_bytes
                ),
            ));
        }
        Ok(())
    }
}

fn create_connection(path: &Path) -> CoreResult<Connection> {
    let connection = Connection::open(path).map_err(|_| CoreError::database())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(|_| CoreError::database())?;
    Ok(connection)
}

fn open_existing_connection(path: &Path) -> CoreResult<Connection> {
    if is_link_or_reparse(&fs::symlink_metadata(path).map_err(|_| CoreError::corrupted_project())?)
    {
        return Err(CoreError::corrupted_project());
    }
    let connection = Connection::open(path).map_err(|_| CoreError::corrupted_project())?;
    let quick_check: String = connection
        .query_row("PRAGMA quick_check(1)", [], |row| row.get(0))
        .map_err(|_| CoreError::corrupted_project())?;
    if quick_check != "ok" {
        return Err(CoreError::corrupted_project());
    }
    connection
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(|_| CoreError::corrupted_project())?;
    Ok(connection)
}

fn insert_artifact(connection: &Connection, artifact: &Artifact) -> CoreResult<()> {
    let size = i64::try_from(artifact.size)
        .map_err(|_| CoreError::integrity("O artifact excede o tamanho persistível."))?;
    connection
        .execute(
            "INSERT INTO artifacts(
                id, document_id, kind, mime_type, hash, size, storage_path, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                artifact.id,
                artifact.document_id,
                artifact.kind.as_str(),
                artifact.mime_type,
                artifact.hash,
                size,
                artifact.storage_path,
                artifact.created_at
            ],
        )
        .map_err(|_| CoreError::database())?;
    Ok(())
}

fn map_document(row: &Row<'_>) -> rusqlite::Result<Document> {
    Ok(Document {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn map_artifact(row: &Row<'_>) -> rusqlite::Result<Artifact> {
    let kind_value: String = row.get(2)?;
    let kind = ArtifactKind::parse(&kind_value).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            2,
            rusqlite::types::Type::Text,
            Box::new(CoreError::integrity(
                "O banco contém uma categoria de artifact inválida.",
            )),
        )
    })?;
    let size: i64 = row.get(5)?;
    let size = u64::try_from(size).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            5,
            rusqlite::types::Type::Integer,
            Box::new(error),
        )
    })?;
    Ok(Artifact {
        id: row.get(0)?,
        document_id: row.get(1)?,
        kind,
        mime_type: row.get(3)?,
        hash: row.get(4)?,
        size,
        storage_path: row.get(6)?,
        created_at: row.get(7)?,
    })
}

fn map_overlay(row: &Row<'_>) -> rusqlite::Result<Overlay> {
    let data_json: String = row.get(3)?;
    let data = serde_json::from_str(&data_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(error))
    })?;
    Ok(Overlay {
        id: row.get(0)?,
        artifact_id: row.get(1)?,
        kind: row.get(2)?,
        data,
        created_at: row.get(4)?,
    })
}

fn map_anchor(row: &Row<'_>) -> rusqlite::Result<Anchor> {
    let selector_json: String = row.get(3)?;
    let selector = serde_json::from_str(&selector_json).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(3, rusqlite::types::Type::Text, Box::new(error))
    })?;
    Ok(Anchor {
        id: row.get(0)?,
        artifact_id: row.get(1)?,
        kind: row.get(2)?,
        selector,
        quote: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn validate_identifier(value: &str) -> CoreResult<()> {
    if Uuid::parse_str(value).is_err() {
        return Err(CoreError::new(
            ErrorCode::InvalidArgument,
            "O identificador informado é inválido.",
        ));
    }
    Ok(())
}

fn validate_text(value: &str, message: &'static str) -> CoreResult<()> {
    if value.trim().is_empty() || value.len() > MAX_METADATA_BYTES {
        return Err(CoreError::new(ErrorCode::InvalidArgument, message));
    }
    Ok(())
}

fn validate_json_size(value: &str) -> CoreResult<()> {
    if value.len() > MAX_JSON_BYTES {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "Os metadados da operação excedem o limite de 1 MiB.",
        ));
    }
    Ok(())
}

fn enforce_list_limit<T>(items: Vec<T>) -> CoreResult<Vec<T>> {
    if items.len() > MAX_LIST_ITEMS {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            "A listagem excede o limite de 10.000 itens.",
        ));
    }
    Ok(items)
}

fn resolve_new_project_root(path: &Path) -> CoreResult<PathBuf> {
    validate_project_path_syntax(path)?;
    let parent = path.parent().ok_or_else(invalid_project_path)?;
    let canonical_parent = dunce::canonicalize(parent).map_err(|_| invalid_project_path())?;
    if !canonical_parent.is_dir() {
        return Err(invalid_project_path());
    }
    let file_name = path.file_name().ok_or_else(invalid_project_path)?;
    Ok(canonical_parent.join(file_name))
}

fn resolve_existing_project_root(path: &Path) -> CoreResult<PathBuf> {
    validate_project_path_syntax(path)?;
    let metadata = fs::symlink_metadata(path).map_err(|_| {
        CoreError::new(
            ErrorCode::ProjectNotFound,
            "O projeto local não foi encontrado.",
        )
    })?;
    if is_link_or_reparse(&metadata) || !metadata.is_dir() {
        return Err(invalid_project_path());
    }
    dunce::canonicalize(path).map_err(|_| invalid_project_path())
}

fn validate_project_path_syntax(path: &Path) -> CoreResult<()> {
    if !path.is_absolute()
        || path.extension().and_then(|value| value.to_str()) != Some(PROJECT_EXTENSION)
        || path.components().any(|component| {
            matches!(
                component,
                std::path::Component::ParentDir | std::path::Component::CurDir
            )
        })
    {
        return Err(invalid_project_path());
    }
    Ok(())
}

fn invalid_project_path() -> CoreError {
    CoreError::new(
        ErrorCode::InvalidArgument,
        "O projeto deve usar um caminho absoluto canônico terminado em .nexohub.",
    )
}

fn ensure_project_layout(root: &Path) -> CoreResult<()> {
    ensure_real_directory(&root.join("blobs"), false)?;
    for name in ["cache", "previews", "exports"] {
        ensure_real_directory(&root.join(name), true)?;
    }
    Ok(())
}

fn ensure_real_directory(path: &Path, reconstructible: bool) -> CoreResult<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if is_link_or_reparse(&metadata) || !metadata.is_dir() => {
            Err(CoreError::corrupted_project())
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound && reconstructible => {
            fs::create_dir(path).map_err(|_| CoreError::io())
        }
        Err(_) => Err(CoreError::corrupted_project()),
    }
}

fn is_link_or_reparse(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }
    #[cfg(not(windows))]
    false
}

fn recover_stale_staging(blobs_root: &Path) {
    let Ok(prefixes) = fs::read_dir(blobs_root) else {
        return;
    };
    for prefix in prefixes.flatten() {
        let Ok(metadata) = prefix.metadata() else {
            continue;
        };
        if !metadata.is_dir() {
            continue;
        }
        let Ok(entries) = fs::read_dir(prefix.path()) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let Some(name) = name.to_str() else {
                continue;
            };
            if !name.starts_with('.') || !name.ends_with(".tmp") {
                continue;
            }
            let is_stale = entry
                .metadata()
                .ok()
                .and_then(|metadata| metadata.modified().ok())
                .and_then(|modified| modified.elapsed().ok())
                .is_some_and(|age| age >= STALE_STAGING_AGE);
            if is_stale {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

fn pending_marker_hash(name: &str) -> Option<&str> {
    if !name.starts_with('.') || !name.ends_with(".pending") || name.len() < 1 + 64 + 1 {
        return None;
    }
    let hash = &name[1..65];
    let suffix = &name[65..];
    if hash.bytes().all(|byte| byte.is_ascii_hexdigit()) && suffix.starts_with('.') {
        Some(hash)
    } else {
        None
    }
}

struct CreatedProjectRoot {
    path: Option<PathBuf>,
}

impl CreatedProjectRoot {
    fn new(path: PathBuf) -> Self {
        Self { path: Some(path) }
    }

    fn persist(&mut self) {
        self.path = None;
    }
}

impl Drop for CreatedProjectRoot {
    fn drop(&mut self) {
        if let Some(path) = self.path.take() {
            let _ = fs::remove_dir_all(path);
        }
    }
}

fn current_time_millis() -> CoreResult<i64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| CoreError::integrity("O relógio do sistema é inválido."))?;
    i64::try_from(duration.as_millis())
        .map_err(|_| CoreError::integrity("O relógio do sistema excedeu o limite persistível."))
}
