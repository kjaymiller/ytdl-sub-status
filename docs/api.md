# ytdl-sub-api reference

This extension is a thin client over [`scripts/ytdl-sub-api/api.py`][api-src]
in the homelab repo. Endpoints documented here reflect what the
extension relies on; treat the server source as authoritative.

- **Base URL:** user-configured in the options page (no hardcoded
  default). The reference homelab deployment is tailnet-only; your
  deployment may differ.
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
  "preset": "Jellyfin TV Show"
}
```

All fields except `url` are optional:

- `name` — display name in YAML. Defaults to the last URL path segment.
- `keep_days` — translates to `only_recent_date_range: "{n}days"`.
- `max_files` — translates to `only_recent_max_files: n`.
- `preset` — top-level YAML key. Defaults to `DEFAULT_PRESET` env var
  (server-side; the stack ships `"Jellyfin TV Show"`).

Responses:

- **201** — created. Body: `{ "added": { preset, name, url, overrides? } }`.
- **400** — `url required`.
- **409** — `already subscribed`; body includes `existing`.

### `DELETE /channels/<name>`

Remove by display name. Walks all presets. Returns **200** with the
deleted entry or **404** if no preset contains that name.

### `POST /run`

Trigger an immediate pull via `docker exec ytdl-sub ytdl-sub sub /config/subscriptions.yaml`.

```json
{
  "exit_code": 0,
  "output_tail": "…last 4 KB of combined stdout+stderr…"
}
```

- **503** — `container ytdl-sub not running`.
- **500** — any other docker or exec error.

The extension chains this after a successful `POST /channels` when the
user clicks **Sub + pull**, so a new subscription is downloaded without
waiting for the hourly ofelia tick.

## Client-side conventions

The extension's background wrapper (`background.js`) returns
`{ ok, status, data }` for every request, including non-2xx — the UI
layer distinguishes "subscribed" (200) from "not subscribed" (404)
rather than treating 404 as an error.

Error messages from the server come back as `{ "error": "..." }` in the
body; the extension surfaces `data.error` in the inline card and popup.

[api-src]: https://github.com/kjaymiller/homelab/blob/main/scripts/ytdl-sub-api/api.py
