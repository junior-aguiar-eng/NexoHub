"""Protocolo JSON Lines estrito do sidecar documental."""

from __future__ import annotations

import base64
import binascii
import json
import sys
from typing import Any, TextIO

from .docx import DOCX_MIME_TYPE, DocxInputError, create_docx, inspect_docx
from .ocr import OcrInputError, recognize_document
from .translation import TranslationInputError, TranslationUnavailableError, translate_text


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
            content = base64.b64decode(encoded, validate=True)
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
        content = base64.b64decode(encoded, validate=True)
        result = recognize_document(content, mime_type)
    except (binascii.Error, OcrInputError) as error:
        return _error(request_id, "INVALID_INPUT", str(error))
    except Exception:
        return _error(request_id, "OCR_FAILED", "O engine local não conseguiu processar o arquivo.")
    return {"id": request_id, "result": result.to_dict()}


def serve(input_stream: TextIO = sys.stdin, output_stream: TextIO = sys.stdout) -> None:
    for line in input_stream:
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            response = _error(None, "INVALID_REQUEST", "A linha recebida não contém JSON válido.")
        else:
            response = handle_request(request)
        output_stream.write(json.dumps(response, ensure_ascii=False, separators=(",", ":")) + "\n")
        output_stream.flush()


def _error(request_id: object, code: str, message: str) -> dict[str, Any]:
    return {"id": request_id, "error": {"code": code, "message": message}}
