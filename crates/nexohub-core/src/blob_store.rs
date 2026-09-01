//! Armazenamento de blobs endereçados por conteúdo BLAKE3.

use crate::error::{CoreError, CoreResult, ErrorCode};
use std::fs::{self, File, OpenOptions};
use std::io::{BufReader, Read, Write};
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct StoredBlob {
    pub hash: String,
    pub size: u64,
    pub relative_path: String,
}

pub(crate) struct BlobStore {
    root: PathBuf,
}

impl BlobStore {
    pub(crate) fn new(project_root: &Path) -> Self {
        Self {
            root: project_root.join("blobs"),
        }
    }

    pub(crate) fn put_file(&self, source: &Path) -> CoreResult<StoredBlob> {
        if !source.is_file() {
            return Err(CoreError::new(
                ErrorCode::InvalidArgument,
                "O arquivo de origem não existe ou não é um arquivo regular.",
            ));
        }

        let (hash, size) = hash_file(source)?;
        let final_path = self.path_for_hash(&hash)?;
        let relative_path = relative_path(&hash);

        if final_path.exists() {
            self.verify(&hash)?;
            return Ok(StoredBlob {
                hash,
                size,
                relative_path,
            });
        }

        let parent = final_path.parent().ok_or_else(CoreError::io)?;
        fs::create_dir_all(parent).map_err(|_| CoreError::io())?;
        let temporary = parent.join(format!(".{hash}.{}.tmp", Uuid::new_v4()));
        copy_exclusive(source, &temporary)?;

        let (temporary_hash, temporary_size) = hash_file(&temporary)?;
        if temporary_hash != hash || temporary_size != size {
            let _ = fs::remove_file(&temporary);
            return Err(CoreError::integrity(
                "O arquivo de origem mudou durante a importação.",
            ));
        }

        match fs::rename(&temporary, &final_path) {
            Ok(()) => {}
            Err(_) if final_path.exists() => {
                let _ = fs::remove_file(&temporary);
                self.verify(&hash)?;
            }
            Err(_) => {
                let _ = fs::remove_file(&temporary);
                return Err(CoreError::io());
            }
        }

        Ok(StoredBlob {
            hash,
            size,
            relative_path,
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
            });
        }

        let parent = final_path.parent().ok_or_else(CoreError::io)?;
        fs::create_dir_all(parent).map_err(|_| CoreError::io())?;
        let temporary = parent.join(format!(".{hash}.{}.tmp", Uuid::new_v4()));
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|_| CoreError::io())?;
        output.write_all(bytes).map_err(|_| CoreError::io())?;
        output.sync_all().map_err(|_| CoreError::io())?;

        match fs::rename(&temporary, &final_path) {
            Ok(()) => {}
            Err(_) if final_path.exists() => {
                let _ = fs::remove_file(&temporary);
                self.verify(&hash)?;
            }
            Err(_) => {
                let _ = fs::remove_file(&temporary);
                return Err(CoreError::io());
            }
        }

        Ok(StoredBlob {
            hash,
            size: bytes.len() as u64,
            relative_path,
        })
    }

    pub(crate) fn read(&self, hash: &str) -> CoreResult<Vec<u8>> {
        let path = self.path_for_hash(hash)?;
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
        Ok(self.root.join(&hash[..2]).join(hash))
    }
}

fn hash_file(path: &Path) -> CoreResult<(String, u64)> {
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
    }
    Ok((hasher.finalize().to_hex().to_string(), size))
}

fn copy_exclusive(source: &Path, destination: &Path) -> CoreResult<()> {
    let mut input = File::open(source).map_err(|_| CoreError::io())?;
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(|_| CoreError::io())?;
    std::io::copy(&mut input, &mut output).map_err(|_| CoreError::io())?;
    output.sync_all().map_err(|_| CoreError::io())?;
    Ok(())
}

fn relative_path(hash: &str) -> String {
    format!("blobs/{}/{}", &hash[..2], hash)
}
