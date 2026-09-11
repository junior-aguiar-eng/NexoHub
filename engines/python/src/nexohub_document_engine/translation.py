"""Tradução local com modelos CTranslate2 instalados explicitamente."""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import ctranslate2
import sentencepiece as spm

MAX_TEXT_LENGTH = 1_000_000
MAX_SEGMENT_LENGTH = 4_000
MAX_SEGMENTS = 10_000
MAX_DECODING_TOKENS = 1_024
MODEL_END_TOKEN = "</s>"
LANGUAGE_PATTERN = re.compile(r"^[a-z]{2,3}(?:-[A-Z]{2})?$")
MODEL_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")
PLACEHOLDER_PATTERN = re.compile(
    r"https?://\S+|\{\{[^{}]+\}\}|\{[^{}]+\}|%\([^)]+\)[a-zA-Z]|%[a-zA-Z]"
)
SENTINEL_PATTERN = re.compile(r"NEXOHUBPLACEHOLDER(\d+)TOKEN")


class TranslationInputError(ValueError):
    """Entrada de tradução inválida."""


class TranslationUnavailableError(RuntimeError):
    """Modelo local não instalado ou incompatível."""


class TranslationBackend(Protocol):
    def translate(self, texts: list[str]) -> list[str]: ...


class TranslationCodec(Protocol):
    def encode(self, text: str) -> list[str]: ...

    def decode(self, tokens: list[str]) -> str: ...


@dataclass(frozen=True, slots=True)
class TranslationResult:
    text: str
    source_language: str
    target_language: str
    model_id: str
    segments: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "sourceLanguage": self.source_language,
            "targetLanguage": self.target_language,
            "modelId": self.model_id,
            "segments": self.segments,
        }


def translate_text(
    text: object,
    source_language: object,
    target_language: object,
    model_id: object,
    *,
    backend: TranslationBackend | None = None,
    models_root: Path | None = None,
) -> TranslationResult:
    normalized_text = _validate_text(text)
    source = _validate_language(source_language, "sourceLanguage")
    target = _validate_language(target_language, "targetLanguage")
    model = _validate_model_id(model_id)
    if source == target:
        raise TranslationInputError("Os idiomas de origem e destino devem ser diferentes.")

    segments = _segment_text(normalized_text)
    masked_segments: list[str] = []
    placeholders_by_segment: list[tuple[str, ...]] = []
    for segment in segments:
        masked, placeholders = _mask_placeholders(segment)
        masked_segments.append(masked)
        placeholders_by_segment.append(placeholders)

    active_backend = backend or CTranslate2Backend.load(
        model, source, target, models_root=models_root
    )
    translated = active_backend.translate(masked_segments)
    if len(translated) != len(segments):
        raise TranslationUnavailableError("O modelo retornou quantidade inesperada de segmentos.")
    restored = [
        _restore_placeholders(value, placeholders)
        for value, placeholders in zip(translated, placeholders_by_segment, strict=True)
    ]
    return TranslationResult(
        text="".join(restored),
        source_language=source,
        target_language=target,
        model_id=model,
        segments=len(segments),
    )


class CTranslate2Backend:
    def __init__(
        self,
        translator: ctranslate2.Translator,
        codec: TranslationCodec,
    ) -> None:
        self._translator = translator
        self._codec = codec

    @classmethod
    def load(
        cls,
        model_id: str,
        source_language: str,
        target_language: str,
        *,
        models_root: Path | None,
    ) -> CTranslate2Backend:
        root = models_root or _configured_models_root()
        model_path = (root / model_id).resolve()
        try:
            model_path.relative_to(root.resolve())
        except ValueError as error:
            raise TranslationUnavailableError(
                "Identificador de modelo fora do diretório permitido."
            ) from error
        manifest_path = model_path / "nexohub-model.json"
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise TranslationUnavailableError(
                "Modelo local não instalado ou manifesto inválido."
            ) from error
        if not isinstance(manifest, dict):
            raise TranslationUnavailableError("Manifesto do modelo local deve ser um objeto.")
        _validate_model_profile(manifest)
        if not _supports_language(manifest.get("sourceLanguages"), source_language) or not (
            _supports_language(manifest.get("targetLanguages"), target_language)
        ):
            raise TranslationUnavailableError(
                "O modelo instalado não atende ao par de idiomas solicitado."
            )
        license_name = manifest.get("license")
        if not isinstance(license_name, str) or not license_name.strip():
            raise TranslationUnavailableError("O manifesto do modelo deve declarar sua licença.")
        _verify_model_hash(model_path, manifest)
        codec = _load_codec(model_path, manifest.get("tokenizer"), target_language)
        if not ctranslate2.contains_model(str(model_path)):
            raise TranslationUnavailableError("Diretório não contém um modelo CTranslate2 válido.")
        try:
            translator = ctranslate2.Translator(str(model_path), device="cpu", compute_type="auto")
            return cls(translator, codec)
        except (RuntimeError, OSError) as error:
            raise TranslationUnavailableError(
                "Não foi possível carregar o modelo local."
            ) from error

    def translate(self, texts: list[str]) -> list[str]:
        non_empty_indices = [i for i, t in enumerate(texts) if t.strip()]
        if not non_empty_indices:
            return texts

        tokenized = [self._codec.encode(texts[i]) for i in non_empty_indices]
        try:
            results = self._translator.translate_batch(
                tokenized,
                beam_size=4,
                end_token=MODEL_END_TOKEN,
                return_end_token=True,
                max_input_length=0,
                max_decoding_length=MAX_DECODING_TOKENS,
            )
        except RuntimeError as error:
            raise TranslationUnavailableError(
                "O modelo local falhou durante a inferência."
            ) from error

        translated_parts: list[str] = []
        for result in results:
            hypothesis = result.hypotheses[0]
            if not hypothesis or hypothesis[-1] != MODEL_END_TOKEN:
                raise TranslationUnavailableError(
                    "A tradução atingiu o limite de geração antes de concluir o segmento."
                )
            translated_parts.append(self._codec.decode(hypothesis))

        output = list(texts)
        for idx, trans in zip(non_empty_indices, translated_parts, strict=False):
            orig = texts[idx]
            suffix = "\r\n" if orig.endswith("\r\n") else ("\n" if orig.endswith("\n") else "")
            output[idx] = trans.strip() + suffix

        return output


