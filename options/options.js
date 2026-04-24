const FIELDS = ["apiBase", "apiToken", "defaultPreset", "defaultKeepDays", "defaultMaxFiles"];
const $ = (id) => document.getElementById(id);
const status = $("status");

async function load() {
  const stored = await browser.storage.local.get(FIELDS);
  for (const k of FIELDS) {
    if (stored[k] !== undefined && stored[k] !== null) $(k).value = stored[k];
  }
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
  const already = await browser.permissions.contains({ origins: [pattern] });
  if (already) return true;
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
