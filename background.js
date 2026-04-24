const DEFAULTS = {
  apiBase: "https://ytdl-sub.kjaymiller.dev",
  apiToken: "",
  defaultKeepDays: 14,
  defaultMaxFiles: 10,
  defaultPreset: "Jellyfin TV Show",
};

async function getSettings() {
  const stored = await browser.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function apiFetch(path, { method = "GET", body } = {}) {
  const { apiBase, apiToken } = await getSettings();
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
  async subscribe({ url, name, keepDays, maxFiles, preset }) {
    const settings = await getSettings();
    const body = {
      url,
      keep_days: keepDays ?? settings.defaultKeepDays,
      max_files: maxFiles ?? settings.defaultMaxFiles,
      preset: preset || settings.defaultPreset,
    };
    if (name) body.name = name;
    return apiFetch(`/channels`, { method: "POST", body });
  },
  async unsubscribe({ name }) {
    return apiFetch(`/channels/${encodeURIComponent(name)}`, { method: "DELETE" });
  },
  async runNow() {
    return apiFetch(`/run`, { method: "POST" });
  },
  async healthz() {
    const { apiBase } = await getSettings();
    const res = await fetch(`${apiBase}/healthz`);
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  },
};

browser.runtime.onMessage.addListener((msg) => {
  const handler = HANDLERS[msg?.type];
  if (!handler) return Promise.resolve({ ok: false, error: `unknown message: ${msg?.type}` });
  return handler(msg).catch((err) => ({ ok: false, error: String(err.message || err) }));
});
