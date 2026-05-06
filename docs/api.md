# ytdl-sub-api reference

This extension is a thin client over a small HTTP API that CRUDs a
ytdl-sub `subscriptions.yaml` file and triggers on-demand pulls. The
endpoints documented here are what the extension relies on; a
conforming server is enough.

> [!NOTE]
> A reference implementation is published at
> [kjaymiller/ytdl-sub-api](https://github.com/kjaymiller/ytdl-sub-api)
> — a single `docker compose up` gives you ytdl-sub, a cron sidecar,
> and the Flask API. Roll your own only if you want to.

- **Base URL:** user-configured in the options page (no hardcoded
  default). Deployment is up to you — LAN / tailnet / public behind
  auth.
- **Auth:** `Authorization: Bearer <API_TOKEN>` on every endpoint except `/healthz`.
- **Content-Type:** `application/json` on write requests.

## Endpoints

### `GET /healthz`

No auth. Liveness probe.

```json
{ "ok": true }
```

### `GET /channels`

List all subscriptions, flattened across presets.

```json
{
  "channels": [
    {
      "preset": "Jellyfin TV Show",
      "name": "Example Channel",
      "url": "https://www.youtube.com/@example",
      "overrides": {
        "only_recent_date_range": "14days",
        "only_recent_max_files": 10
      }
    }
  ]
}
```

### `GET /channels?url=<youtube_url>`

The extension's primary "is this channel backed up?" check.

- **200** — subscribed.
  ```json
  {
    "subscribed": true,
    "preset": "Jellyfin TV Show",
    "name": "Example Channel",
    "url": "https://www.youtube.com/@example",
    "overrides": { "only_recent_date_range": "14days" }
  }
  ```
- **404** — not subscribed.
  ```json
  { "subscribed": false, "normalized": "https://youtube.com/@example" }
  ```

URL matching uses a normalizer (lowercased host, `www.` stripped,
trailing `/` and path suffixes `/videos`, `/featured`, `/streams`,
`/playlists`, `/shorts`, `/community`, `/about` stripped). `@handle` vs
`/channel/UCxxx` forms **do not cross-match** — the extension sends
whatever form `<link rel="canonical">` resolved to.

### `POST /channels`

Add a subscription. Request:

```json
{
  "url": "https://www.youtube.com/@example",
  "name": "Example Channel",
  "keep_days": 14,
  "max_files": 10,
  "preset": "Jellyfin TV Show",
  "skip_shorts": true,
  "skip_premium": false,
  "match_filters": [
    "original_url!*=/shorts/ & duration > 60"
  ]
}
```

All fields except `url` are optional:

- `name` — display name in YAML. Defaults to the last URL path segment.
- `keep_days` — translates to `only_recent_date_range: "{n}days"`.
- `max_files` — translates to `only_recent_max_files: n`.
- `preset` — top-level YAML key. Defaults to `DEFAULT_PRESET` env var
  (server-side; the stack ships `"Jellyfin TV Show"`).
- `skip_shorts` / `skip_premium` — booleans capturing the user intent.
  Kept on the body so the server can round-trip them back in
  `GET /channels`.
- `match_filters` — array of yt-dlp `--match-filter` expression
  strings. The extension builds this client-side from the checkbox
  state (and merges in any `match_filters` defined by the selected
  preset's `overrides`). The server should write them under the
  channel's `overrides` so ytdl-sub forwards them to yt-dlp — e.g.
  `overrides.youtube_video_match_filters` in your preset's
  `ytdl_options.match_filter` plumbing.

### Built-in rule strings

| Flag           | Filter expression sent in `match_filters`     |
| -------------- | --------------------------------------------- |
| `skip_shorts`  | `original_url!*=/shorts/ & duration > 60`     |
| `skip_premium` | `availability=public`                         |

Presets returned by `GET /presets` may carry `skip_shorts` /
`skip_premium` booleans **and/or** a `match_filters` array inside
their `overrides` block. The extension:

1. pre-fills the checkboxes from the boolean overrides, and
2. unions the preset's `match_filters` with the rules implied by the
   checkbox state when posting `POST /channels`.

Responses:

- **201** — created. Body: `{ "added": { preset, name, url, overrides? } }`.
- **400** — `url required`.
- **409** — `already subscribed`; body includes `existing`.

### `DELETE /channels/<name>`

Remove by display name. Walks all presets. Returns **200** with the
deleted entry or **404** if no preset contains that name.

### `POST /videos/lookup`

Batch "is this video archived?" check used by the content script to
overlay a green check on thumbnails of already-downloaded videos
across the homepage, search results, and watch-page sidebar.

Request:

```json
{ "ids": ["dQw4w9WgXcQ", "abc12345678", "..."] }
```

Response (`200`):

```json
{
  "archived": {
    "dQw4w9WgXcQ": { "archived": true, "path": "...", "mtime": 1714946400 },
    "abc12345678": { "archived": false }
  }
}
```

The extension only reads `archived[id].archived` (boolean). Missing
keys are treated as not archived. The server is expected to glob the
ytdl-sub output dir for filenames containing each `videoId` (yt-dlp's
default `%(id)s` pattern) and return a hit when found.

The extension caches results for 5 minutes per `id`, deduplicates
in-flight requests, and silently no-ops if the endpoint is not
implemented yet — so it is safe to ship the extension before the
server side.

### `POST /run`

Server endpoint that triggers an immediate pull via
`docker exec ytdl-sub ytdl-sub sub /config/subscriptions.yaml`.

The extension does **not** call this. As of 2026.4.9 the extension only
writes registry entries (`POST /channels`) and lets downloads happen on
whatever schedule the server runs (ofelia cron, manual operator action,
etc.). Pulling is a server-side concern.

## Client-side conventions

The extension's background wrapper (`background.js`) returns
`{ ok, status, data }` for every request, including non-2xx — the UI
layer distinguishes "subscribed" (200) from "not subscribed" (404)
rather than treating 404 as an error.

Error messages from the server come back as `{ "error": "..." }` in the
body; the extension surfaces `data.error` in the inline card and popup.

