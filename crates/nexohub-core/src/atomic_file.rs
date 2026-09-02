//! Publicação atômica no mesmo diretório, com remoção de staging em toda falha.

use std::fs::{self, File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum AtomicWriteOutcome {
    Published,
    DestinationExists,
}

pub(crate) fn write_atomic(
    destination: &Path,
    writer: impl FnOnce(&mut File) -> io::Result<()>,
) -> io::Result<AtomicWriteOutcome> {
    let parent = destination
        .parent()
        .ok_or_else(|| io::Error::other("destino sem diretório"))?;
    fs::create_dir_all(parent)?;
    let file_name = destination
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| io::Error::other("destino inválido"))?;
    let staging_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
    let mut staging = StagingFile::create(staging_path)?;
    writer(staging.file_mut()?)?;
    staging.file_mut()?.sync_all()?;
    staging.close()?;

    match fs::rename(staging.path(), destination) {
        Ok(()) => {
            staging.persist();
            sync_parent(parent)?;
            Ok(AtomicWriteOutcome::Published)
        }
        Err(_) if destination.exists() => Ok(AtomicWriteOutcome::DestinationExists),
        Err(error) => Err(error),
    }
}

fn sync_parent(parent: &Path) -> io::Result<()> {
    #[cfg(unix)]
    File::open(parent)?.sync_all()?;
    #[cfg(not(unix))]
    let _ = parent;
    Ok(())
}

struct StagingFile {
    path: Option<PathBuf>,
    file: Option<File>,
}

impl StagingFile {
    fn create(path: PathBuf) -> io::Result<Self> {
        let file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)?;
        Ok(Self {
            path: Some(path),
            file: Some(file),
        })
    }

    fn file_mut(&mut self) -> io::Result<&mut File> {
        self.file
            .as_mut()
            .ok_or_else(|| io::Error::other("arquivo de staging fechado"))
    }

    fn close(&mut self) -> io::Result<()> {
        self.file
            .take()
            .ok_or_else(|| io::Error::other("arquivo de staging fechado"))?;
        Ok(())
    }

    fn path(&self) -> &Path {
        self.path.as_deref().expect("staging ativo")
    }

    fn persist(&mut self) {
        self.path = None;
    }
}

impl Drop for StagingFile {
    fn drop(&mut self) {
        self.file.take();
        if let Some(path) = self.path.take() {
            let _ = fs::remove_file(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{ErrorKind, Write};

    fn temporary_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("nexohub-atomic-{label}-{}", Uuid::new_v4()))
    }

    #[test]
    fn disk_full_abstraction_removes_partial_staging() {
        let root = temporary_root("disk-full");
        fs::create_dir_all(&root).expect("temp");
        let destination = root.join("artifact.bin");
        let error = write_atomic(&destination, |output| {
            output.write_all(b"partial")?;
            Err(io::Error::new(
                ErrorKind::StorageFull,
                "simulated disk full",
            ))
        })
        .expect_err("disk full deve abortar");

        assert_eq!(error.kind(), ErrorKind::StorageFull);
        assert!(!destination.exists());
        assert_eq!(fs::read_dir(&root).expect("listar").count(), 0);
        fs::remove_dir_all(root).expect("limpar");
    }

    #[test]
    fn aborted_export_preserves_existing_destination() {
        let root = temporary_root("aborted-export");
        fs::create_dir_all(&root).expect("temp");
        let destination = root.join("export.pdf");
        fs::write(&destination, b"versao anterior").expect("fixture");

        let error = write_atomic(&destination, |output| {
            output.write_all(b"nova versao incompleta")?;
            Err(io::Error::new(ErrorKind::Interrupted, "export abortado"))
        })
        .expect_err("cancelamento deve abortar");

        assert_eq!(error.kind(), ErrorKind::Interrupted);
        assert_eq!(fs::read(&destination).expect("destino"), b"versao anterior");
        assert_eq!(fs::read_dir(&root).expect("listar").count(), 1);
        fs::remove_dir_all(root).expect("limpar");
    }
}