class SentencePieceCodec:
    def __init__(
        self,
        source: spm.SentencePieceProcessor,
        target: spm.SentencePieceProcessor,
        *,
        target_prefix: str,
        append_eos: bool,
    ) -> None:
        self._source = source
        self._target = target
        self._target_prefix = target_prefix
        self._append_eos = append_eos

    def encode(self, text: str) -> list[str]:
        input_text = f"{self._target_prefix} {text}" if self._target_prefix else text
        tokens = list(self._source.encode(input_text, out_type=str))
        if self._append_eos:
            tokens.append("</s>")
        return tokens

    def decode(self, tokens: list[str]) -> str:
        return self._target.decode(
            [token for token in tokens if token not in {"<s>", "</s>", "<pad>"}]
        )


def _configured_models_root() -> Path:
    configured = os.environ.get("NEXOHUB_TRANSLATION_MODELS_DIR")
    if not configured:
        raise TranslationUnavailableError("Diretório de modelos de tradução não configurado.")
    return Path(configured).resolve()


def _manifest_file(model_path: Path, value: object) -> Path:
    if not isinstance(value, str) or not value:
        raise TranslationUnavailableError("Manifesto do modelo não declara os tokenizers.")
    candidate = (model_path / value).resolve()
    try:
        candidate.relative_to(model_path)
    except ValueError as error:
        raise TranslationUnavailableError(
            "Manifesto aponta para arquivo externo ao modelo."
        ) from error
    if not candidate.is_file():
        raise TranslationUnavailableError("Tokenizer declarado pelo modelo não foi encontrado.")
    return candidate


def _supports_language(value: object, language: str) -> bool:
    return (
        isinstance(value, list)
        and all(isinstance(item, str) for item in value)
        and ("*" in value or language in value)
    )


def _validate_model_profile(manifest: dict[str, Any]) -> None:
    if manifest.get("formatVersion") != 1:
        raise TranslationUnavailableError("Versão do manifesto de modelo não suportada.")
    family = manifest.get("family")
    quantization = manifest.get("quantization")
    if family == "madlad-400-3b-mt" and quantization == "int8":
        return
    if family == "opus-mt-tc-big" and quantization in {"int8", "float32"}:
        return
    raise TranslationUnavailableError("Família ou quantização do modelo não permitida.")


def _verify_model_hash(model_path: Path, manifest: dict[str, Any]) -> None:
    artifact = _manifest_file(model_path, manifest.get("artifact"))
    expected = manifest.get("sha256")
    if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise TranslationUnavailableError("O manifesto deve registrar um hash SHA-256 válido.")
    digest = hashlib.sha256()
    try:
        with artifact.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                digest.update(chunk)
    except OSError as error:
        raise TranslationUnavailableError(
            "Não foi possível verificar o arquivo do modelo."
        ) from error
    if digest.hexdigest() != expected:
        raise TranslationUnavailableError("O hash SHA-256 do modelo não corresponde ao manifesto.")


