# ytdl-sub-status

Firefox (MV3) extension companion to the [ytdl-sub][ytdl-sub-upstream]
archiver, tailored for the homelab [ytdl-sub-api stack][ytdl-sub-runbook].

While browsing YouTube, it tells you whether the current channel is
already backed up by ytdl-sub, and lets you subscribe new channels with
one click.

By [kjaymiller](https://github.com/kjaymiller). Issues and PRs welcome
at <https://github.com/kjaymiller/ytdl-sub-status>.

[ytdl-sub-upstream]: https://github.com/jmbannon/ytdl-sub

## What it does

- Detects YouTube channel pages (`/@handle`, `/channel/UCxxx`, `/c/name`, `/user/name`).
- Injects a floating card (top-right, shadow-DOM isolated) showing backup status
  inline on the page. The toolbar popup is still available and shows the same UI.
- Reads the page's `<link rel="canonical">` and calls `GET /channels?url=…`
  on the ytdl-sub-api.
- Dot:
  - **green** — backed up; shows name / preset / retention, with **Pull now** and **Unsubscribe**.
  - **grey** — not backed up; shows a subscribe form.
  - **red** — error.
- Subscribe form posts to `POST /channels` with `{url, name?, keep_days, max_files, preset}`.
- **Sub + pull** chains `POST /run` so you don't wait for the hourly ofelia tick.
- Header click collapses the card. Close (×) hides it for the current path
  (`sessionStorage`) — switch channels or reload to bring it back.
- Re-runs on YouTube's SPA navigation (`yt-navigate-finish` + popstate + path poll).

All API calls go through the extension's background script so the bearer
token lives in `browser.storage.local` and never leaks into content scripts.

## Install (dev / sideload)

1. Open Firefox → `about:debugging` → This Firefox → Load Temporary Add-on.
2. Select `manifest.json` (or a built `.zip` — see [docs/signing.md](docs/signing.md)).
3. Click the extension's toolbar icon. On first launch the popup shows
   a minimal setup form:
   - **API base URL** — the origin where your ytdl-sub-api is reachable
     (no trailing slash). In the reference homelab deployment this is a
     tailnet-only hostname like `https://ytdl-sub.<your-domain>`.
   - **API token** — the bearer token the API validates. In the
     reference deployment this is `API_TOKEN` from `compose/ytdl-sub/.env`.
4. Click **Save**. Firefox will prompt to grant host permission for
   the base URL you entered — accept it.
5. For retention defaults and a **Test connection** button, use the
   **Full settings** page (also linked from the popup footer).

Temporary add-ons are unloaded when Firefox quits. For persistent
install, see [Packaging](#packaging).

## Documentation

- [docs/architecture.md](docs/architecture.md) — how the pieces fit (content
  script ↔ background ↔ API) and why the token lives where it does.
- [docs/api.md](docs/api.md) — the ytdl-sub-api endpoints this extension
  consumes, with request/response shapes.
- [CONTRIBUTING.md](CONTRIBUTING.md) — dev loop, coding conventions,
  versioning, release process.

## Versioning

CalVer: `YYYY.MINOR.PATCH`. MINOR increments per feature release within
the year; PATCH for fixes. Tags are prefixed `v` (e.g. `v2026.1.0`).
`manifest.json` and the git tag move together.

## Known limitations

- **`@handle` vs `/channel/UCxxx`.** The API's URL normalizer doesn't
  cross-match the two forms on the server side. As of `v2026.1.1` the
  extension works around this by querying both forms — the URL the
  user is on (usually `/@handle`) and YouTube's `<link rel="canonical">`
  (usually `/channel/UCxxx`). Subscribing still writes whichever form
  the user was on; avoid subscribing the same channel twice under both
  forms or you'll get duplicate entries.
- **Network reachability is on you.** The extension just does `fetch`
  against whatever base URL you configure. The reference deployment is
  tailnet-only (Tailscale, no public ingress); your fetches will fail
  if the browser can't route to the API host.
- **Pinchflat cross-check not implemented.** ytdl-sub only for now.
  Pinchflat has no read API; any cross-check would need a shim.

## Packaging

```
npx web-ext build
```

Produces `web-ext-artifacts/*.zip`. Submit to AMO for a signed `.xpi`,
or run unsigned with Firefox Developer / Nightly + `xpinstall.signatures.required=false`.

## Files

- `manifest.json` — MV3, Firefox-scoped `gecko` id.
- `background.js` — fetch wrapper, holds the token, routes messages from popup and content.
- `content.js` — detects channel pages, extracts canonical URL, injects the floating card.
- `popup/` — the toolbar popup UI (same state machine as the inline card).
- `options/` — settings page (API base, token, default retention).
- `docs/` — architecture and API notes.

[ytdl-sub-runbook]: https://github.com/kjaymiller/homelab/blob/main/RUNBOOKS/phase-4-4-ytdl-sub.md
