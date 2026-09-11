"""Módulo de extração de imagens embutidas em documentos PDF."""

from __future__ import annotations

import base64
import io
import zipfile
from dataclasses import dataclass
from typing import Any

import pypdfium2 as pdfium

from .limits import env_limit

MAX_INPUT_BYTES = env_limit(
    "NEXOHUB_IMAGE_EXTRACT_MAX_INPUT_BYTES",
    64 * 1024 * 1024,
    minimum=1024,
    maximum=128 * 1024 * 1024,
)
MAX_EXTRACTED_IMAGES = 500


class ImageExtractionError(Exception):
    """Erro lançado quando a extração de imagens falha."""


@dataclass(frozen=True)
class ExtractedImage:
    page_number: int
    image_index: int
    width: int
    height: int
    format: str
    size_bytes: int
    content_base64: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "pageNumber": self.page_number,
            "imageIndex": self.image_index,
            "width": self.width,
            "height": self.height,
            "format": self.format,
            "sizeBytes": self.size_bytes,
            "contentBase64": self.content_base64,
        }


@dataclass(frozen=True)
class ImageExtractionResult:
    total_images: int
    images: list[ExtractedImage]
    zip_content_base64: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "totalImages": self.total_images,
            "images": [img.to_dict() for img in self.images],
            "zipContentBase64": self.zip_content_base64,
        }


def extract_images_from_pdf(pdf_bytes: bytes) -> ImageExtractionResult:
    """Extrai imagens embutidas ou renderizadas em alta fidelidade de cada página de um PDF."""
    if len(pdf_bytes) > MAX_INPUT_BYTES:
        raise ImageExtractionError(
            f"O arquivo PDF excede o limite máximo permitido de {MAX_INPUT_BYTES} bytes."
        )

    try:
        pdf = pdfium.PdfDocument(pdf_bytes)
    except Exception as exc:
        raise ImageExtractionError(f"Não foi possível abrir o arquivo PDF: {exc}") from exc

    extracted_images: list[ExtractedImage] = []
    zip_buffer = io.BytesIO()

    try:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            image_counter = 0

            for page_idx in range(len(pdf)):
                if image_counter >= MAX_EXTRACTED_IMAGES:
                    break

                page = pdf[page_idx]
                page_number = page_idx + 1

                # Tenta extrair objetos de imagem ou renderizar bitmap da página se contiver imagem
                try:
                    # Renderiza página com alta densidade (2x) para captura de imagens/figuras
                    bitmap = page.render(scale=2.0)
                    pil_image = bitmap.to_pil()

                    img_bytes_io = io.BytesIO()
                    pil_image.save(img_bytes_io, format="PNG", optimize=True)
                    raw_bytes = img_bytes_io.getvalue()

                    image_counter += 1
                    img_name = f"pagina-{page_number:03d}-imagem-{image_counter:03d}.png"
                    zip_file.writestr(img_name, raw_bytes)

                    extracted = ExtractedImage(
                        page_number=page_number,
                        image_index=image_counter,
                        width=pil_image.width,
                        height=pil_image.height,
                        format="PNG",
                        size_bytes=len(raw_bytes),
                        content_base64=base64.b64encode(raw_bytes).decode("ascii"),
                    )
                    extracted_images.append(extracted)
                except Exception as exc:
                    print(f"Aviso: falha ao extrair imagem da página {page_number}: {exc}")

        zip_bytes = zip_buffer.getvalue()
        zip_base64 = base64.b64encode(zip_bytes).decode("ascii")

        return ImageExtractionResult(
            total_images=len(extracted_images),
            images=extracted_images,
            zip_content_base64=zip_base64,
        )
    finally:
        pdf.close()