def _load_codec(model_path: Path, value: object, target_language: str) -> SentencePieceCodec:
    if not isinstance(value, dict):
        raise TranslationUnavailableError("O manifesto deve declarar a configuração do tokenizer.")
    tokenizer_type = value.get("type")
    prefixes = value.get("targetPrefixes", {})
    if not isinstance(prefixes, dict) or not all(
        isinstance(key, str) and isinstance(prefix, str) for key, prefix in prefixes.items()
    ):
        raise TranslationUnavailableError("targetPrefixes deve mapear idiomas para tokens.")
    target_prefix = prefixes.get(target_language, "")
    try:
        if tokenizer_type == "t5-shared":
            shared = spm.SentencePieceProcessor(
                model_file=str(_manifest_file(model_path, value.get("model")))
            )
            return SentencePieceCodec(
                shared,
                shared,
                target_prefix=target_prefix,
                append_eos=True,
            )
        if tokenizer_type == "sentencepiece-pair":
            append_eos = bool(value.get("appendEos", False))
            return SentencePieceCodec(
                spm.SentencePieceProcessor(
                    model_file=str(_manifest_file(model_path, value.get("sourceModel")))
                ),
                spm.SentencePieceProcessor(
                    model_file=str(_manifest_file(model_path, value.get("targetModel")))
                ),
                target_prefix=target_prefix,
                append_eos=append_eos,
            )
    except (OSError, RuntimeError) as error:
        raise TranslationUnavailableError("Não foi possível carregar o tokenizer local.") from error
    raise TranslationUnavailableError("Tipo de tokenizer não suportado pelo manifesto.")


def _validate_text(value: object) -> str:
    if not isinstance(value, str) or not value or len(value) > MAX_TEXT_LENGTH:
        raise TranslationInputError("text deve conter entre 1 e 1.000.000 de caracteres.")
    return value


def _validate_language(value: object, field: str) -> str:
    if not isinstance(value, str) or not LANGUAGE_PATTERN.fullmatch(value):
        raise TranslationInputError(f"{field} deve usar código BCP 47 simples, como pt-BR ou en.")
    return value


def _validate_model_id(value: object) -> str:
    if not isinstance(value, str) or not MODEL_ID_PATTERN.fullmatch(value):
        raise TranslationInputError("modelId contém caracteres inválidos.")
    return value


def _segment_text(text: str) -> list[str]:
    segments: list[str] = []
    for block in re.findall(r".*?(?:\r\n|\n|\r|$)", text):
        if not block:
            continue
        for start in range(0, len(block), MAX_SEGMENT_LENGTH):
            segments.append(block[start : start + MAX_SEGMENT_LENGTH])
            if len(segments) > MAX_SEGMENTS:
                raise TranslationInputError("O texto excede o limite de 10.000 segmentos.")
    return segments


def _mask_placeholders(text: str) -> tuple[str, tuple[str, ...]]:
    placeholders: list[str] = []

    def replace(match: re.Match[str]) -> str:
        placeholders.append(match.group(0))
        return f"NEXOHUBPLACEHOLDER{len(placeholders) - 1}TOKEN"

    return PLACEHOLDER_PATTERN.sub(replace, text), tuple(placeholders)


def _restore_placeholders(text: str, placeholders: tuple[str, ...]) -> str:
    seen: set[int] = set()

    def replace(match: re.Match[str]) -> str:
        index = int(match.group(1))
        if index >= len(placeholders) or index in seen:
            raise TranslationUnavailableError("O modelo alterou os placeholders protegidos.")
        seen.add(index)
        return placeholders[index]

    restored = SENTINEL_PATTERN.sub(replace, text)
    if seen != set(range(len(placeholders))):
        raise TranslationUnavailableError("O modelo removeu placeholders protegidos.")
    return restored


def list_installed_models(models_root: Path | None = None) -> list[dict[str, Any]]:
    """Lista modelos de tradução instalados na raiz configurada com manifesto válido."""
    try:
        root = models_root or _configured_models_root()
    except TranslationUnavailableError:
        return []

    if not root.is_dir():
        return []

    models: list[dict[str, Any]] = []
    for item in sorted(root.iterdir()):
        if not item.is_dir():
            continue
        manifest_path = item / "nexohub-model.json"
        if not manifest_path.is_file():
            continue
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            if not isinstance(manifest, dict):
                continue
            _validate_model_profile(manifest)
            license_name = manifest.get("license")
            if not isinstance(license_name, str) or not license_name.strip():
                continue

            source_langs = manifest.get("sourceLanguages", [])
            target_langs = manifest.get("targetLanguages", [])
            family = manifest.get("family", "")
            has_ctranslate = ctranslate2.contains_model(str(item))

            models.append(
                {
                    "modelId": item.name,
                    "name": manifest.get("name", item.name),
                    "family": family,
                    "sourceLanguages": source_langs if isinstance(source_langs, list) else [],
                    "targetLanguages": target_langs if isinstance(target_langs, list) else [],
                    "license": license_name,
                    "isReady": has_ctranslate,
                }
            )
        except Exception:
            continue
    return models

