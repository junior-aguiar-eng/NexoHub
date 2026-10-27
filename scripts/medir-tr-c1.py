"""Controlador isolado de RSS; execute com uv run --with psutil==7.2.2."""
import json
import os
from pathlib import Path
import subprocess
import time
import sys

import psutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".superpowers/sdd/2026-10-26-tr-c1"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / ".gitignore").write_text("*\n", encoding="utf-8")
discovery = json.loads((ROOT / "docs/evidencias/tr-c1/modelos.json").read_text(encoding="utf-8"))["fontes"]
models = {"m2m100": "Xenova/m2m100_418M", "opus-en": "Xenova/opus-mt-en-ROMANCE", "opus-romance": "Xenova/opus-mt-ROMANCE-en"}
probe = "--cache-probe" in sys.argv
segmented = "--segmented" in sys.argv
runtime_probe = "--runtime-probe" in sys.argv
if segmented: models = {"m2m100-segmented": "Xenova/m2m100_418M"}
if runtime_probe: models = {"m2m100-runtime-probe": "Xenova/m2m100_418M"}
if probe: models = {"m2m100-cache-probe": "Xenova/m2m100_418M"}
failed = False
for name, model in models.items():
    revision = next(row["revision"] for row in discovery if row["model"] == model)
    start = time.perf_counter()
    peak = 0
    with (OUT / f"{name}.log").open("w", encoding="utf-8") as log:
        process = subprocess.Popen(["node", "scripts/medir-tr-c1.mjs", name.removesuffix("-cache-probe").removesuffix("-segmented").removesuffix("-runtime-probe"), revision, *( ["--cache-probe"] if probe else ["--segmented"] if segmented else ["--runtime-probe"] if runtime_probe else [] )], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, env=os.environ.copy())
        handle = psutil.Process(process.pid)
        while process.poll() is None:
            rss = 0
            try: members = [handle, *handle.children(recursive=True)]
            except psutil.Error: members = []
            for member in members:
                try: rss += member.memory_info().rss
                except psutil.Error: pass
            peak = max(peak, rss)
            if time.perf_counter() - start > 1800:
                for member in reversed(members):
                    try: member.kill()
                    except psutil.Error: pass
                raise TimeoutError(name)
            time.sleep(0.05)
    result = {"profile": name, "exitCode": process.returncode, "wallMs": (time.perf_counter() - start) * 1000, "sampledTreePeakRssBytes": peak, "sampleIntervalMs": 50,
              "scope": "Soma RSS de Node/Vite, Chromium, renderer e worker. Pode contar páginas compartilhadas mais de uma vez; não é heap exclusivo do modelo."}
    (OUT / f"{name}-resources.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result), flush=True)

    failed = failed or process.returncode != 0
sys.exit(1 if failed else 0)
