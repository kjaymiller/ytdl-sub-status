#!/usr/bin/env python3
"""Build a loadable/signable .zip for the extension.

No node/web-ext required — plain zipfile over the shipping file set.
Output: web-ext-artifacts/ytdl-sub-status-<version>.zip

Include rules:
  - manifest.json, background.js, content.js
  - popup/, options/, icons/ (if present)
Exclude:
  - .git, .gitignore, web-ext-artifacts, docs, README, CONTRIBUTING, scripts, tests
  - any dot-file, __pycache__, *.zip/*.xpi
"""
from __future__ import annotations

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "web-ext-artifacts"

INCLUDE_FILES = {"manifest.json", "background.js", "content.js"}
INCLUDE_DIRS = {"popup", "options", "icons", "_locales"}


def iter_shipping_files():
    for name in sorted(INCLUDE_FILES):
        p = ROOT / name
        if p.is_file():
            yield p
    for d in sorted(INCLUDE_DIRS):
        base = ROOT / d
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*")):
            if p.is_file() and not p.name.startswith(".") and "__pycache__" not in p.parts:
                yield p


def main() -> int:
    manifest = json.loads((ROOT / "manifest.json").read_text())
    version = manifest["version"]
    name = manifest.get("name", "extension").lower().replace(" ", "-")

    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / f"{name}-{version}.zip"
    if out.exists():
        out.unlink()

    files = list(iter_shipping_files())
    if not any(f.name == "manifest.json" for f in files):
        print("no manifest.json found", file=sys.stderr)
        return 1

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            arc = f.relative_to(ROOT).as_posix()
            zf.write(f, arcname=arc)
            print(f"  + {arc}")

    size_kb = out.stat().st_size / 1024
    print()
    print(f"built {out.relative_to(ROOT)} ({size_kb:.1f} KB, {len(files)} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
