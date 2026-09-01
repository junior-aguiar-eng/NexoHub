//! Persistência local SQLite e operações do Document Core.

use crate::blob_store::BlobStore;
use crate::domain::{
    Artifact, ArtifactKind, Document, ImportedDocument, Operation, OperationInput, OperationOutput,
    OperationStatus, Overlay, Project,
};
use crate::error::{CoreError, CoreResult, ErrorCode};
use crate::migrations;
use rusqlite::{Connection, OptionalExtension, Row, params};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const DATABASE_FILE: &str = "project.sqlite3";

/// Repositório local de um único projeto `.nexohub`.
pub struct ProjectStore {
    root: PathBuf,
    connection: Connection,
    blobs: BlobStore,
}

impl ProjectStore {
    /// Cria a estrutura persistente sem sobrescrever um projeto existente.
    pub fn create(root: impl AsRef<Path>, name: &str) -> CoreResult<Self> {
        let root = root.as_ref();
        validate_text(name, "O nome do projeto é obrigatório.")?;
        if root.exists() {
            return Err(CoreError::new(
                ErrorCode::ProjectAlreadyExists,
                "Já existe um arquivo ou diretório no caminho do projeto.",
            ));
        }

        fs::create_dir_all(root).map_err(|_| CoreError::io())?;
        for directory in ["blobs", "cache", "previews", "exports"] {
            fs::create_dir(root.join(directory)).map_err(|_| CoreError::io())?;
        }

        let mut connection = open_connection(&root.join(DATABASE_FILE))?;
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

        Ok(Self {
            root: root.to_path_buf(),
            connection,
            blobs: BlobStore::new(root),
        })
    }

    /// Reabre um projeto existente e aplica migrations pendentes.
    pub fn open(root: impl AsRef<Path>) -> CoreResult<Self> {
        let root = root.as_ref();
        let database = root.join(DATABASE_FILE);
        if !root.is_dir() || !database.is_file() {
            return Err(CoreError::new(
                ErrorCode::ProjectNotFound,
                "O projeto local não foi encontrado.",
            ));
        }

        let mut connection = open_connection(&database)?;
        migrations::apply(&mut connection, current_time_millis()?)?;
        let store = Self {
            root: root.to_path_buf(),
            connection,
            blobs: BlobStore::new(root),
        };
        store.project()?;
        Ok(store)
    }

    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
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
            hash: stored.hash,
            size: stored.size,
            storage_path: stored.relative_path,
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

        Ok(ImportedDocument { document, artifact })
    }

    /// Lista documentos na ordem de criação.
    pub fn list_documents(&self) -> CoreResult<Vec<Document>> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT id, project_id, title, created_at, updated_at
                 FROM documents ORDER BY created_at, rowid",
            )
            .map_err(|_| CoreError::database())?;
        let rows = statement
            .query_map([], map_document)
            .map_err(|_| CoreError::database())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|_| CoreError::database())
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
                 FROM artifacts WHERE document_id = ?1 ORDER BY created_at, rowid",
            )
            .map_err(|_| CoreError::database())?;
        let rows = statement
            .query_map([document_id], map_artifact)
            .map_err(|_| CoreError::database())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|_| CoreError::database())
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
        let stored = self.blobs.put_bytes(bytes)?;
        let now = current_time_millis()?;
        let artifact = Artifact {
            id: Uuid::new_v4().to_string(),
            document_id: document_id.to_owned(),
            kind: ArtifactKind::Derived,
            mime_type: mime_type.trim().to_owned(),
            hash: stored.hash,
            size: stored.size,
            storage_path: stored.relative_path,
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
                 FROM overlays WHERE artifact_id = ?1 ORDER BY created_at, rowid",
            )
            .map_err(|_| CoreError::database())?;
        let rows = statement
            .query_map([artifact_id], map_overlay)
            .map_err(|_| CoreError::database())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|_| CoreError::database())
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
}

fn open_connection(path: &Path) -> CoreResult<Connection> {
    let connection = Connection::open(path).map_err(|_| CoreError::database())?;
    connection
        .execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
        .map_err(|_| CoreError::database())?;
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
    if value.trim().is_empty() {
        return Err(CoreError::new(ErrorCode::InvalidArgument, message));
    }
    Ok(())
}

fn current_time_millis() -> CoreResult<i64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| CoreError::integrity("O relógio do sistema é inválido."))?;
    i64::try_from(duration.as_millis())
        .map_err(|_| CoreError::integrity("O relógio do sistema excedeu o limite persistível."))
}
