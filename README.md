# ytdl-sub-status

Firefox (MV3) extension companion to the homelab's [ytdl-sub stack](../homelab/RUNBOOKS/phase-4-4-ytdl-sub.md).

While browsing YouTube, it tells you whether the current channel is already
backed up by ytdl-sub, and lets you subscribe new channels with one click.

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
2. Select `manifest.json`.
3. Click the extension's toolbar icon → Settings.
4. Enter:
   - **API base URL** — `https://ytdl-sub.kjaymiller.dev` (tailnet-only).
   - **API token** — value of `API_TOKEN` from `compose/ytdl-sub/.env` on the K6.
5. Hit **Test connection** — should say `OK — N subscriptions visible`.

For a signed build suitable for day-to-day use, see the [Packaging](#packaging) section.

## Known limitations

- **`@handle` vs `/channel/UCxxx`.** The API's URL normalizer doesn't
  cross-match the two forms. The extension uses whatever
  `<link rel="canonical">` resolves to, which on modern YouTube is
  usually the `/@handle` form. Subscriptions added via the UI and
  subscriptions added via direct YAML commit should use the same form
  to avoid duplicates.
- **Tailnet-only.** The API is on Tailscale with no public route. The
  extension's fetch will fail if the host isn't on the tailnet.
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
- `background.js` — fetch wrapper, holds the token, routes messages from popup.
- `content.js` — detects channel pages, extracts canonical URL.
- `popup/` — the toolbar popup UI.
- `options/` — settings page (API base, token, default retention).
