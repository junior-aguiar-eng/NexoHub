"""Script de instalação e verificação do modelo de tradução OPUS-MT TC Big EN-PT para o NexoHub."""

import hashlib
import json
import os
import sys
import urllib.request
from pathlib import Path

REPO_BASE = "https://huggingface.co/ooeoeo/opus-mt-tc-big-en-pt-ct2-float16/resolve/main"
FILES = [
    "model.bin",
    "shared_vocabulary.json",
    "source.spm",
    "target.spm",
    "config.json",
]


def download_file(url: str, destination: Path) -> None:
    temp_path = destination.with_suffix(".tmp")
    req = urllib.request.Request(url, headers={"User-Agent": "NexoHub-Installer/1.0"})
    print(f"Baixando {destination.name}...")
    with urllib.request.urlopen(req) as resp, open(temp_path, "wb") as out_file:
        total = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        while chunk := resp.read(1024 * 1024):
            out_file.write(chunk)
            downloaded += len(chunk)
            if total:
                percent = (downloaded / total) * 100
                mb = downloaded / (1024 * 1024)
                total_mb = total / (1024 * 1024)
                print(f"\r  Progresso: {mb:.1f} MB / {total_mb:.1f} MB ({percent:.1f}%)", end="", flush=True)
        print()
    if destination.exists():
        destination.unlink()
    temp_path.rename(destination)


def compute_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            hasher.update(chunk)
    return hasher.hexdigest()


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    root_dir = Path(__file__).resolve().parent.parent
    models_dir = root_dir / "runtime" / "models"
    model_dir = models_dir / "opus-mt-tc-big-en-pt"
    model_dir.mkdir(parents=True, exist_ok=True)

    print(f"Diretório de destino: {model_dir}")

    for filename in FILES:
        target = model_dir / filename
        if target.exists() and target.stat().st_size > 0:
            print(f"Arquivo já existe: {filename}")
            continue
        url = f"{REPO_BASE}/{filename}"
        download_file(url, target)

    print("Calculando SHA-256 do artifact principal (model.bin)...")
    model_bin = model_dir / "model.bin"
    sha256_hash = compute_sha256(model_bin)
    print(f"SHA-256 model.bin: {sha256_hash}")

    manifest = {
        "formatVersion": 1,
        "id": "opus-mt-tc-big-en-pt",
        "name": "OPUS-MT TC Big Inglês para Português",
        "family": "opus-mt-tc-big",
        "quantization": "float32",
        "sourceLanguages": ["en"],
        "targetLanguages": ["pt", "pt-BR"],
        "license": "CC-BY-4.0",
        "artifact": "model.bin",
        "sha256": sha256_hash,
        "tokenizer": {
            "type": "sentencepiece-pair",
            "sourceModel": "source.spm",
            "targetModel": "target.spm",
            "targetPrefixes": {
                "pt": "",
                "pt-BR": "",
            },
        },
    }

    manifest_path = model_dir / "nexohub-model.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Manifesto criado em: {manifest_path}")

    # Teste de inferência rápida
    print("\nExecutando teste de inferência com CTranslate2 e SentencePiece...")
    os.environ["NEXOHUB_TRANSLATION_MODELS_DIR"] = str(models_dir)
    sys.path.insert(0, str(root_dir / "engines" / "python" / "src"))

    from nexohub_document_engine.translation import (
        list_installed_models,
        translate_text,
    )

    installed = list_installed_models(models_dir)
    print(f"Modelos detectados: {[m['modelId'] for m in installed]}")

    sample_text = "This contract is governed by the laws of Brazil."
    result = translate_text(sample_text, "en", "pt-BR", "opus-mt-tc-big-en-pt", models_root=models_dir)
    print(f"\n[EN]: {sample_text}")
    print(f"[PT-BR]: {result.text}")
    print("\nInstalação e verificação do OPUS-MT concluídas com sucesso!")


if __name__ == "__main__":
    main()
