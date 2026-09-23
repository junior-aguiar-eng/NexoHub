import subprocess
from pathlib import Path

def split_pdf(input_path: Path, page_range: str, output_path: Path) -> Path:
    """Extrai um intervalo de páginas de um PDF usando qpdf (ex: '1-5' ou '1,3,5-7')."""
    cmd = ["qpdf", str(input_path), "--pages", str(input_path), page_range, "--", str(output_path)]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode not in (0, 3):
        raise RuntimeError(f"Falha ao dividir PDF com qpdf: {result.stderr}")
    return output_path
