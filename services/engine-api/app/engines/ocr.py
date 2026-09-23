import subprocess
from pathlib import Path


def perform_pdf_ocr(input_path: Path, output_path: Path, language: str = "por+eng") -> Path:
    """
    Executa OCR em PDF usando ocrmypdf e Tesseract, gerando PDF pesquisável com camada de texto real.
    """
    cmd = [
        "ocrmypdf",
        "-l", language,
        "--skip-text",
        str(input_path),
        str(output_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Falha ao executar OCR com ocrmypdf: {result.stderr}")

    return output_path
