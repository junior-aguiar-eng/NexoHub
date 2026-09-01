"""Protocolo JSON Lines estrito do sidecar documental."""

from __future__ import annotations

import base64
import binascii
import json
import sys
from typing import Any, TextIO

from .ocr import OcrInputError, recognize_document


def handle_request(request: object) -> dict[str, Any]:
    if not isinstance(request, dict):
        return _error(None, "INVALID_REQUEST", "A requisição deve ser um objeto JSON.")
    request_id = request.get("id")
    if request.get("method") != "ocr" or not isinstance(request.get("params"), dict):
        return _error(request_id, "INVALID_REQUEST", "Método ou parâmetros inválidos.")

    params = request["params"]
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
