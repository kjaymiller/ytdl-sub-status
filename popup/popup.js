const $ = (sel) => document.querySelector(sel);
const badge = $("#badge");
const ctxEl = $("#context");
const detailsEl = $("#details");
const formEl = $("#subscribe-form");
const errEl = $("#error");
const needsCfgEl = $("#needs-config");

async function isConfigured() {
  const { apiBase, apiToken } = await browser.storage.local.get({ apiBase: "", apiToken: "" });
  return !!(apiBase && apiToken);
}

function showNeedsConfig() {
  needsCfgEl.hidden = false;
  ctxEl.hidden = true;
  detailsEl.hidden = true;
  formEl.hidden = true;
  errEl.hidden = true;
  setBadge("unknown", "not configured");
}

let channelUrl = null;
let channelUrls = [];

function setBadge(kind, text) {
  badge.className = `badge badge-${kind}`;
  badge.textContent = text;
}

function showError(msg) {
  errEl.hidden = false;
  errEl.textContent = msg;
}

function clearError() {
  errEl.hidden = true;
  errEl.textContent = "";
}

async function send(msg) {
  const res = await browser.runtime.sendMessage(msg);
  if (res?.error) throw new Error(res.error);
  return res;
}

async function getActiveTabContext() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/youtube\.com/.test(tab.url || "")) {
    return { isChannel: false, tab };
  }
  try {
    const ctx = await browser.tabs.sendMessage(tab.id, { type: "getChannelContext" });
    return { ...ctx, tab };
  } catch {
    return { isChannel: false, tab };
  }
}

