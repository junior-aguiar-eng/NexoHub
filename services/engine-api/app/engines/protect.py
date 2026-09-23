import subprocess
from pathlib import Path


def protect_pdf(input_path: Path, user_password: str, owner_password: str, output_path: Path) -> Path:
    """Criptografa e protege PDF com senha AES-256 usando qpdf."""
    cmd = [
        "qpdf",
        "--encrypt",
        user_password,
        owner_password or user_password,
        "256",
        "--",
        str(input_path),
        str(output_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode not in (0, 3):
        raise RuntimeError(f"Falha ao proteger PDF com qpdf: {result.stderr}")

    return output_path
