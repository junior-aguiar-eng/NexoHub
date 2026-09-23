import subprocess
from pathlib import Path


def merge_pdfs(input_paths: list[Path], output_path: Path) -> Path:
    """Mescla múltiplos PDFs em um único arquivo usando qpdf."""
    if not input_paths:
        raise ValueError("Nenhum arquivo fornecido para mesclagem.")

    cmd = ["qpdf", "--empty", "--pages"]
    for path in input_paths:
        cmd.append(str(path))
    cmd.extend(["--", str(output_path)])

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode not in (0, 3):  # 3 = aviso de formato não-fatal no qpdf
        raise RuntimeError(f"Falha ao mesclar PDFs com qpdf: {result.stderr}")

    return output_path
