from __future__ import annotations

from pathlib import Path

import pytest

from nexohub_document_engine.protocol import handle_request
from nexohub_document_engine.translation import (
    CTranslate2Backend,
    SentencePieceCodec,
    TranslationInputError,
    TranslationUnavailableError,
    _validate_model_profile,
    translate_text,
)


class MappingBackend:
    def translate(self, texts: list[str]) -> list[str]:
        return [
            text.replace("Olá", "Hello")
            .replace("mundo", "world")
            .replace("Segunda linha", "Second line")
            for text in texts
        ]


class FakeSentencePiece:
    def encode(self, text: str, *, out_type: type[str]) -> list[str]:
        assert out_type is str
        return text.split()

    def decode(self, tokens: list[str]) -> str:
        return " ".join(tokens)


class FakeTranslationResult:
    def __init__(self, tokens: list[str]) -> None:
        self.hypotheses = [tokens]


class EchoTranslator:
    def translate_batch(
        self, source: list[list[str]], **options: object
    ) -> list[FakeTranslationResult]:
        max_input_length = options.get("max_input_length", 1024)
        results = []
        for tokens in source:
            visible = tokens if max_input_length == 0 else tokens[: int(max_input_length)]
            results.append(FakeTranslationResult([*visible, "</s>"]))
        return results


class LimitedTranslator:
    def translate_batch(
        self, source: list[list[str]], **options: object
    ) -> list[FakeTranslationResult]:
        max_decoding_length = int(options.get("max_decoding_length", 256))
        return [FakeTranslationResult(["token"] * max_decoding_length) for _ in source]


def test_translates_segments_and_preserves_placeholders() -> None:
    result = translate_text(
        "Olá, {nome}. Veja https://nexohub.local/doc.\nSegunda linha.",
        "pt-BR",
        "en",
        "pt-en-test",
        backend=MappingBackend(),
    )

    assert result.text == "Hello, {nome}. Veja https://nexohub.local/doc.\nSecond line."
    assert result.segments == 2
    assert result.source_language == "pt-BR"
    assert result.target_language == "en"


def test_rejects_invalid_language_and_same_pair() -> None:
    with pytest.raises(TranslationInputError, match="BCP 47"):
        translate_text("Texto", "português", "en", "model", backend=MappingBackend())
    with pytest.raises(TranslationInputError, match="devem ser diferentes"):
        translate_text("Texto", "pt-BR", "pt-BR", "model", backend=MappingBackend())


def test_rejects_missing_model() -> None:
    with pytest.raises(TranslationUnavailableError, match="não instalado"):
        translate_text("Texto", "pt-BR", "en", "missing", models_root=Path(__file__).parent)


def test_protocol_reports_unavailable_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("NEXOHUB_TRANSLATION_MODELS_DIR", raising=False)
    response = handle_request(
        {
            "id": "translation-1",
            "method": "translate",
            "params": {
                "text": "Texto",
                "sourceLanguage": "pt-BR",
                "targetLanguage": "en",
                "modelId": "pt-en",
            },
        }
    )

    assert response["error"]["code"] == "TRANSLATION_UNAVAILABLE"


def test_rejects_backend_that_loses_placeholder() -> None:
    class BrokenBackend:
        def translate(self, texts: list[str]) -> list[str]:
            return ["Translated without sentinel" for _ in texts]

    with pytest.raises(TranslationUnavailableError, match="removeu placeholders"):
        translate_text("Olá, {nome}", "pt-BR", "en", "model", backend=BrokenBackend())


def test_t5_shared_codec_adds_target_prefix_and_eos() -> None:
    tokenizer = FakeSentencePiece()
    codec = SentencePieceCodec(
        tokenizer,  # type: ignore[arg-type]
        tokenizer,  # type: ignore[arg-type]
        target_prefix="<2pt>",
        append_eos=True,
    )

    assert codec.encode("Hello world") == ["<2pt>", "Hello", "world", "</s>"]
    assert codec.decode(["Olá", "mundo", "</s>"]) == "Olá mundo"


