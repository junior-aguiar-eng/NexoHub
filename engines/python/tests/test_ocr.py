import base64
import json
from io import BytesIO, StringIO
from types import SimpleNamespace

from PIL import Image, ImageDraw

from nexohub_document_engine.ocr import OcrInputError, OcrResult, recognize_document
from nexohub_document_engine.protocol import handle_request, serve


def image_bytes() -> bytes:
    image = Image.new("RGB", (200, 100), "white")
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_ocr_normalizes_detected_bounds() -> None:
    def engine(_image: Image.Image) -> SimpleNamespace:
        return SimpleNamespace(
            boxes=[[[20, 10], [120, 10], [120, 30], [20, 30]]],
            txts=["NexoHub"],
            scores=[0.9876543],
        )

    result = recognize_document(image_bytes(), "image/png", engine=engine)

    assert result.text == "NexoHub"
    assert result.pages == 1
    assert result.lines[0].bounds == (0.1, 0.1, 0.5, 0.2)
    assert result.lines[0].confidence == 0.987654


def test_ocr_rejects_unsupported_media_type() -> None:
    try:
        recognize_document(b"content", "text/plain", engine=lambda _: None)
    except OcrInputError as error:
        assert str(error) == "Tipo de arquivo não suportado pelo OCR."
    else:
        raise AssertionError("tipo incompatível deveria ser rejeitado")


def test_protocol_returns_one_json_response_per_line(monkeypatch) -> None:
    monkeypatch.setattr(
        "nexohub_document_engine.protocol.recognize_document",
        lambda _content, _mime: OcrResult(text="texto", pages=1, lines=()),
    )
    request = {
        "id": "job-1",
        "method": "ocr",
        "params": {
            "mimeType": "image/png",
            "contentBase64": base64.b64encode(image_bytes()).decode("ascii"),
        },
    }
    input_stream = StringIO(json.dumps(request) + "\nnot-json\n")
    output_stream = StringIO()

    serve(input_stream, output_stream)

    responses = [json.loads(line) for line in output_stream.getvalue().splitlines()]
    assert responses[0]["id"] == "job-1"
    assert responses[0]["result"]["text"] == "texto"
    assert responses[1]["error"]["code"] == "INVALID_REQUEST"


def test_protocol_rejects_invalid_base64() -> None:
    response = handle_request(
        {
            "id": "job-invalid",
            "method": "ocr",
            "params": {"mimeType": "image/png", "contentBase64": "***"},
        }
    )

    assert response["error"]["code"] == "INVALID_INPUT"


def test_protocol_rejects_decoded_content_above_limit(monkeypatch) -> None:
    monkeypatch.setattr("nexohub_document_engine.protocol.OCR_MAX_INPUT_BYTES", 1)

    response = handle_request(
        {
            "id": "job-large",
            "method": "ocr",
            "params": {
                "mimeType": "image/png",
                "contentBase64": base64.b64encode(b"xx").decode("ascii"),
            },
        }
    )

    assert response["error"]["code"] == "INVALID_INPUT"


def test_protocol_bounds_each_json_line(monkeypatch) -> None:
    monkeypatch.setattr("nexohub_document_engine.protocol.MAX_REQUEST_LINE_CHARACTERS", 16)
    output_stream = StringIO()

    serve(StringIO("x" * 32 + "\n"), output_stream)

    response = json.loads(output_stream.getvalue())
    assert response["error"]["code"] == "REQUEST_TOO_LARGE"


def test_ocr_rejects_image_dimensions_before_inference(monkeypatch) -> None:
    monkeypatch.setattr("nexohub_document_engine.ocr.MAX_PIXELS_PER_PAGE", 100)

    try:
        recognize_document(image_bytes(), "image/png", engine=lambda _: None)
    except OcrInputError as error:
        assert "limite configurado" in str(error)
    else:
        raise AssertionError("imagem superdimensionada deveria ser rejeitada")


def test_ocr_streams_and_closes_each_page(monkeypatch) -> None:
    class FakeImage:
        size = (10, 10)

        def __init__(self) -> None:
            self.closed = False

        def close(self) -> None:
            self.closed = True

    first = FakeImage()
    second = FakeImage()

    def pages(_content: bytes, _mime_type: str):
        yield first
        assert first.closed
        yield second

    monkeypatch.setattr("nexohub_document_engine.ocr._render_pages", pages)
    empty = SimpleNamespace(boxes=[], txts=[], scores=[])

    result = recognize_document(b"pdf", "application/pdf", engine=lambda _: empty)

    assert result.pages == 2
    assert first.closed and second.closed


def test_real_engine_recognizes_synthetic_local_image() -> None:
    image = Image.new("RGB", (500, 120), "white")
    ImageDraw.Draw(image).text((20, 35), "NEXOHUB OCR 123", fill="black", font_size=36)
    output = BytesIO()
    image.save(output, format="PNG")

    result = recognize_document(output.getvalue(), "image/png")

    assert "NEXOHUB OCR 123" in result.text
    assert result.lines[0].confidence > 0.9
