//! Migrations SQLite versionadas do formato de projeto.

use crate::error::{CoreError, CoreResult, ErrorCode};
use rusqlite::{Connection, Transaction};

pub(crate) const CURRENT_SCHEMA_VERSION: i64 = 1;

struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "document_artifact_graph_inicial",
    sql: r#"
        CREATE TABLE projects (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL CHECK (length(trim(name)) > 0),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE documents (
            id TEXT PRIMARY KEY NOT NULL,
            project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
            title TEXT NOT NULL CHECK (length(trim(title)) > 0),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE artifacts (
            id TEXT PRIMARY KEY NOT NULL,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
            kind TEXT NOT NULL CHECK (kind IN ('ORIGINAL', 'DERIVED', 'EXPORT')),
            mime_type TEXT NOT NULL CHECK (length(trim(mime_type)) > 0),
            hash TEXT NOT NULL CHECK (length(hash) = 64),
            size INTEGER NOT NULL CHECK (size >= 0),
            storage_path TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX artifacts_document_id_idx ON artifacts(document_id, created_at);
        CREATE INDEX artifacts_hash_idx ON artifacts(hash);

        CREATE TABLE representations (
            id TEXT PRIMARY KEY NOT NULL,
            artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
            representation_type TEXT NOT NULL CHECK (
                representation_type IN ('PDF', 'TEXT', 'MARKDOWN', 'OCR', 'DOCLING_JSON', 'LEXICAL_JSON')
            ),
            created_at INTEGER NOT NULL
        );

        CREATE TABLE assets (
            id TEXT PRIMARY KEY NOT NULL,
            artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
            kind TEXT NOT NULL CHECK (kind IN ('IMAGE', 'TABLE', 'ATTACHMENT', 'FONT')),
            mime_type TEXT NOT NULL,
            hash TEXT NOT NULL CHECK (length(hash) = 64),
            size INTEGER NOT NULL CHECK (size >= 0),
            storage_path TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE overlays (
            id TEXT PRIMARY KEY NOT NULL,
            artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
            kind TEXT NOT NULL,
            data_json TEXT NOT NULL CHECK (json_valid(data_json)),
            created_at INTEGER NOT NULL
        );

        CREATE TABLE operations (
            id TEXT PRIMARY KEY NOT NULL,
            tool_id TEXT NOT NULL,
            status TEXT NOT NULL CHECK (
                status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')
            ),
            parameters_json TEXT NOT NULL CHECK (json_valid(parameters_json)),
            created_at INTEGER NOT NULL,
            started_at INTEGER,
            finished_at INTEGER,
            error_code TEXT,
            error_message TEXT
        );

        CREATE TABLE operation_inputs (
            operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE RESTRICT,
            artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
            PRIMARY KEY (operation_id, artifact_id)
        );

        CREATE TABLE operation_outputs (
            operation_id TEXT NOT NULL REFERENCES operations(id) ON DELETE RESTRICT,
            artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
            PRIMARY KEY (operation_id, artifact_id)
        );

        CREATE TABLE exports (
            id TEXT PRIMARY KEY NOT NULL,
            document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE RESTRICT,
            artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
            destination_name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );
    "#,
}];

pub(crate) fn apply(connection: &mut Connection, applied_at: i64) -> CoreResult<()> {
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS schema_migrations (
                 version INTEGER PRIMARY KEY NOT NULL,
                 name TEXT NOT NULL,
                 applied_at INTEGER NOT NULL
             );",
        )
        .map_err(|_| migration_error())?;

    let current = connection
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|_| migration_error())?;

    if current > CURRENT_SCHEMA_VERSION {
        return Err(CoreError::new(
            ErrorCode::MigrationFailed,
            "O projeto foi criado por uma versão mais recente do NexoHub.",
        ));
    }

    for migration in MIGRATIONS.iter().filter(|item| item.version > current) {
        let transaction = connection.transaction().map_err(|_| migration_error())?;
        apply_one(&transaction, migration, applied_at)?;
        transaction.commit().map_err(|_| migration_error())?;
    }

    Ok(())
}

fn apply_one(
    transaction: &Transaction<'_>,
    migration: &Migration,
    applied_at: i64,
) -> CoreResult<()> {
    transaction
        .execute_batch(migration.sql)
        .map_err(|_| migration_error())?;
    transaction
        .execute(
            "INSERT INTO schema_migrations(version, name, applied_at) VALUES (?1, ?2, ?3)",
            (migration.version, migration.name, applied_at),
        )
        .map_err(|_| migration_error())?;
    Ok(())
}

fn migration_error() -> CoreError {
    CoreError::new(
        ErrorCode::MigrationFailed,
        "Não foi possível atualizar o formato persistente do projeto.",
    )
}