function relTime(unixSecs) {
  if (!unixSecs) return "never";
  const ago = Date.now() / 1000 - unixSecs;
  if (ago < 60) return "just now";
  if (ago < 3600) return `${Math.floor(ago / 60)}m ago`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h ago`;
  return `${Math.floor(ago / 86400)}d ago`;
}

function describeDownloads(d) {
  if (!d) return "(no on-disk match)";
  const n = d.file_count ?? 0;
  if (!n) return "no files";
  return `${n} file${n === 1 ? "" : "s"}, last ${relTime(d.latest_mtime)}`;
}

function renderSubscribed(sub) {
  detailsEl.hidden = false;
  formEl.hidden = true;
  $("#sub-name").textContent = sub.name || "—";
  $("#sub-preset").textContent = sub.preset || "—";
  $("#sub-url").textContent = sub.url || "—";
  const ov = sub.overrides ? JSON.stringify(sub.overrides) : "(none)";
  $("#sub-overrides").textContent = ov;
  $("#sub-downloads").textContent = describeDownloads(sub.downloads);
}

let presetsLoaded = false;
const presetDetails = new Map();

function buildPresetChoices(data) {
  const base = data?.base_preset || data?.default_preset || "";
  const profileDetails = data?.profile_details || {};
  const sep = " | ";
  const choices = [];
  const presetList = Array.isArray(data?.presets) ? data.presets : null;
  if (presetList && presetList.length) {
    for (const p of presetList) {
      let label = p;
      let profile = null;
      if (base && p === base) label = `${p} (default)`;
      else if (base && p.startsWith(base + sep)) {
        profile = p.slice(base.length + sep.length);
        label = profile;
      }
      choices.push({ value: p, label, details: profile ? profileDetails[profile] : null });
    }
  } else {
    const profiles = data?.profiles || [];
    if (base) choices.push({ value: base, label: `${base} (default)`, details: null });
    for (const p of profiles) {
      choices.push({
        value: base ? `${base}${sep}${p}` : p,
        label: p,
        details: profileDetails[p] || null,
      });
    }
  }
  return choices;
}

function humanizeKey(k) {
  return k.replace(/^only_recent_/, "").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function renderPresetDetail(host, details) {
  host.replaceChildren();
  const parents = details?.parents || [];
  const overrides = details?.overrides || {};
  const keys = Object.keys(overrides);
  if (!parents.length && !keys.length) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  if (parents.length) {
    const row = document.createElement("div");
    const strong = document.createElement("strong");
    strong.textContent = "Inherits: ";
    row.appendChild(strong);
    row.appendChild(document.createTextNode(parents.join(" → ")));
    host.appendChild(row);
  }
  if (keys.length) {
    const dl = document.createElement("dl");
    for (const k of keys) {
      const dt = document.createElement("dt");
      dt.textContent = humanizeKey(k);
      const dd = document.createElement("dd");
      dd.textContent = String(overrides[k]);
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    host.appendChild(dl);
  }
}

function parseDays(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = v.match(/^\s*(\d+)\s*(d|day|days)?\s*$/i);
  return m ? Number(m[1]) : null;
}

function applyPresetOverrides(details) {
  const ov = details?.overrides || {};
  const keepEl = $("#f-keep");
  const maxEl = $("#f-max");
  const days = parseDays(ov.only_recent_date_range);
  if (keepEl && days != null) keepEl.value = String(days);
  if (maxEl && ov.only_recent_max_files != null) maxEl.value = String(ov.only_recent_max_files);
}

function refreshPresetDetail() {
  const sel = $("#f-preset");
  const host = $("#f-preset-detail");
  if (!host) return;
  if (!sel || sel.tagName !== "SELECT") {
    host.hidden = true;
    return;
  }
  const details = presetDetails.get(sel.value);
  renderPresetDetail(host, details);
  applyPresetOverrides(details);
}

async function loadPresets() {
  if (presetsLoaded) return;
  const sel = $("#f-preset");
  if (!sel || sel.tagName !== "SELECT") return;
  try {
    const res = await send({ type: "listPresets" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const choices = buildPresetChoices(res.data);
    if (!choices.length) throw new Error("empty");
    const { defaultPreset } = await browser.storage.local.get({ defaultPreset: "" });
    sel.replaceChildren();
    presetDetails.clear();
    let matched = false;
    for (const c of choices) {
      const opt = document.createElement("option");
      opt.value = c.value;
      opt.textContent = c.label;
      if (c.value === defaultPreset) { opt.selected = true; matched = true; }
      sel.appendChild(opt);
      if (c.details) presetDetails.set(c.value, c.details);
    }
    if (defaultPreset && !matched) {
      const opt = document.createElement("option");
      opt.value = defaultPreset;
      opt.textContent = `${defaultPreset} (saved)`;
      opt.selected = true;
      sel.prepend(opt);
    }
    sel.addEventListener("change", refreshPresetDetail);
    refreshPresetDetail();
    presetsLoaded = true;
  } catch {
    // Older API or unreachable — swap the <select> for a plain text input.
    const input = document.createElement("input");
    input.id = "f-preset";
    input.value = "Jellyfin TV Show";
    sel.replaceWith(input);
    const detail = $("#f-preset-detail");
    if (detail) detail.hidden = true;
    const { defaultPreset } = await browser.storage.local.get({ defaultPreset: "" });
    if (defaultPreset) input.value = defaultPreset;
    presetsLoaded = true;
  }
}

function renderUnsubscribed() {
  detailsEl.hidden = true;
  formEl.hidden = false;
}

async function refreshStatus() {
  clearError();
  if (!(await isConfigured())) {
    showNeedsConfig();
    return;
  }
  needsCfgEl.hidden = true;
  ctxEl.hidden = false;
  const ctx = await getActiveTabContext();
  if (!ctx?.isChannel) {
    setBadge("unknown", "not a channel");
    ctxEl.textContent = "Open a YouTube channel page to check its backup status.";
    detailsEl.hidden = true;
    formEl.hidden = true;
    return;
  }
  channelUrls = ctx.urls && ctx.urls.length ? ctx.urls : [ctx.url];
  channelUrl = channelUrls[0];
  ctxEl.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = ctx.title || "(channel)";
  const urlSpan = document.createElement("span");
  urlSpan.className = "mono";
  urlSpan.textContent = channelUrl;
  ctxEl.append(strong, document.createElement("br"), urlSpan);

  setBadge("unknown", "checking…");
  try {
    let res = null;
    for (const url of channelUrls) {
      res = await send({ type: "check", url });
      if (res.status === 200 && res.data?.subscribed) break;
      if (res.status !== 404) break;
    }
    if (res.status === 200 && res.data?.subscribed) {
      setBadge("yes", "backed up");
      renderSubscribed(res.data);
    } else if (res.status === 404) {
      setBadge("no", "not backed up");
      $("#f-name").value = "";
      renderUnsubscribed();
      await loadPresets();
    } else {
      setBadge("err", `err ${res.status}`);
      showError(JSON.stringify(res.data));
    }
  } catch (err) {
    setBadge("err", "error");
    showError(err.message);
  }
}

async function onSubscribe({ runAfter = false } = {}) {
  clearError();
  try {
    const res = await send({
      type: "subscribe",
      url: channelUrl,
      name: $("#f-name").value.trim() || undefined,
      keepDays: Number($("#f-keep").value) || undefined,
      maxFiles: Number($("#f-max").value) || undefined,
      preset: $("#f-preset").value.trim() || undefined,
    });
    if (!res.ok) throw new Error(res.data?.error || `status ${res.status}`);
    if (runAfter) {
      await send({ type: "runNow" });
    }
    await refreshStatus();
  } catch (err) {
    setBadge("err", "error");
    showError(err.message);
  }
}

async function onUnsubscribe() {
  clearError();
  const name = $("#sub-name").textContent;
  if (!name || name === "—") return;
  if (!confirm(`Unsubscribe "${name}"?`)) return;
  try {
    const res = await send({ type: "unsubscribe", name });
    if (!res.ok) throw new Error(res.data?.error || `status ${res.status}`);
    await refreshStatus();
  } catch (err) {
    setBadge("err", "error");
    showError(err.message);
  }
}

async function onRunNow() {
  clearError();
  const btn = $("#run-btn");
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Pulling…";
  try {
    const res = await send({ type: "runNow" });
    if (!res.ok) throw new Error(res.data?.error || `status ${res.status}`);
    btn.textContent = `Exit ${res.data?.exit_code ?? "?"}`;
    setTimeout(() => { btn.textContent = was; btn.disabled = false; }, 2000);
  } catch (err) {
    btn.textContent = was;
    btn.disabled = false;
    showError(err.message);
  }
}

$("#sub-btn").addEventListener("click", () => onSubscribe({ runAfter: false }));
$("#sub-run-btn").addEventListener("click", () => onSubscribe({ runAfter: true }));
$("#unsub-btn").addEventListener("click", onUnsubscribe);
$("#run-btn").addEventListener("click", onRunNow);
$("#open-options").addEventListener("click", (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});
$("#open-settings-btn").addEventListener("click", () => browser.runtime.openOptionsPage());

function originPattern(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}

$("#cfg-save-btn").addEventListener("click", async () => {
  clearError();
  const apiBase = $("#cfg-base").value.trim().replace(/\/+$/, "");
  const apiToken = $("#cfg-token").value.trim();
  if (!apiBase || !apiToken) {
    showError("Both fields are required.");
    return;
  }
  const pattern = originPattern(apiBase);
  if (!pattern) {
    showError("API base URL is not a valid URL.");
    return;
  }
  try {
    const granted = await browser.permissions.request({ origins: [pattern] });
    if (!granted) throw new Error(`Host permission for ${pattern} was denied.`);
    await browser.storage.local.set({ apiBase, apiToken });
    await refreshStatus();
  } catch (err) {
    showError(err.message);
  }
});

browser.storage.local.get(["defaultKeepDays", "defaultMaxFiles"]).then((s) => {
  if (s.defaultKeepDays) $("#f-keep").value = s.defaultKeepDays;
  if (s.defaultMaxFiles) $("#f-max").value = s.defaultMaxFiles;
  // defaultPreset is applied inside loadPresets() once the dropdown is built.
});

refreshStatus();
