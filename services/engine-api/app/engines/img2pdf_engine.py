import img2pdf
from pathlib import Path
from typing import List

def images_to_pdf(image_paths: List[Path], output_path: Path) -> Path:
    """Converte lista de imagens (JPEG, PNG, etc.) em um único PDF sem perdas de qualidade."""
    if not image_paths:
        raise ValueError("Nenhuma imagem fornecida para conversão.")

    with open(output_path, "wb") as f_out:
        f_out.write(img2pdf.convert([str(p) for p in image_paths]))

    return output_path
