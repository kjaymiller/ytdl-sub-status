# Architecture

Three scripts, one API, one browser-local key-value store.

```
  ┌──────────────────────┐      runtime.sendMessage      ┌────────────────┐
  │ content.js           │ ─────────────────────────────▶ │ background.js  │
  │  (youtube.com pages) │                                │  (ext worker)  │
  │                      │ ◀─────────────────────────────┤                │
  └──────────┬───────────┘         {ok, status, data}    └───────┬────────┘
             │                                                   │
             ▼ injects                                           │ fetch w/ Bearer
  ┌──────────────────────┐                                       │
  │ shadow-DOM card      │                                       ▼
  │  (on-page overlay)   │                            ┌──────────────────────┐
  └──────────────────────┘                            │ ytdl-sub-api (Flask) │
                                                      │  tailnet-only        │
  ┌──────────────────────┐      same runtime msgs     │  Bearer token auth   │
  │ popup/popup.js       │ ─────────────────────────▶ └──────────┬───────────┘
  └──────────────────────┘                                       │
                                                                 │ docker exec
  ┌──────────────────────┐                                       ▼
  │ options/options.js   │                            ┌──────────────────────┐
  │  browser.storage     │                            │ ytdl-sub container   │
  └──────────────────────┘                            │  writes subs.yaml    │
                                                      │  runs yt-dlp         │
                                                      └──────────────────────┘
```

## Components

### `content.js`

Runs on every `*://*.youtube.com/*` page at `document_idle`. Does four
things:

1. **Channel detection.** Path regex matches `/@handle`, `/channel/UCxxx`,
   `/c/name`, `/user/name`. Non-channel pages are no-ops.
2. **URL canonicalization.** Reads `<link rel="canonical">`, falls back
   to `og:url`, then to `location.pathname`. YouTube writes canonical
   URLs as `/@handle` on modern pages — the API consumer uses that form.
3. **Card injection.** Creates a `<div id="ytdl-sub-status-host">` with
   an attached `mode: "open"` shadow root, appends a fixed-position
   card (`z-index: 2147483647`, top-right). Shadow DOM isolates our
   styles from YouTube's aggressive `*` selectors and vice-versa.
4. **SPA navigation.** YouTube doesn't do full page loads between
   channels. Listeners:
   - `yt-navigate-finish` — YouTube's internal event, primary trigger.
   - `popstate` — back/forward nav.
   - 1.5s `setInterval` polling `location.pathname` — fallback when the
     SPA swaps history without dispatching the internal event.
   On nav, if new path is a channel, re-sync; else remove the host.

The content script **never sees the API token**. It sends messages like
`{type: "check", url}` to the background script and renders whatever
response comes back.

### `background.js`

Long-lived event page (MV3 scripts stay alive while there's active work
— for this extension's cadence that's fine). Holds:

- Settings loader that merges `browser.storage.local` over compile-time defaults.
- `apiFetch(path, {method, body})` — adds the bearer header, parses JSON
  (tolerates plain text), returns `{ok, status, data}` uniformly.
- Message router with handlers: `check`, `list`, `subscribe`,
  `unsubscribe`, `runNow`, `healthz`.

Errors are caught and returned as `{ok: false, error: "..."}` rather
than thrown — the sender (content or popup) displays the message.

### `popup/`

Toolbar icon UI. Talks to the active tab's content script to get the
channel context, then uses the same background message handlers as
`content.js`. Useful when the user has dismissed the on-page card.

### `options/`

Settings page. Writes to `browser.storage.local`:

- `apiBase` — API URL (default `https://ytdl-sub.kjaymiller.dev`).
- `apiToken` — bearer token.
- `defaultPreset`, `defaultKeepDays`, `defaultMaxFiles` — defaults for
  the subscribe form.

**Test connection** button pings `GET /healthz` (no auth) and
`GET /channels` (auth) and reports the count.

## Why the token lives in the background script

MV3 content scripts run in the page world and can be inspected by page
JS. Even without explicit leakage, the fetch's `Authorization` header
would appear in the page's `Performance.getEntries()` and any CORS
pre-flight the page observes. Putting fetches in the background worker
keeps the token in the extension world, invisible to YouTube's JS.

## State and persistence

- **Extension config** (API URL, token, defaults): `browser.storage.local`.
- **Per-path dismissal** of the inline card: `sessionStorage` on the
  YouTube origin. Cleared on tab close; switching paths brings the card
  back.
- **No authoritative state in the extension.** The source of truth is
  always `configs/ytdl-sub/subscriptions.yaml` in the homelab repo,
  mutated via the API. The extension is a thin client.

## Trust boundaries

| Boundary | What crosses | Guard |
|---|---|---|
| Page JS ↔ content script | none (shadow DOM, separate world) | Firefox enforces |
| Content ↔ background | message envelopes only | `browser.runtime` |
| Background → API | HTTPS + Bearer token | Tailscale (no public ingress) + Traefik |
| API → ytdl-sub container | docker socket | Flask service is the only user |

The extension has `activeTab` and host permissions for YouTube and the
API origin — no broad `<all_urls>`.

## Dependencies

None. No build step, no bundler, no framework. The manifest and three
plain JS files are the shipping artifact. This is intentional — the
extension's scope is small enough that a build pipeline would be
overhead.
