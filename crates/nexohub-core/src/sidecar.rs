//! Supervisão comum de processos locais e temporários documentais sensíveis.

use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;

const POLL_INTERVAL: Duration = Duration::from_millis(20);
const STALE_WORKSPACE_AGE: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const WORKSPACE_PREFIX: &str = "nexohub-sidecar-";

#[derive(Debug)]
pub(crate) enum SidecarRunError {
    Io,
    Timeout,
    OutputLimit,
    Exit,
}

pub(crate) struct SensitiveTempDir {
    root: PathBuf,
}

impl SensitiveTempDir {
    pub(crate) fn create() -> io::Result<Self> {
        cleanup_stale_workspaces();
        let root = std::env::temp_dir().join(format!("{WORKSPACE_PREFIX}{}", Uuid::new_v4()));
        fs::create_dir(&root)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&root, fs::Permissions::from_mode(0o700))?;
        }
        Ok(Self { root })
    }

    pub(crate) fn write_private(&self, name: &str, bytes: &[u8]) -> io::Result<PathBuf> {
        let path = self.root.join(name);
        let mut file = File::options().write(true).create_new(true).open(&path)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        Ok(path)
    }

    pub(crate) fn path(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }
}

impl Drop for SensitiveTempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

pub(crate) fn run_command(
    command: &mut Command,
    output_path: &Path,
    timeout: Duration,
    max_output_bytes: u64,
) -> Result<Vec<u8>, SidecarRunError> {
    let output = File::options()
        .write(true)
        .create_new(true)
        .open(output_path)
        .map_err(|_| SidecarRunError::Io)?;
    command.stdout(Stdio::from(output)).stderr(Stdio::null());
    let mut child = command.spawn().map_err(|_| SidecarRunError::Io)?;
    let started = Instant::now();
    let status = loop {
        if output_size(output_path) > max_output_bytes {
            terminate(&mut child);
            return Err(SidecarRunError::OutputLimit);
        }
        match child.try_wait() {
            Err(_) => {
                terminate(&mut child);
                return Err(SidecarRunError::Io);
            }
            Ok(Some(status)) => break status,
            Ok(None) if started.elapsed() >= timeout => {
                terminate(&mut child);
                return Err(SidecarRunError::Timeout);
            }
            Ok(None) => thread::sleep(POLL_INTERVAL),
        }
    };
    if !status.success() {
        return Err(SidecarRunError::Exit);
    }

    let file = File::open(output_path).map_err(|_| SidecarRunError::Io)?;
    let mut bytes = Vec::new();
    file.take(max_output_bytes + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| SidecarRunError::Io)?;
    if bytes.len() as u64 > max_output_bytes {
        return Err(SidecarRunError::OutputLimit);
    }
    Ok(bytes)
}

fn output_size(path: &Path) -> u64 {
    path.metadata().map(|metadata| metadata.len()).unwrap_or(0)
}

fn terminate(child: &mut std::process::Child) {
    let _ = child.kill();
    let _ = child.wait();
}

fn cleanup_stale_workspaces() {
    let Ok(entries) = fs::read_dir(std::env::temp_dir()) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        if !name.starts_with(WORKSPACE_PREFIX) {
            continue;
        }
        let stale = entry
            .metadata()
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|modified| modified.elapsed().ok())
            .is_some_and(|age| age >= STALE_WORKSPACE_AGE);
        if stale {
            let _ = fs::remove_dir_all(entry.path());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_sidecar_crash_without_returning_output() {
        let workspace = SensitiveTempDir::create().expect("temp");
        let mut command = Command::new(std::env::current_exe().expect("test binary"));
        command.arg("--nexohub-invalid-test-option");

        let error = run_command(
            &mut command,
            &workspace.path("stdout.json"),
            Duration::from_secs(10),
            1024,
        )
        .expect_err("processo deve falhar");

        assert!(matches!(error, SidecarRunError::Exit));
    }

    #[test]
    fn limits_sidecar_output() {
        let workspace = SensitiveTempDir::create().expect("temp");
        let mut command = Command::new(std::env::current_exe().expect("test binary"));
        command.args(["--list", "--format", "terse"]);

        let error = run_command(
            &mut command,
            &workspace.path("stdout.txt"),
            Duration::from_secs(10),
            1,
        )
        .expect_err("saída deve exceder limite");

        assert!(matches!(error, SidecarRunError::OutputLimit));
    }
}
