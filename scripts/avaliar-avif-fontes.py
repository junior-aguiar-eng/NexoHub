"""Baixa artefatos fixos para ensaio isolado; não altera dependências do aplicativo."""

import base64
import hashlib
import io
import json
import tarfile
import urllib.request
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath

OUT = Path(__file__).resolve().parents[1] / ".superpowers/sdd/2026-10-26-im-c4-avif"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / ".gitignore").write_text("*\n", encoding="utf-8")


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "NexoHub-local-evaluation"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


packages = []
for name, version in {
    "@jsquash/avif": "2.1.1",
    "@jsquash/jpeg": "1.6.0",
    "@jsquash/webp": "1.5.0",
    "wasm-feature-detect": "1.8.0",
}.items():
    registry = json.loads(fetch("https://registry.npmjs.org/" + name))
    release = registry["versions"][version]
    raw = fetch(release["dist"]["tarball"])
    if len(raw) > 20 * 1024 * 1024:
        raise ValueError("Tarball acima do limite do ensaio")
    algorithm, digest = release["dist"]["integrity"].split("-", 1)
    if base64.b64encode(hashlib.new(algorithm, raw).digest()).decode() != digest:
        raise ValueError("Integridade npm divergente: " + name)
    folder = OUT / name.split("/")[-1]
    folder.mkdir(exist_ok=True)
    files = []
    total = 0
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
        for entry in archive.getmembers():
            if not entry.isfile():
                continue
            parts = PurePosixPath(entry.name).parts
            if (
                not parts
                or parts[0] != "package"
                or ".." in parts
                or any(":" in part or "\\" in part for part in parts)
            ):
                raise ValueError("Nome inseguro no tarball")
            target = folder.joinpath(*parts[1:]).resolve()
            if not target.is_relative_to(folder.resolve()):
                raise ValueError("Arquivo fora da pasta isolada")
            total += entry.size
            if total > 100 * 1024 * 1024:
                raise ValueError("Pacote expandido acima do limite")
            content = archive.extractfile(entry).read()
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
            files.append(
                {
                    "name": "/".join(parts[1:]),
                    "bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
            )
    packages.append(
        {
            "package": name,
            "version": version,
            "published": registry["time"][version],
            "latestObserved": registry["dist-tags"].get("latest"),
            "license": release.get("license"),
            "gitHead": release.get("gitHead"),
            "dist": release["dist"],
            "tarSha256": hashlib.sha256(raw).hexdigest(),
            "files": files,
        }
    )
    print(name, version, release.get("gitHead"), len(raw), flush=True)

corpus = []
for photo, expected in {
    "chelsea": "596aa1e7cb875eb79f437e310381d26b338a81c2da23439704a73c4651e8c4bb",
    "coffee": "cc02f8ca188b167c775a7101b5d767d1e71792cf762c33d6fa15a4599b5a8de7",
}.items():
    url = f"https://raw.githubusercontent.com/scikit-image/scikit-image/v0.19.3/skimage/data/{photo}.png"
    raw = fetch(url)
    if hashlib.sha256(raw).hexdigest() != expected:
        raise ValueError("Corpus diverge da baseline: " + photo)
    (OUT / (photo + ".png")).write_bytes(raw)
    corpus.append(
        {
            "id": photo,
            "url": url,
            "sha256": expected,
            "license": "CC0; fonte de créditos registrada no ensaio anterior",
        }
    )

sources = []
revision = packages[0]["gitHead"]
if not revision:
    raise ValueError("Distribuição sem revisão declarada")
urls = {
    "avif-Makefile": f"https://raw.githubusercontent.com/jamsinclair/jSquash/{revision}/packages/avif/codec/Makefile",
    "wrapper-LICENSE": f"https://raw.githubusercontent.com/jamsinclair/jSquash/{revision}/LICENSE",
    "libavif-LICENSE": "https://raw.githubusercontent.com/AOMediaCodec/libavif/v1.0.1/LICENSE",
    "libavif-PATENTS": "https://raw.githubusercontent.com/AOMediaCodec/libavif/v1.0.1/PATENTS",
    "libaom-LICENSE": "https://aomedia.googlesource.com/aom/+/refs/tags/v3.7.0/LICENSE?format=TEXT",
    "libaom-PATENTS": "https://aomedia.googlesource.com/aom/+/refs/tags/v3.7.0/PATENTS?format=TEXT",
    "libwebp-COPYING": "https://chromium.googlesource.com/webm/libwebp/+/e2c85878f6a33f29948b43d3492d9cdaf801aa54/COPYING?format=TEXT",
    "libwebp-PATENTS": "https://chromium.googlesource.com/webm/libwebp/+/e2c85878f6a33f29948b43d3492d9cdaf801aa54/PATENTS?format=TEXT",
    "corpus-credits": "https://raw.githubusercontent.com/scikit-image/scikit-image/v0.19.3/skimage/data/_fetchers.py",
    "avif-helper-Makefile": f"https://raw.githubusercontent.com/jamsinclair/jSquash/{revision}/packages/avif/codec/helper.Makefile",
    "libaom-changelog-3.9.1": "https://aomedia.googlesource.com/aom/+/refs/tags/v3.9.1/CHANGELOG?format=TEXT",
}
for name, url in urls.items():
    try:
        raw = fetch(url)
        if url.endswith("format=TEXT"):
            raw = base64.b64decode(raw)
        (OUT / (name + ".txt")).write_bytes(raw)
        sources.append(
            {"id": name, "url": url, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
        )
    except Exception as error:
        sources.append({"id": name, "url": url, "error": str(error)})
        print(name, type(error).__name__, flush=True)
for repo in ["jamsinclair/jSquash", "AOMediaCodec/libavif"]:
    data = json.loads(fetch("https://api.github.com/repos/" + repo))
    sources.append(
        {
            "id": repo,
            "url": "https://api.github.com/repos/" + repo,
            "repository": {
                key: data.get(key) for key in ["archived", "pushed_at", "default_branch", "license"]
            },
        }
    )
result = {
    "measuredAtUtc": datetime.now(UTC).isoformat(),
    "packages": packages,
    "corpus": corpus,
    "sources": sources,
}
(OUT / "sources.json").write_text(
    json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
