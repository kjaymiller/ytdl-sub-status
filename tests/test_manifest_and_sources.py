"""Regression tests for AMO / web-ext lint findings.

Run: python -m unittest discover -s tests
"""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text())
JS_FILES = [
    ROOT / "content.js",
    ROOT / "background.js",
    ROOT / "popup" / "popup.js",
    ROOT / "options" / "options.js",
]


def version_tuple(v: str) -> tuple[int, ...]:
    return tuple(int(p) for p in v.split("."))


class ManifestTests(unittest.TestCase):
    def test_data_collection_permissions_declared(self):
        gecko = MANIFEST["browser_specific_settings"]["gecko"]
        self.assertEqual(
            gecko.get("data_collection_permissions"),
            {"required": ["none"]},
            "AMO requires browser_specific_settings.gecko.data_collection_permissions",
        )

    def test_gecko_min_version_supports_manifest_keys(self):
        # data_collection_permissions: FF 140, optional_host_permissions: FF 128
        gecko = MANIFEST["browser_specific_settings"]["gecko"]
        self.assertGreaterEqual(
            version_tuple(gecko["strict_min_version"]),
            (140, 0),
            "gecko.strict_min_version must be >= 140 for data_collection_permissions",
        )

    def test_gecko_android_min_version_supports_manifest_keys(self):
        # data_collection_permissions on Android: FF-A 142
        android = MANIFEST["browser_specific_settings"].get("gecko_android")
        self.assertIsNotNone(android, "gecko_android entry is required")
        self.assertGreaterEqual(
            version_tuple(android["strict_min_version"]),
            (142, 0),
            "gecko_android.strict_min_version must be >= 142",
        )


class SourceSafetyTests(unittest.TestCase):
    """web-ext lint flags any `.innerHTML = ...` assignment as UNSAFE_VAR_ASSIGNMENT."""

    INNERHTML_ASSIGN = re.compile(r"\.innerHTML\s*=")

    def test_no_innerhtml_assignments(self):
        offenders = []
        for path in JS_FILES:
            if not path.exists():
                continue
            for lineno, line in enumerate(path.read_text().splitlines(), 1):
                if self.INNERHTML_ASSIGN.search(line):
                    offenders.append(f"{path.relative_to(ROOT)}:{lineno}: {line.strip()}")
        self.assertFalse(
            offenders,
            "innerHTML assignments found (use textContent or DOM APIs):\n" + "\n".join(offenders),
        )


class PermissionsRequestGestureTests(unittest.TestCase):
    """Firefox rejects `permissions.request()` with "may only be called from a
    user input handler" if a prior `await` runs first — the user-gesture
    context is consumed by the time `request()` fires.

    The common trap is awaiting `permissions.contains()` as a precheck before
    `permissions.request()` inside a click handler. `request()` already
    short-circuits to `true` when the origin is granted, so the precheck is
    both redundant and harmful. This test fails if any source file contains
    an `await … permissions.contains(` followed later by `permissions.request(`.
    """

    CONTAINS_AWAIT = re.compile(r"await\s+[\w.]*permissions\.contains\s*\(")
    REQUEST_CALL = re.compile(r"permissions\.request\s*\(")

    def test_no_contains_precheck_before_request(self):
        offenders = []
        for path in JS_FILES:
            if not path.exists():
                continue
            text = path.read_text()
            contains_match = self.CONTAINS_AWAIT.search(text)
            request_match = self.REQUEST_CALL.search(text)
            if contains_match and request_match and contains_match.start() < request_match.start():
                rel = path.relative_to(ROOT)
                offenders.append(
                    f"{rel}: `await permissions.contains(` precedes "
                    f"`permissions.request(` — the await consumes the user "
                    f"gesture and Firefox will reject the request."
                )
        self.assertFalse(
            offenders,
            "permissions.request() must be the first await in its user-gesture "
            "handler:\n" + "\n".join(offenders),
        )


if __name__ == "__main__":
    unittest.main()
