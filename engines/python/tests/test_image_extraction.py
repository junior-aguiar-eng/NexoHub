import base64
import io
import zipfile

from PIL import Image

from nexohub_document_engine.image_extraction import (
    ImageExtractionError,
    extract_images_from_pdf,
)
from nexohub_document_engine.protocol import handle_request


def create_minimal_pdf_bytes() -> bytes:
    # Cria uma imagem simples e salva como PDF usando Pillow
    image = Image.new("RGB", (100, 100), color="blue")
    pdf_io = io.BytesIO()
    image.save(pdf_io, format="PDF")
    return pdf_io.getvalue()


def test_extract_images_from_valid_pdf() -> None:
    pdf_data = create_minimal_pdf_bytes()
    result = extract_images_from_pdf(pdf_data)

    assert result.total_images == 1
    assert len(result.images) == 1
    assert result.images[0].page_number == 1
    assert result.images[0].format == "PNG"
    assert result.images[0].width > 0
    assert result.images[0].height > 0
    assert result.images[0].size_bytes > 0
    assert bool(result.zip_content_base64)

    # Valida que o zip é válido
    zip_bytes = base64.b64decode(result.zip_content_base64)
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
        namelist = zf.namelist()
        assert len(namelist) == 1
        assert namelist[0] == "pagina-001-imagem-001.png"


def test_extract_images_rejects_invalid_pdf() -> None:
    try:
        extract_images_from_pdf(b"not-a-valid-pdf-stream")
    except ImageExtractionError:
        pass
    else:
        raise AssertionError("PDF inválido deveria lançar ImageExtractionError")


def test_protocol_handles_pdf_extract_images() -> None:
    pdf_data = create_minimal_pdf_bytes()
    request = {
        "id": "req-extract-1",
        "method": "pdf.extract_images",
        "params": {
            "contentBase64": base64.b64encode(pdf_data).decode("ascii"),
        },
    }
    response = handle_request(request)

    assert response["id"] == "req-extract-1"
    assert "result" in response
    assert response["result"]["totalImages"] == 1
    assert len(response["result"]["images"]) == 1
    assert bool(response["result"]["zipContentBase64"])
