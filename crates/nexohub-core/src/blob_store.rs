//! Armazenamento de blobs endereçados por conteúdo BLAKE3.

use crate::atomic_file::{AtomicWriteOutcome, write_atomic};
use crate::error::{CoreError, CoreResult, ErrorCode};
use std::fs::{self, File};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct StoredBlob {
    pub hash: String,
    pub size: u64,
    pub relative_path: String,
    pub pending_marker: Option<PathBuf>,
}

pub(crate) struct BlobStore {
    root: PathBuf,
    max_blob_bytes: u64,
}

impl BlobStore {
    pub(crate) fn new(project_root: &Path, max_blob_bytes: u64) -> Self {
        Self {
            root: project_root.join("blobs"),
            max_blob_bytes,
        }
    }

    pub(crate) fn put_file(&self, source: &Path) -> CoreResult<StoredBlob> {
        let source_metadata = fs::symlink_metadata(source).map_err(|_| {
            CoreError::new(
                ErrorCode::InvalidArgument,
                "O arquivo de origem não existe ou não é um arquivo regular.",
            )
        })?;
        if is_link_or_reparse(&source_metadata) || !source_metadata.is_file() {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "A origem deve ser um arquivo regular, não um link ou reparse point.",
            ));
        }

        ensure_size(source_metadata.len(), self.max_blob_bytes)?;
        let (hash, size) = hash_file(source, self.max_blob_bytes)?;
        let final_path = self.path_for_hash(&hash)?;
        let relative_path = relative_path(&hash);

        if final_path.exists() {
            self.verify(&hash)?;
            return Ok(StoredBlob {
                hash,
                size,
                relative_path,
                pending_marker: None,
            });
        }

        let pending_marker =
            create_pending_marker(final_path.parent().ok_or_else(CoreError::io)?, &hash)?;
        match write_atomic(&final_path, |output| {
            copy_and_verify(source, output, &hash, size, self.max_blob_bytes)
        }) {
            Ok(AtomicWriteOutcome::Published) => {}
            Ok(AtomicWriteOutcome::DestinationExists) => {
                self.verify(&hash)?;
            }
            Err(_) => {
                let _ = fs::remove_file(&pending_marker);
                return Err(CoreError::io());
            }
        }

        Ok(StoredBlob {
            hash,
            size,
            relative_path,
            pending_marker: Some(pending_marker),
        })
    }

    pub(crate) fn put_bytes(&self, bytes: &[u8]) -> CoreResult<StoredBlob> {
        let hash = blake3::hash(bytes).to_hex().to_string();
        let final_path = self.path_for_hash(&hash)?;
        let relative_path = relative_path(&hash);

        if final_path.exists() {
            self.verify(&hash)?;
            return Ok(StoredBlob {
                hash,
                size: bytes.len() as u64,
                relative_path,
                pending_marker: None,
            });
        }

        ensure_size(bytes.len() as u64, self.max_blob_bytes)?;
        let pending_marker =
            create_pending_marker(final_path.parent().ok_or_else(CoreError::io)?, &hash)?;
        match write_atomic(&final_path, |output| output.write_all(bytes)) {
            Ok(AtomicWriteOutcome::Published) => {}
            Ok(AtomicWriteOutcome::DestinationExists) => {
                self.verify(&hash)?;
            }
            Err(_) => {
                let _ = fs::remove_file(&pending_marker);
                return Err(CoreError::io());
            }
        }

        Ok(StoredBlob {
            hash,
            size: bytes.len() as u64,
            relative_path,
            pending_marker: Some(pending_marker),
        })
    }

    pub(crate) fn commit(&self, blob: &StoredBlob) {
        if let Some(marker) = &blob.pending_marker {
            let _ = fs::remove_file(marker);
        }
    }

    pub(crate) fn read(&self, hash: &str) -> CoreResult<Vec<u8>> {
        let path = self.path_for_hash(hash)?;
        let size = path.metadata().map_err(|_| CoreError::io())?.len();
        ensure_size(size, self.max_blob_bytes)?;
        let bytes = fs::read(path).map_err(|_| CoreError::io())?;
        let actual = blake3::hash(&bytes).to_hex().to_string();
        if actual != hash {
            return Err(CoreError::integrity(
                "O conteúdo persistido não corresponde ao hash do artifact.",
            ));
        }
        Ok(bytes)
    }

    fn verify(&self, hash: &str) -> CoreResult<()> {
        self.read(hash).map(|_| ())
    }

    fn path_for_hash(&self, hash: &str) -> CoreResult<PathBuf> {
        if hash.len() != 64 || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "O hash BLAKE3 informado é inválido.",
            ));
        }
        let prefix = self.root.join(&hash[..2]);
        match fs::symlink_metadata(&prefix) {
            Ok(metadata) if is_link_or_reparse(&metadata) || !metadata.is_dir() => {
                return Err(CoreError::integrity(
                    "O diretório de blobs contém um prefixo inseguro.",
                ));
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(CoreError::io()),
        }
        Ok(prefix.join(hash))
    }
}

fn hash_file(path: &Path, max_bytes: u64) -> CoreResult<(String, u64)> {
    let file = File::open(path).map_err(|_| CoreError::io())?;
    let mut reader = BufReader::new(file);
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut size = 0_u64;
    loop {
        let read = reader.read(&mut buffer).map_err(|_| CoreError::io())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
        size += read as u64;
        ensure_size(size, max_bytes)?;
    }
    Ok((hasher.finalize().to_hex().to_string(), size))
}

fn copy_and_verify(
    source: &Path,
    output: &mut File,
    expected_hash: &str,
    expected_size: u64,
    max_bytes: u64,
) -> std::io::Result<()> {
    let mut input = File::open(source)?;
    let mut hasher = blake3::Hasher::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut size = 0_u64;
    loop {
        let read = input.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        size += read as u64;
        if size > max_bytes {
            return Err(std::io::Error::other("arquivo excede o limite configurado"));
        }
        hasher.update(&buffer[..read]);
        output.write_all(&buffer[..read])?;
    }
    let actual_hash = hasher.finalize().to_hex().to_string();
    if size != expected_size || actual_hash != expected_hash {
        return Err(std::io::Error::other("arquivo mudou durante a importação"));
    }
    Ok(())
}

fn relative_path(hash: &str) -> String {
    format!("blobs/{}/{}", &hash[..2], hash)
}

fn ensure_size(size: u64, max_bytes: u64) -> CoreResult<()> {
    if size > max_bytes {
        return Err(CoreError::new(
            ErrorCode::ResourceLimit,
            format!(
                "O arquivo excede o limite configurado de {} MiB.",
                max_bytes / (1024 * 1024)
            ),
        ));
    }
    Ok(())
}

fn create_pending_marker(parent: &Path, hash: &str) -> CoreResult<PathBuf> {
    fs::create_dir_all(parent).map_err(|_| CoreError::io())?;
    let metadata = fs::symlink_metadata(parent).map_err(|_| CoreError::io())?;
    if is_link_or_reparse(&metadata) || !metadata.is_dir() {
        return Err(CoreError::integrity(
            "O diretório de blobs contém um prefixo inseguro.",
        ));
    }
    let path = parent.join(format!(".{hash}.{}.pending", Uuid::new_v4()));
    let marker = File::options()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|_| CoreError::io())?;
    marker.sync_all().map_err(|_| CoreError::io())?;
    Ok(path)
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
