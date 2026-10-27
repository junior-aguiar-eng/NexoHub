import hashlib
import json
import time
from pathlib import Path

import pikepdf

out = Path(__file__).resolve().parents[1] / ".superpowers/sdd/2026-10-26-r-c1"
rows = []
for path in out.glob("*.pdf"):
    if path.stem not in [
        "integro",
        "prefixo",
        "sem-eof",
        "sem-startxref",
        "xref-incorreto",
        "sem-xref-trailer",
        "perda-fisica",
        "texto-objetos",
    ]:
        continue
    row = {"case": path.stem, "pikepdf": pikepdf.__version__, "qpdf": pikepdf.__libqpdf_version__}
    start = time.perf_counter()
    try:
        with pikepdf.open(path) as pdf:
            row["pages"] = len(pdf.pages)
            row["warnings"] = pdf.get_warnings()
            target = out / (path.stem + "-native-qpdf.pdf")
            pdf.save(target)
            row["outputSha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    except Exception as error:
        row["error"] = str(error)
    row["ms"] = (time.perf_counter() - start) * 1000
    rows.append(row)
(out / "native-comparison.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
print(json.dumps(rows))
