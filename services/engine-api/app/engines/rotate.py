import subprocess
from pathlib import Path

def rotate_pdf(input_path: Path, angle: int, page_spec: str, output_path: Path) -> Path:
    """Rotaciona páginas de um PDF usando qpdf (ex: angle=+90, page_spec='1-z')."""
    rotation_arg = f"{'+' if angle > 0 else ''}{angle}:{page_spec}"
    cmd = ["qpdf", str(input_path), f"--rotate={rotation_arg}", str(output_path)]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode not in (0, 3):
        raise RuntimeError(f"Falha ao rotacionar PDF com qpdf: {result.stderr}")
    return output_path
