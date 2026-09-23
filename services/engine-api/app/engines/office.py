import subprocess
import shutil
from pathlib import Path

def convert_office_document(input_path: Path, target_format: str, output_dir: Path, task_id: str) -> Path:
    """
    Converte documentos Office (DOCX, XLSX, PPTX) para PDF ou PDF para DOCX usando LibreOffice Headless
    com isolamento estrito de perfil de usuário concorrente.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    profile_dir = Path(f"/tmp/libreoffice_profile_{task_id}")
    profile_dir.mkdir(parents=True, exist_ok=True)

    try:
        cmd = [
            "soffice",
            f"-env:UserInstallation=file://{profile_dir.as_posix()}",
            "--headless",
            "--convert-to", target_format,
            "--outdir", str(output_dir),
            str(input_path)
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            raise RuntimeError(f"Falha ao converter documento com LibreOffice: {result.stderr}")

        expected_file = output_dir / f"{input_path.stem}.{target_format}"
        if not expected_file.exists():
            # Tenta encontrar qualquer arquivo gerado na pasta de saída com a extensão
            candidates = list(output_dir.glob(f"*.{target_format}"))
            if candidates:
                return candidates[0]
            raise FileNotFoundError(f"Arquivo convertido não encontrado em {output_dir}")

        return expected_file
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)
