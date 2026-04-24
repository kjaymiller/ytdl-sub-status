# Packaging and signing

## Build

```
python3 scripts/build.py
```

Produces `web-ext-artifacts/ytdl-sub-status-<version>.zip`. The script
reads the version from `manifest.json`, ships only the runtime files
(manifest, background, content, popup, options, icons, `_locales` if
present), and excludes docs, tests, the build script itself, and VCS
cruft.

No node / `web-ext` needed — it's a ~40-line stdlib zipfile builder.

## Load as a package (unsigned)

The zip can be loaded as a temporary add-on for testing:

1. Firefox → `about:debugging` → This Firefox → **Load Temporary Add-on**.
2. Select the built `.zip` directly (Firefox also accepts the unpacked
   `manifest.json` — either works).

Temporary add-ons unload when Firefox quits. Private browsing and the
default release channel do not allow persistent unsigned installs.

### Persistent unsigned install (dev / nightly only)

On Firefox **Developer Edition**, **Nightly**, or **Unbranded** builds:

1. `about:config` → `xpinstall.signatures.required` → `false`.
2. Install the `.zip` (or rename to `.xpi`) via `about:addons` → gear
   icon → **Install Add-on From File**.

This does not work on release Firefox or ESR. For those, sign via AMO.

## Sign via AMO

For a persistent, release-Firefox install, submit to
[addons.mozilla.org](https://addons.mozilla.org/developers/).

### Self-hosted (recommended for a private repo)

Choose **"On your own"** at submission. Mozilla signs the `.xpi`
without listing it in the public directory.

1. Log in at https://addons.mozilla.org/developers/.
2. **Submit a new add-on** → **On your own**.
3. Upload `web-ext-artifacts/ytdl-sub-status-<version>.zip`.
4. Fill in source-code disclosure if prompted (no minified / bundled
   code, so "my add-on uses only vanilla JS / CSS / HTML" applies).
5. Wait for review (usually minutes for small extensions with no
   remote code). Download the signed `.xpi`.
6. Install via `about:addons` → **Install Add-on From File**.

The signed `.xpi` auto-updates only if you ship an `update_url` in the
manifest pointing at a self-hosted update manifest. Without that, each
new version is a manual re-download and install.

### Listed on AMO

Not planned — the extension is useless without the private homelab
API it talks to. Skip unless that changes.

## web-ext (optional)

If/when node is available:

```
npm i -D web-ext
npx web-ext lint              # MV3 + AMO policy checks
npx web-ext build             # same zip, different tool
npx web-ext sign --api-key=<jwt-issuer> --api-secret=<jwt-secret>
```

`web-ext sign` automates AMO submission with API credentials from
https://addons.mozilla.org/developers/addon/api/key/. Not worth setting
up for infrequent releases; the manual upload above is fine.

## Versioning and re-signing

Mozilla requires each uploaded `.xpi` to have a strictly-increasing
`manifest.json` version. Our CalVer scheme (`YYYY.MINOR.PATCH`) sorts
correctly for AMO's parser. Do not re-upload the same version — bump
PATCH (or higher) and rebuild first.

## Checklist before uploading

- [ ] `manifest.json` version bumped and matches the intended git tag.
- [ ] `python3 scripts/build.py` ran clean.
- [ ] Zip loads cleanly as a temporary add-on (sanity check the popup
      and inline card against a real YouTube channel).
- [ ] No secrets in committed files (`.env` isn't in the zip; check
      `scripts/build.py` output if in doubt).
- [ ] Git tag `v<version>` created after the successful build.
