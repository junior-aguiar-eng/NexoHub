"""Protocolo JSON Lines estrito do sidecar documental."""

from __future__ import annotations

import base64
import binascii
import json
import sys
from typing import Any, TextIO

from .docx import DOCX_MIME_TYPE, DocxInputError, create_docx, inspect_docx
from .docx import MAX_INPUT_BYTES as DOCX_MAX_INPUT_BYTES
from .limits import env_limit
from .ocr import MAX_INPUT_BYTES as OCR_MAX_INPUT_BYTES
from .ocr import OcrInputError, recognize_document
from .translation import TranslationInputError, TranslationUnavailableError, translate_text

MAX_REQUEST_LINE_CHARACTERS = env_limit(
    "NEXOHUB_SIDECAR_MAX_REQUEST_CHARACTERS",
    96 * 1024 * 1024,
    minimum=1024,
    maximum=128 * 1024 * 1024,
)
MAX_RESPONSE_CHARACTERS = env_limit(
    "NEXOHUB_SIDECAR_MAX_RESPONSE_CHARACTERS",
    96 * 1024 * 1024,
    minimum=1024,
    maximum=128 * 1024 * 1024,
)


def handle_request(request: object) -> dict[str, Any]:
    if not isinstance(request, dict):
        return _error(None, "INVALID_REQUEST", "A requisição deve ser um objeto JSON.")
    request_id = request.get("id")
    method = request.get("method")
    if not isinstance(method, str) or not isinstance(request.get("params"), dict):
        return _error(request_id, "INVALID_REQUEST", "Método ou parâmetros inválidos.")

    params = request["params"]
    if method == "translate":
        try:
            result = translate_text(
                params.get("text"),
                params.get("sourceLanguage"),
                params.get("targetLanguage"),
                params.get("modelId"),
            )
        except TranslationInputError as error:
            return _error(request_id, "INVALID_INPUT", str(error))
        except TranslationUnavailableError as error:
            return _error(request_id, "TRANSLATION_UNAVAILABLE", str(error))
        except Exception:
            return _error(
                request_id, "TRANSLATION_FAILED", "O engine local não conseguiu traduzir o texto."
            )
        return {"id": request_id, "result": result.to_dict()}

    if method == "docx.create":
        try:
            content = create_docx(params)
        except DocxInputError as error:
            return _error(request_id, "INVALID_INPUT", str(error))
        except Exception:
            return _error(request_id, "DOCX_FAILED", "O engine local não conseguiu criar o DOCX.")
        return {
            "id": request_id,
            "result": {
                "contentBase64": base64.b64encode(content).decode("ascii"),
                "mimeType": DOCX_MIME_TYPE,
                "sizeBytes": len(content),
            },
        }

    if method == "docx.inspect":
        encoded = params.get("contentBase64")
        if not isinstance(encoded, str):
            return _error(request_id, "INVALID_REQUEST", "contentBase64 é obrigatório.")
        try:
            content = _decode_base64_bounded(encoded, DOCX_MAX_INPUT_BYTES)
            result = inspect_docx(content)
        except (binascii.Error, DocxInputError) as error:
            return _error(request_id, "INVALID_INPUT", str(error))
        except Exception:
            return _error(request_id, "DOCX_FAILED", "O engine local não conseguiu ler o DOCX.")
        return {"id": request_id, "result": result.to_dict()}

    if method != "ocr":
        return _error(request_id, "INVALID_REQUEST", "Método não suportado.")

    mime_type = params.get("mimeType")
    encoded = params.get("contentBase64")
    if not isinstance(mime_type, str) or not isinstance(encoded, str):
        return _error(request_id, "INVALID_REQUEST", "mimeType e contentBase64 são obrigatórios.")
    try:
        content = _decode_base64_bounded(encoded, OCR_MAX_INPUT_BYTES)
        result = recognize_document(content, mime_type)
    except (binascii.Error, OcrInputError) as error:
        return _error(request_id, "INVALID_INPUT", str(error))
    except Exception:
        return _error(request_id, "OCR_FAILED", "O engine local não conseguiu processar o arquivo.")
    return {"id": request_id, "result": result.to_dict()}


def serve(input_stream: TextIO = sys.stdin, output_stream: TextIO = sys.stdout) -> None:
    while line := input_stream.readline(MAX_REQUEST_LINE_CHARACTERS + 1):
        if len(line) > MAX_REQUEST_LINE_CHARACTERS:
            _discard_line_remainder(input_stream, line)
            response = _error(
                None, "REQUEST_TOO_LARGE", "A requisição excede o limite configurado."
            )
            _write_response(output_stream, response)
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            response = _error(None, "INVALID_REQUEST", "A linha recebida não contém JSON válido.")
        else:
            response = handle_request(request)
        _write_response(output_stream, response)


def _error(request_id: object, code: str, message: str) -> dict[str, Any]:
    return {"id": request_id, "error": {"code": code, "message": message}}


def _validate_base64_size(encoded: str, max_decoded_bytes: int) -> None:
    max_encoded_characters = ((max_decoded_bytes + 2) // 3) * 4
    if len(encoded) > max_encoded_characters:
        raise binascii.Error("O conteúdo Base64 excede o limite configurado.")


def _decode_base64_bounded(encoded: str, max_decoded_bytes: int) -> bytes:
    _validate_base64_size(encoded, max_decoded_bytes)
    content = base64.b64decode(encoded, validate=True)
    if len(content) > max_decoded_bytes:
        raise binascii.Error("O conteúdo Base64 excede o limite configurado.")
    return content


def _discard_line_remainder(input_stream: TextIO, first_chunk: str) -> None:
    if first_chunk.endswith("\n"):
        return
    while chunk := input_stream.readline(MAX_REQUEST_LINE_CHARACTERS + 1):
        if chunk.endswith("\n"):
            return


def _write_response(output_stream: TextIO, response: dict[str, Any]) -> None:
    serialized = json.dumps(response, ensure_ascii=False, separators=(",", ":"))
    if len(serialized) > MAX_RESPONSE_CHARACTERS:
        serialized = json.dumps(
            _error(
                response.get("id"), "RESPONSE_TOO_LARGE", "A resposta excede o limite configurado."
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        )
    output_stream.write(serialized + "\n")
    output_stream.flush()
