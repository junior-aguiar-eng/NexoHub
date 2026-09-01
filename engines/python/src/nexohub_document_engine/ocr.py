"""OCR local para imagens e páginas PDF, sem upload externo."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from io import BytesIO
from typing import TYPE_CHECKING, Any

import pypdfium2 as pdfium
from PIL import Image
from rapidocr import RapidOCR

if TYPE_CHECKING:
    from collections.abc import Iterable

MAX_INPUT_BYTES = 64 * 1024 * 1024
MAX_PAGES = 500
MAX_PIXELS_PER_PAGE = 50_000_000
SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/tiff", "image/webp"}


class OcrInputError(ValueError):
    """Entrada OCR rejeitada antes da inferência."""


@dataclass(frozen=True, slots=True)
class OcrLine:
    page_number: int
    text: str
    confidence: float
    bounds: tuple[float, float, float, float]


@dataclass(frozen=True, slots=True)
class OcrResult:
    text: str
    pages: int
    lines: tuple[OcrLine, ...]
    engine: str = "rapidocr"

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "pages": self.pages,
            "lines": [asdict(line) for line in self.lines],
            "engine": self.engine,
        }


def recognize_document(
    content: bytes,
    mime_type: str,
    *,
    engine: Any | None = None,
) -> OcrResult:
    if not content or len(content) > MAX_INPUT_BYTES:
        raise OcrInputError("O arquivo deve ter entre 1 byte e 64 MiB.")

    pages = tuple(_render_pages(content, mime_type))
    ocr_engine = engine or RapidOCR()
    lines: list[OcrLine] = []
    for page_number, image in enumerate(pages, start=1):
        width, height = image.size
        if width * height > MAX_PIXELS_PER_PAGE:
            raise OcrInputError("A página excede o limite de 50 megapixels.")
        output = ocr_engine(image)
        boxes = () if output.boxes is None else output.boxes
        texts = () if output.txts is None else output.txts
        scores = () if output.scores is None else output.scores
        for box, text, confidence in zip(boxes, texts, scores, strict=True):
            x_values = [float(point[0]) for point in box]
            y_values = [float(point[1]) for point in box]
            left, right = min(x_values) / width, max(x_values) / width
            top, bottom = min(y_values) / height, max(y_values) / height
            lines.append(
                OcrLine(
                    page_number=page_number,
                    text=str(text),
                    confidence=round(float(confidence), 6),
                    bounds=tuple(
                        round(value, 6) for value in (left, top, right - left, bottom - top)
                    ),
                )
            )

    return OcrResult(
        text="\n".join(line.text for line in lines),
        pages=len(pages),
        lines=tuple(lines),
    )


def _render_pages(content: bytes, mime_type: str) -> Iterable[Image.Image]:
    if mime_type in SUPPORTED_IMAGE_TYPES:
        with Image.open(BytesIO(content)) as source:
            source.load()
            yield source.convert("RGB")
        return
    if mime_type != "application/pdf":
        raise OcrInputError("Tipo de arquivo não suportado pelo OCR.")

    document = pdfium.PdfDocument(content)
    if len(document) == 0 or len(document) > MAX_PAGES:
        raise OcrInputError("O PDF deve conter entre 1 e 500 páginas.")
    for page in document:
        yield page.render(scale=2).to_pil().convert("RGB")