def test_opus_codec_uses_separate_tokenizers_without_eos() -> None:
    source = FakeSentencePiece()
    target = FakeSentencePiece()
    codec = SentencePieceCodec(
        source,  # type: ignore[arg-type]
        target,  # type: ignore[arg-type]
        target_prefix=">>por<<",
        append_eos=False,
    )

    assert codec.encode("Legal text") == [">>por<<", "Legal", "text"]


def test_backend_preserves_inputs_longer_than_default_token_limit() -> None:
    tokenizer = FakeSentencePiece()
    backend = CTranslate2Backend(
        EchoTranslator(),  # type: ignore[arg-type]
        SentencePieceCodec(
            tokenizer,  # type: ignore[arg-type]
            tokenizer,  # type: ignore[arg-type]
            target_prefix="",
            append_eos=False,
        ),
    )
    text = " ".join(f"termo-{index}" for index in range(1_100))

    assert backend.translate([text]) == [text]


def test_backend_rejects_translation_without_end_token() -> None:
    tokenizer = FakeSentencePiece()
    backend = CTranslate2Backend(
        LimitedTranslator(),  # type: ignore[arg-type]
        SentencePieceCodec(
            tokenizer,  # type: ignore[arg-type]
            tokenizer,  # type: ignore[arg-type]
            target_prefix="",
            append_eos=False,
        ),
    )

    with pytest.raises(TranslationUnavailableError, match="limite de geração"):
        backend.translate(["Texto longo"])


def test_accepts_only_selected_model_profiles() -> None:
    _validate_model_profile(
        {"formatVersion": 1, "family": "madlad-400-3b-mt", "quantization": "int8"}
    )
    _validate_model_profile(
        {"formatVersion": 1, "family": "opus-mt-tc-big", "quantization": "float32"}
    )
    with pytest.raises(TranslationUnavailableError, match="não permitida"):
        _validate_model_profile(
            {"formatVersion": 1, "family": "madlad-400-3b-mt", "quantization": "float32"}
        )


def test_list_installed_models_with_valid_and_invalid_models() -> None:
    import json
    import os
    import tempfile

    from nexohub_document_engine.protocol import handle_request
    from nexohub_document_engine.translation import list_installed_models

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        # Pasta vazia
        assert list_installed_models(temp_dir) == []

        # Cria modelo válido sintético
        model_dir = temp_dir / "opus-pt-en"
        model_dir.mkdir()
        manifest = {
            "formatVersion": 1,
            "name": "OPUS Português para Inglês",
            "family": "opus-mt-tc-big",
            "quantization": "float32",
            "sourceLanguages": ["pt-BR", "pt"],
            "targetLanguages": ["en"],
            "license": "CC-BY-4.0",
        }
        (model_dir / "nexohub-model.json").write_text(json.dumps(manifest), encoding="utf-8")

        models = list_installed_models(temp_dir)
        assert len(models) == 1
        assert models[0]["modelId"] == "opus-pt-en"
        assert models[0]["name"] == "OPUS Português para Inglês"
        assert models[0]["sourceLanguages"] == ["pt-BR", "pt"]
        assert models[0]["targetLanguages"] == ["en"]
        assert models[0]["license"] == "CC-BY-4.0"

        # Testa via dispatch de protocolo
        os.environ["NEXOHUB_TRANSLATION_MODELS_DIR"] = str(temp_dir)
        try:
            response = handle_request({
                "id": "req-1",
                "method": "translate.list_models",
                "params": {},
            })
            assert "result" in response
            assert len(response["result"]["models"]) == 1
            assert response["result"]["models"][0]["modelId"] == "opus-pt-en"
        finally:
            os.environ.pop("NEXOHUB_TRANSLATION_MODELS_DIR", None)


