"""Splice a new git-cliff release section into CHANGELOG.md.

git-cliff's --prepend mode inserts at the top of the file, which would push
the hand-written header below new release sections. This wrapper splits
CHANGELOG.md at the first `## [` line, asks git-cliff for the new section,
and writes back: <header block> + <new section> + <existing entries>.

Usage: python scripts/changelog.py 2026.2.6
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / "CHANGELOG.md"


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: changelog.py <version>", file=sys.stderr)
        return 2
    version = sys.argv[1].lstrip("v")
    tag = f"v{version}"

    new_section = subprocess.check_output(
        ["git-cliff", "--unreleased", "--tag", tag],
        cwd=ROOT,
        text=True,
    ).strip()
    if not new_section:
        print(f"no tagged commits since the last release; nothing to add for {tag}", file=sys.stderr)
        return 1

    text = CHANGELOG.read_text()
    marker = "\n## ["
    idx = text.find(marker)
    if idx == -1:
        head, tail = text.rstrip() + "\n", ""
    else:
        head, tail = text[: idx + 1], text[idx + 1 :]

    CHANGELOG.write_text(f"{head}\n{new_section}\n\n{tail}")
    print(f"prepended {tag} release section to CHANGELOG.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
