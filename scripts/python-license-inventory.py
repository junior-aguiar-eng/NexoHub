import importlib.metadata
import json

OVERRIDES = {
    "colorama": "BSD-3-Clause",
    "omegaconf": "BSD-3-Clause",
    "sentencepiece": "Apache-2.0",
}


def license_for(distribution: importlib.metadata.Distribution) -> str:
    name = distribution.metadata["Name"].lower()
    if name in OVERRIDES:
        return OVERRIDES[name]
    expression = distribution.metadata.get("License-Expression")
    if expression:
        return expression
    license_text = distribution.metadata.get("License")
    if license_text and len(license_text) < 100:
        return license_text
    for classifier in distribution.metadata.get_all("Classifier", []):
        if classifier.startswith("License ::"):
            return classifier.removeprefix("License :: ")
    return "UNKNOWN"


rows = [
    {
        "name": distribution.metadata["Name"],
        "version": distribution.version,
        "license": license_for(distribution),
    }
    for distribution in importlib.metadata.distributions()
]
print(json.dumps(sorted(rows, key=lambda row: row["name"].lower()), ensure_ascii=False))
