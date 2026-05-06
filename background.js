// Named yt-dlp match-filter rules. Each value is a yt-dlp `--match-filter`
// expression — ytdl-sub passes these straight to yt-dlp. The server is
// expected to write them under each channel's
// `overrides.youtube_video_match_filters` (or equivalent).
const FILTER_RULES = {
  skip_shorts: "original_url!*=/shorts/ & duration > 60",
  skip_premium: "availability=public",
};

function buildMatchFilters({ skipShorts, skipPremium }) {
  const out = [];
  if (skipShorts) out.push(FILTER_RULES.skip_shorts);
  if (skipPremium) out.push(FILTER_RULES.skip_premium);
  return out;
}

const DEFAULTS = {
  apiBase: "",
  apiToken: "",
  defaultKeepDays: 14,
  defaultMaxFiles: 10,
  defaultPreset: "Jellyfin TV Show",
  defaultSkipShorts: false,
  defaultSkipPremium: false,
};

async function getSettings() {
  const stored = await browser.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const { apiBase, apiToken } = await getSettings();
  if (!apiBase) throw new Error("API base URL not configured — open the extension's options page.");
  if (!apiToken) throw new Error("API token not configured — open the extension's options page.");
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

const HANDLERS = {
  async check({ url }) {
    return apiFetch(`/channels?url=${encodeURIComponent(url)}`);
  },
  async list() {
    return apiFetch(`/channels`);
  },
  async listPresets() {
    return apiFetch(`/presets`);
  },
  async subscribe({ url, name, keepDays, maxFiles, preset, skipShorts, skipPremium, presetMatchFilters }) {
    const settings = await getSettings();
    const wantShorts = skipShorts ?? settings.defaultSkipShorts;
    const wantPremium = skipPremium ?? settings.defaultSkipPremium;
    const seen = new Set();
    const matchFilters = [];
    for (const f of [...buildMatchFilters({ skipShorts: wantShorts, skipPremium: wantPremium }),
                     ...(Array.isArray(presetMatchFilters) ? presetMatchFilters : [])]) {
      if (typeof f === "string" && f.trim() && !seen.has(f)) {
        seen.add(f);
        matchFilters.push(f);
      }
    }
    const body = {
      url,
      keep_days: keepDays ?? settings.defaultKeepDays,
      max_files: maxFiles ?? settings.defaultMaxFiles,
      preset: preset || settings.defaultPreset,
      skip_shorts: wantShorts,
      skip_premium: wantPremium,
      match_filters: matchFilters,
    };
    if (name) body.name = name;
    return apiFetch(`/channels`, { method: "POST", body });
  },
  async lookupVideos({ ids }) {
    if (!Array.isArray(ids) || !ids.length) return { ok: true, status: 200, data: { archived: {} } };
    return apiFetch(`/videos/lookup`, { method: "POST", body: { ids } });
  },
  async unsubscribe({ name }) {
    return apiFetch(`/channels/${encodeURIComponent(name)}`, { method: "DELETE" });
  },
  async healthz() {
    const { apiBase } = await getSettings();
    if (!apiBase) throw new Error("API base URL not configured — open the extension's options page.");
    const res = await fetch(`${apiBase}/healthz`);
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  },
};

browser.runtime.onMessage.addListener((msg) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) return Promise.resolve({ ok: false, error: `unknown message: ${msg?.type}` });
  return handler(msg).catch((err) => ({ ok: false, error: String(err.message || err) }));
});
