import subprocess
from pathlib import Path
from typing import List

def generate_pdf_thumbnails(input_path: Path, output_dir: Path, dpi: int = 120, max_pages: int = 50) -> List[Path]:
    """
    Renderiza páginas reais do PDF como imagens PNG usando pdftoppm (poppler-utils).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    prefix = output_dir / "page"

    cmd = [
        "pdftoppm",
        "-png",
        "-r", str(dpi),
        "-f", "1",
        "-l", str(max_pages),
        str(input_path),
        str(prefix)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Falha ao gerar miniaturas com pdftoppm: {result.stderr}")

    thumbnails = sorted(list(output_dir.glob("page-*.png")), key=lambda p: p.name)
    return thumbnails
