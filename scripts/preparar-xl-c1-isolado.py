"""Download público apenas dos modelos de layout/TableFormer para o benchmark."""

import hashlib
import importlib.metadata
import json
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / ".superpowers/sdd/2026-10-26-xl-c1/isolated"


def main():
    os.environ["HF_HOME"] = str(WORK / "hf-cache")
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["HF_HUB_DISABLE_IMPLICIT_TOKEN"] = "1"
    os.environ["HF_HUB_DISABLE_XET"] = "1"
    os.environ.pop("HF_TOKEN", None)

    from docling.datamodel.pipeline_options import LayoutObjectDetectionOptions
    from docling.models.utils.hf_model_download import download_hf_model
    from huggingface_hub import HfApi

    start = time.perf_counter()
    spec = LayoutObjectDetectionOptions().model_spec
    PINNED_REVISIONS = {
        "docling-project/docling-layout-heron": "8f39ad3c0b4c58e9c2d2c84a38465abf757272d8",
        "docling-project/docling-models": "fc0f2d45e2218ea24bce5045f58a389aed16dc23",
    }
    models = []
    for repo, revision in [
        (spec.repo_id, spec.revision),
        ("docling-project/docling-models", "v2.3.0"),
    ]:
        info = HfApi(token=False).model_info(repo, revision=PINNED_REVISIONS[repo])
        print(repo, revision, info.sha, flush=True)
        download_hf_model(
            repo_id=repo,
            revision=info.sha,
            local_dir=WORK / "models" / repo.replace("/", "--"),
            progress=True,
        )
        models.append(
            {
                "repo": repo,
                "requestedRevision": revision,
                "commit": info.sha,
                "cardLicense": info.card_data.get("license")
                if info.card_data
                else None,
            }
        )
    files = []
    for file in (WORK / "models").rglob("*"):
        if file.is_file() and ".cache" not in file.parts:
            files.append(
                {
                    "path": str(file.relative_to(WORK / "models")),
                    "bytes": file.stat().st_size,
                    "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
                }
            )
    licenses = []
    for dist in importlib.metadata.distributions():
        meta = dist.metadata
        classifiers = [
            item
            for item in meta.get_all("Classifier", [])
            if item.startswith("License")
        ]
        licenses.append(
            {
                "name": meta["Name"],
                "version": dist.version,
                "license": meta.get("License-Expression")
                or classifiers
                or meta.get("License", "Não declarada")[:250],
            }
        )
    (WORK / "preparation.json").write_text(
        json.dumps(
            {
                "downloadAndHashMs": (time.perf_counter() - start) * 1000,
                "models": models,
                "files": files,
                "modelBytes": sum(f["bytes"] for f in files),
                "packages": licenses,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print("PREPARACAO CONCLUIDA", sum(f["bytes"] for f in files), "bytes", flush=True)


if __name__ == "__main__":
    main()
