import subprocess
from pathlib import Path

def compress_pdf(input_path: Path, output_path: Path, preset: str = "ebook") -> tuple[Path, int, int]:
    """
    Comprime PDF com Ghostscript aplicando downsampling real de imagens e otimização de streams.
    Presets:
      - 'screen': 72 dpi (compressão máxima / menor tamanho)
      - 'ebook': 150 dpi (equilíbrio ideal para web)
      - 'printer': 300 dpi (alta qualidade para impressão)
    """
    gs_preset = f"/{preset.lower()}" if preset.lower() in ("screen", "ebook", "printer", "prepress", "default") else "/ebook"

    cmd = [
        "gs",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={gs_preset}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        f"-sOutputFile={str(output_path)}",
        str(input_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"Falha ao comprimir PDF com Ghostscript: {result.stderr}")

    orig_size = input_path.stat().st_size
    comp_size = output_path.stat().st_size
    saved_bytes = max(0, orig_size - comp_size)

    return output_path, orig_size, comp_size
