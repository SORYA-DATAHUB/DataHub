#!/usr/bin/env python3
"""Fast, dependency-light documentation and generated-contract gate."""
from pathlib import Path
import re
import sys

import yaml

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


for path in (ROOT / "docs").rglob("*.md"):
    if path.read_text().count("```") % 2:
        fail(f"unbalanced Markdown fence: {path.relative_to(ROOT)}")

spec = yaml.safe_load((ROOT / "docs/04-backend-api/openapi.yaml").read_text())
operations = sum(
    method in {"get", "post", "put", "patch", "delete"}
    for item in spec["paths"].values()
    for method in item
)
if (operations, len(spec["paths"]), len(spec["components"]["schemas"])) != (151, 135, 222):
    fail("OpenAPI inventory drifted; regenerate and review the new contract")

srs = (ROOT / "docs/01-business-product/SRS.md").read_text()
ids = re.findall(r"^\| ((?:FR|NFR)-[A-Z]+-\d+|SEC-\d+) \|", srs, re.MULTILINE)
if len(ids) != 239 or len(set(ids)) != 239:
    fail("SRS IDs are missing, duplicated, or the declared inventory needs review")

print(f"documentation gate passed: {len(ids)} requirements, {operations} API operations")
