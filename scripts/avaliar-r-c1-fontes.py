import base64
import hashlib
import io
import json
import tarfile
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / ".superpowers/sdd/2026-10-26-r-c1"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / ".gitignore").write_text("*\n", encoding="utf-8")
packages = {
    "@neslinesli93/qpdf-wasm": "0.3.0",
    "@jspawn/qpdf-wasm": "0.0.2",
    "@lipoe/browser-qpdf": "0.3.1",
}
result = []
for name, version in packages.items():
    data = json.load(urllib.request.urlopen("https://registry.npmjs.org/" + name))
    release = data["versions"][version]
    raw = urllib.request.urlopen(release["dist"]["tarball"]).read()
    algorithm, digest = release["dist"]["integrity"].split("-", 1)
    assert base64.b64encode(hashlib.new(algorithm, raw).digest()).decode() == digest, name
    folder = OUT / name.replace("/", "--").replace("@", "")
    folder.mkdir(exist_ok=True)
    files = []
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
        for entry in archive.getmembers():
            if not entry.isfile():
                continue
            content = archive.extractfile(entry).read()
            files.append(
                {
                    "name": entry.name,
                    "bytes": len(content),
                    "sha256": hashlib.sha256(content).hexdigest(),
                }
            )
            # Flatten only known files; no archive paths are executed or extracted as paths.
            if (
                entry.name.endswith((".wasm", ".js", ".mjs", ".json", ".md", ".txt"))
                or "LICENSE" in entry.name
            ):
                safe_name = entry.name.replace("/", "--").replace("\\", "--").replace(":", "--")
                (folder / safe_name).write_bytes(content)
    result.append(
        {
            "package": name,
            "version": version,
            "published": data["time"][version],
            "license": release.get("license"),
            "repository": release.get("repository"),
            "dist": release["dist"],
            "files": files,
        }
    )
    print(name, version, data["time"][version], release.get("license"), len(raw), flush=True)
(OUT / "packages.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
for repo in ["qpdf/qpdf", "neslinesli93/qpdf-wasm", "lipoe/browser-qpdf"]:
    try:
        request = urllib.request.Request(
            "https://api.github.com/repos/" + repo,
            headers={"User-Agent": "NexoHub-local-evaluation"},
        )
        data = json.load(urllib.request.urlopen(request))
        (OUT / (repo.replace("/", "--") + "-repository.json")).write_text(
            json.dumps(
                {
                    k: data.get(k)
                    for k in ["full_name", "pushed_at", "archived", "license", "default_branch"]
                },
                indent=2,
            ),
            encoding="utf-8",
        )
    except Exception as error:
        print(repo, str(error))
