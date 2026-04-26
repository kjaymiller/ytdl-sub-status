const FIELDS = ["apiBase", "apiToken", "defaultPreset", "defaultKeepDays", "defaultMaxFiles"];
const $ = (id) => document.getElementById(id);
const status = $("status");

async function loadPresets(stored) {
  const sel = $("defaultPreset");
  if (!sel || sel.tagName !== "SELECT") return;
  try {
    const res = await browser.runtime.sendMessage({ type: "listPresets" });
    if (!res?.ok) throw new Error(`status ${res?.status}`);
    const base = res.data?.default_preset || res.data?.base_preset || "";
    const profiles = res.data?.profiles || [];
    const choices = [];
    if (base) choices.push({ value: base, label: `${base} (default)` });
    for (const p of profiles) {
      choices.push({ value: base ? `${base} | ${p}` : p, label: p });
    }
    if (!choices.length) throw new Error("empty");
    sel.replaceChildren();
    const saved = stored.defaultPreset || "";
    let matched = false;
    for (const c of choices) {
      const opt = document.createElement("option");
      opt.value = c.value;
      opt.textContent = c.label;
      if (c.value === saved) { opt.selected = true; matched = true; }
      sel.appendChild(opt);
    }
    if (saved && !matched) {
      const opt = document.createElement("option");
      opt.value = saved;
      opt.textContent = `${saved} (saved, not in API list)`;
      opt.selected = true;
      sel.prepend(opt);
    }
  } catch {
    // API unreachable or older — swap to a plain text input.
    const input = document.createElement("input");
    input.id = "defaultPreset";
    input.value = stored.defaultPreset || "Jellyfin TV Show";
    sel.replaceWith(input);
  }
}

async function load() {
  const stored = await browser.storage.local.get(FIELDS);
  for (const k of FIELDS) {
    if (k === "defaultPreset") continue;
    if (stored[k] !== undefined && stored[k] !== null) $(k).value = stored[k];
  }
  await loadPresets(stored);
}

function originPattern(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

async function ensureHostPermission(baseUrl) {
  const pattern = originPattern(baseUrl);
  if (!pattern) throw new Error(`Invalid base URL: ${baseUrl}`);
  const granted = await browser.permissions.request({ origins: [pattern] });
  if (!granted) throw new Error(`Host permission for ${pattern} was denied. The extension needs this to reach the API.`);
  return true;
}

async function save() {
  const payload = {};
  for (const k of FIELDS) {
    const v = $(k).value.trim();
    if (k === "defaultKeepDays" || k === "defaultMaxFiles") {
      payload[k] = v ? Number(v) : undefined;
    } else {
      payload[k] = v;
    }
  }
  status.className = "";
  status.textContent = "";
  try {
    if (payload.apiBase) await ensureHostPermission(payload.apiBase);
    await browser.storage.local.set(payload);
    status.className = "ok";
    status.textContent = "Saved.";
  } catch (err) {
    status.className = "err";
    status.textContent = err.message;
  }
}

async function test() {
  status.className = "";
  status.textContent = "Testing…";
  try {
    const health = await browser.runtime.sendMessage({ type: "healthz" });
    if (!health.ok) throw new Error(`/healthz returned ${health.status}`);
    const list = await browser.runtime.sendMessage({ type: "list" });
    if (list?.error) throw new Error(list.error);
    if (!list.ok) throw new Error(`/channels returned ${list.status}: ${JSON.stringify(list.data)}`);
    const n = (list.data?.channels || []).length;
    status.className = "ok";
    status.textContent = `OK — ${n} subscription${n === 1 ? "" : "s"} visible.`;
  } catch (err) {
    status.className = "err";
    status.textContent = `Failed: ${err.message}`;
  }
}

$("save").addEventListener("click", save);
$("test").addEventListener("click", test);
load();
