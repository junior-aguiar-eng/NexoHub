"""OCR local para imagens e páginas PDF, sem upload externo."""

from __future__ import annotations

import warnings
from dataclasses import asdict, dataclass
from io import BytesIO
from math import ceil
from typing import TYPE_CHECKING, Any

import pypdfium2 as pdfium
from PIL import Image
from rapidocr import RapidOCR

from .limits import env_limit

if TYPE_CHECKING:
    from collections.abc import Iterable

MAX_INPUT_BYTES = env_limit(
    "NEXOHUB_OCR_MAX_INPUT_BYTES", 64 * 1024 * 1024, minimum=1024, maximum=256 * 1024 * 1024
)
MAX_PAGES = env_limit("NEXOHUB_OCR_MAX_PAGES", 500, minimum=1, maximum=2_000)
MAX_PIXELS_PER_PAGE = env_limit(
    "NEXOHUB_OCR_MAX_PIXELS_PER_PAGE", 50_000_000, minimum=1_000_000, maximum=100_000_000
)
MAX_TOTAL_PIXELS = env_limit(
    "NEXOHUB_OCR_MAX_TOTAL_PIXELS", 250_000_000, minimum=1_000_000, maximum=1_000_000_000
)
MAX_OUTPUT_LINES = env_limit(
    "NEXOHUB_OCR_MAX_OUTPUT_LINES", 100_000, minimum=1_000, maximum=1_000_000
)
MAX_OUTPUT_CHARACTERS = env_limit(
    "NEXOHUB_OCR_MAX_OUTPUT_CHARACTERS", 4_000_000, minimum=10_000, maximum=32_000_000
)
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

    ocr_engine = engine or RapidOCR()
    lines: list[OcrLine] = []
    page_count = 0
    total_pixels = 0
    total_characters = 0
    for page_number, image in enumerate(_render_pages(content, mime_type), start=1):
        page_count = page_number
        try:
            width, height = image.size
            pixels = width * height
            if pixels > MAX_PIXELS_PER_PAGE:
                raise OcrInputError(
                    f"A página excede o limite configurado de {MAX_PIXELS_PER_PAGE} pixels."
                )
            total_pixels += pixels
            if total_pixels > MAX_TOTAL_PIXELS:
                raise OcrInputError("O documento excede o orçamento total de pixels do OCR.")
            output = ocr_engine(image)
            boxes = () if output.boxes is None else output.boxes
            texts = () if output.txts is None else output.txts
            scores = () if output.scores is None else output.scores
            for box, text, confidence in zip(boxes, texts, scores, strict=True):
                normalized_text = str(text)
                total_characters += len(normalized_text)
                if len(lines) >= MAX_OUTPUT_LINES or total_characters > MAX_OUTPUT_CHARACTERS:
                    raise OcrInputError("O resultado do OCR excede o limite configurado.")
                x_values = [float(point[0]) for point in box]
                y_values = [float(point[1]) for point in box]
                left, right = min(x_values) / width, max(x_values) / width
                top, bottom = min(y_values) / height, max(y_values) / height
                lines.append(
                    OcrLine(
                        page_number=page_number,
                        text=normalized_text,
                        confidence=round(float(confidence), 6),
                        bounds=tuple(
                            round(value, 6) for value in (left, top, right - left, bottom - top)
                        ),
                    )
                )
        finally:
            image.close()

    return OcrResult(
        text="\n".join(line.text for line in lines),
        pages=page_count,
        lines=tuple(lines),
    )


def _render_pages(content: bytes, mime_type: str) -> Iterable[Image.Image]:
    if mime_type in SUPPORTED_IMAGE_TYPES:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            try:
                with Image.open(BytesIO(content)) as source:
                    width, height = source.size
                    if width * height > MAX_PIXELS_PER_PAGE:
                        raise OcrInputError(
                            f"A página excede o limite configurado de {MAX_PIXELS_PER_PAGE} pixels."
                        )
                    source.load()
                    yield source.convert("RGB")
            except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
                raise OcrInputError("A imagem excede o limite seguro de pixels.") from error
        return
    if mime_type != "application/pdf":
        raise OcrInputError("Tipo de arquivo não suportado pelo OCR.")

    document = pdfium.PdfDocument(content)
    if len(document) == 0 or len(document) > MAX_PAGES:
        raise OcrInputError("O PDF deve conter entre 1 e 500 páginas.")
    for page in document:
        width, height = page.get_size()
        rendered_pixels = ceil(width * 2) * ceil(height * 2)
        if rendered_pixels > MAX_PIXELS_PER_PAGE:
            raise OcrInputError(
                f"A página excede o limite configurado de {MAX_PIXELS_PER_PAGE} pixels."
            )
        yield page.render(scale=2).to_pil().convert("RGB")
