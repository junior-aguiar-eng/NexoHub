"""Leitor independente opcional.

uv run --with pikepdf==10.5.1 --python 3.12 scripts/validar-r-c1.py
"""

import hashlib
import json
from pathlib import Path

import pikepdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / ".superpowers/sdd/2026-10-26-r-c1"
manifest = json.loads(
    (ROOT / "apps/client/src/platform/__fixtures__/r-c1/expected.json").read_text(encoding="utf-8")
)
comparison = json.loads((OUT / "comparison.json").read_text(encoding="utf-8"))
checks = []
for case in manifest["cases"]:
    source = (OUT / (case["id"] + ".pdf")).read_bytes()
    assert hashlib.sha256(source).hexdigest() == case["sha256"], case["id"]
    row = next(
        row for row in comparison["cases"] if row["id"] == case["id"] and row["engine"] == "r-c1"
    )
    assert row["inputUnchanged"]
    if case["expected"].startswith(("CORRUPTED_", "PDF_REPAIR_")):
        assert row.get("error") == case["expected"], row
        continue
    output = OUT / (case["id"] + "-r-c1.pdf")
    assert hashlib.sha256(output.read_bytes()).hexdigest() == row["outputSha256"]
    with pikepdf.open(output) as pdf:
        field = next(field for field in pdf.Root.AcroForm.Fields if str(field.T) == "nome")
        payload = pdf.attachments["nota.txt"].get_file().read_bytes()
        assert len(pdf.pages) == 2 and str(field.V) == "Maria Silva" and len(pdf.attachments) == 1
        assert str(pdf.docinfo.Title) == "Relatório autoral R-C1"
        assert list(pdf.pages[0].obj.CropBox) == [5, 10, 285, 385]
        assert payload == b"Anexo autoral preservado"
        checks.append(
            {
                "id": case["id"],
                "reader": "pikepdf "
                + pikepdf.__version__
                + " / qpdf "
                + pikepdf.__libqpdf_version__,
                "pages": len(pdf.pages),
                "field": str(field.V),
                "attachments": len(pdf.attachments),
                "attachmentSha256": hashlib.sha256(payload).hexdigest(),
                "title": str(pdf.docinfo.Title),
                "warnings": pdf.get_warnings(),
            }
        )
assert len(checks) == 5
(OUT / "independent-reader.json").write_text(
    json.dumps(checks, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print("Cinco saídas conferidas; três recusas esperadas; hashes e conteúdo do anexo preservados.")
