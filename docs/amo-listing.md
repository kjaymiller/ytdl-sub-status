# AMO listing copy

Paste-ready content for the addons.mozilla.org submission form.

## Summary (≤250 chars)

Shows whether the YouTube channel you're viewing is already backed up by your self-hosted ytdl-sub archiver — and lets you subscribe new channels in one click. Requires a ytdl-sub-api server you control.

## Description

ytdl-sub status is a companion for the self-hosted ytdl-sub archiver. While you browse YouTube, it asks *your own* ytdl-sub-api server whether the current channel is already being archived, and shows the result as a small floating card on the page (and in the toolbar popup).

**What it does**

- Detects YouTube channel pages (`/@handle`, `/channel/UCxxx`, `/c/name`, `/user/name`).
- Looks up the channel against your ytdl-sub-api and shows a status dot:
  - green — backed up; shows name, preset, and retention, with *Pull now* and *Unsubscribe* actions.
  - grey — not backed up; shows a one-click subscribe form with keep-days, max-files, and preset.
  - red — error (misconfigured, unreachable, auth failure).
- *Sub + pull* subscribes and immediately triggers a fetch, instead of waiting for the scheduled run.

**Setup**

You need a running ytdl-sub-api server and a bearer token. On first launch the popup walks you through entering your API base URL and token. Firefox will prompt you to grant host permission for that URL — accept it so the extension can reach your server.

**Privacy**

- No analytics, no telemetry, no third-party calls.
- All network traffic goes to the API base URL *you* configure and nowhere else.
- Your bearer token is stored in `browser.storage.local` and is only read by the extension's background script. It is never exposed to page scripts.
- Channel detection runs locally against the YouTube tab you have open.

**Requirements**

- A ytdl-sub-api server you control (the reference implementation is linked from the project's GitHub repo).
- A bearer token that your API validates.

**Source / issues**

Source code, docs, and issue tracker: https://github.com/kjaymiller/ytdl-sub-status (MIT-licensed).
