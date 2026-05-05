# Changelog

All notable changes to this extension are documented here. Versioning is
`YEAR.MINOR.PATCH` (calendar year + minor + patch).

## [2026.4.3] - 2026-04-27

### Added
- Inline status badge injected next to the channel name on YouTube channel
  pages and on watch pages (`ytd-video-owner-renderer`). A green checkmark
  means the channel is backed up; a download-cloud icon means it isn't.
  Clicking either icon opens the existing floating card targeted at that
  channel, so you can subscribe a channel from a video page without
  navigating to it.
- Per-URL status cache (60s TTL) shared by the floating card and the
  inline badges, so revisits and SPA navigations don't re-hit the API.

### Changed
- The floating card now accepts an arbitrary target channel URL/title
  instead of always reading from `location`. Subscribe / unsubscribe
  invalidates the cache and refreshes any visible badges for that URL.

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

## v2026.4.9 (2026-05-05)

### Fix

- remove pull-now actions; downloads happen on server schedule

## v2026.4.8 (2026-04-26)

### Fix

- restore preset selectors on popup and inline add-forms

## v2026.4.7 (2026-04-26)

### Fix

- drop preset selector to stop invalid presets bricking ytdl-sub cron (#1)

## v2026.4.6 (2026-04-26)

### Feat

- **content**: animated spinner, question-mark badge for unconfigured, clearer colors

## v2026.4.5 (2026-04-26)

### Fix

- **content**: refresh inline badges on SPA nav instead of reusing stale state

## v2026.4.4 (2026-04-26)

### Feat

- **content**: inline status badges on channel + watch pages

## v2026.4.2 (2026-04-26)

### Feat

- **presets**: auto-fill keep_days and max_files from selected profile

### Refactor

- **presets**: drop redundant detail panel; form fields are the display

## v2026.4.1 (2026-04-26)

### Fix

- **presets**: read profiles + default_preset from API response

## v2026.4.0 (2026-04-26)

### Feat

- **popup,content,options**: preset dropdown from GET /presets

## v2026.3.1 (2026-04-26)

## v2026.3.0 (2026-04-26)

## v2026.2.4 (2026-04-25)

## v2026.2.1 (2026-04-24)

## v2026.2.0 (2026-04-24)

## v2026.1.2 (2026-04-24)

## v2026.1.1 (2026-04-24)

### Fix

- query both @handle and /channel/UCxxx forms on lookup

## v2026.1.0 (2026-04-24)
