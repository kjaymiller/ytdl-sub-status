# Contributing

Single-maintainer private repo. These notes are mostly for future-me (or
a future agent) picking the project back up cold.

## Dev loop

1. Load the extension as a temporary add-on:
   - Firefox → `about:debugging` → This Firefox → Load Temporary Add-on → `manifest.json`.
2. Configure via the toolbar icon → Settings (API base + token). Hit
   **Test connection**.
3. Edit `content.js` / `background.js` / popup files in place.
4. Reload:
   - Content script / manifest changes: back to `about:debugging` →
     Reload, then refresh the YouTube tab.
   - Popup / options changes: just re-open the popup.
   - Background changes: Reload.
5. View logs:
   - **Content script** — DevTools on the YouTube tab, Console.
   - **Background** — `about:debugging` → Inspect on the extension.
   - **Popup / options** — right-click → Inspect.

## Coding conventions

- **No build step, no framework, no dependencies.** Plain ES modules
  (well, plain scripts — MV3 background doesn't need modules here) and
  `browser.*` APIs. If you reach for a bundler, reconsider first.
- **Shadow DOM for any page-injected UI.** YouTube's stylesheets are
  aggressive and the page JS is hostile; isolation is mandatory.
- **Token stays in `background.js`.** Content scripts and popup must
  go through `runtime.sendMessage` for anything that needs auth. Never
  pass the token across message boundaries.
- **`{ok, status, data}` response shape.** The background wrapper
  normalizes all fetches into this shape so UI code doesn't have to
  distinguish HTTP-level failures from app-level errors.
- **No comments explaining WHAT.** Add a one-liner only when the WHY is
  non-obvious (e.g. "yt-navigate-finish fires before DOM updates, so we
  wait an idle tick").

## File layout

See [docs/architecture.md](docs/architecture.md) for how the pieces fit.

- `manifest.json` — MV3 manifest. Bump `version` when releasing (CalVer).
- `background.js` — token holder + message router + fetch wrapper.
- `content.js` — YouTube page integration; shadow-DOM card.
- `popup/` — toolbar popup UI, same state machine as the inline card.
- `options/` — settings page.
- `docs/` — architecture and API references.

## Versioning

CalVer `YYYY.MINOR.PATCH` (e.g. `2026.1.0`). Rules:

- **MINOR** — new feature, UI change, new permission, any change that
  would surprise an existing user.
- **PATCH** — bug fixes, doc-only, refactors with no behavior change.
- **Year rollover** — first release after Jan 1 resets MINOR to `1`
  (e.g. `2025.7.2` → `2026.1.0`).
- `manifest.json` and the git tag move together. Tag prefix is `v`.

## Release

```bash
# 1. Bump manifest.json "version" to the next CalVer.
# 2. Commit:
git commit -m "bump manifest version -> YYYY.MINOR.PATCH"
# 3. Annotated tag:
git tag -a vYYYY.MINOR.PATCH -m "vYYYY.MINOR.PATCH — <one-line summary>"
# 4. Push both:
git push origin main
git push origin vYYYY.MINOR.PATCH
```

Build a loadable / signable zip:

```bash
python3 scripts/build.py   # → web-ext-artifacts/ytdl-sub-status-<version>.zip
```

See [docs/signing.md](docs/signing.md) for the AMO signing flow (for
persistent installs on release Firefox).

## Testing checklist

Quick manual pass before tagging — no automated tests yet.

- [ ] Non-YouTube page: card not injected.
- [ ] YouTube home (not a channel): card not injected.
- [ ] Channel page, unsubscribed: grey dot, subscribe form shown.
- [ ] Subscribe: green dot, details populated, subscription visible in
      `configs/ytdl-sub/subscriptions.yaml` after API write.
- [ ] Sub + pull: `POST /run` fires, exit code shown.
- [ ] Unsubscribe: confirms, removes entry, form reappears.
- [ ] SPA nav: click from one channel to another — card updates without
      a full reload.
- [ ] Close (×): card hidden until next channel nav or reload.
- [ ] Options **Test connection**: shows subscription count.
- [ ] Toolbar popup: same state machine, independent of inline card.

## When changing the ytdl-sub-api

Server lives in the homelab repo at `scripts/ytdl-sub-api/api.py`. If
endpoints move, update:

1. `background.js` message handlers.
2. [`docs/api.md`](docs/api.md).
3. The homelab runbook at `RUNBOOKS/phase-4-4-ytdl-sub.md`.

Keep the extension's CalVer in step with the API's expected shape —
document the required API version in the release notes if there's a
compat break.

## What not to add

- Telemetry / analytics. Private repo, private use.
- Third-party auth providers. The API is tailnet-gated; bearer is enough.
- Sync beyond `browser.storage.local`. Token is per-device on purpose.
- Chrome-only APIs. Firefox-first; cross-browser is fine where
  `browser.*` and `chrome.*` align, but don't break Firefox for it.
