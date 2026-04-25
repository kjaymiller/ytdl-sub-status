# Changelog

All notable changes to this extension are documented here. Versioning is
`YEAR.MINOR.PATCH` (calendar year + minor + patch).

## [2026.2.5] - 2026-04-25

### Fixed
- Saving the API base URL in Options or the popup setup form no longer fails
  with `permissions.request may only be called from a user input handler`.
  The `permissions.contains()` precheck was awaiting before
  `permissions.request()`, consuming the user-gesture context Firefox
  requires; the precheck has been dropped (`request()` already short-circuits
  to `true` when the origin is already granted).

### Tests
- Added a regression test that fails if any source file awaits
  `permissions.contains()` before calling `permissions.request()`.

## [2026.2.4] - 2026-04-25

### Changed
- AMO listing copy: lead with the API-dependency disclaimer and link to the
  reference server.
- README and docs call out the API dependency more prominently.

### Added
- `justfile` and a minimal `pyproject.toml` for `uv sync` / test / build.
- Regression tests for manifest and source-file web-ext lint findings.
- Manifest declares `gecko.data_collection_permissions` (required by AMO).
- MIT license.

### Fixed
- Resolved web-ext lint warnings (including `innerHTML` assignments).

## [2026.2.1] - 2026-04-24

### Changed
- Removed references to the private homelab repo from docs.

## [2026.2.0] - 2026-04-24

### Added
- Generic defaults and in-popup first-run setup.
- Credits and public-release prep.

## [2026.1.2] - 2026-04-24

### Added
- README expansion, CONTRIBUTING, architecture and API references.

### Fixed
- Channel lookup now queries both `@handle` and `/channel/UCxxx` URL forms.

## [2026.1.1] - 2026-04-24

### Added
- Build script and AMO signing guide.
- Friendly "not configured" UI when the API base / token are unset.

## [2026.1.0] - 2026-04-24

### Added
- Initial public release of the MV3 ytdl-sub status extension.
- Shadow-DOM status card injected on YouTube channel pages.
- Popup and Options pages for configuring the API base URL and token.
