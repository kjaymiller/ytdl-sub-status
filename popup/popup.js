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

function renderSubscribed(sub) {
  detailsEl.hidden = false;
  formEl.hidden = true;
  $("#sub-name").textContent = sub.name || "—";
  $("#sub-preset").textContent = sub.preset || "—";
  $("#sub-url").textContent = sub.url || "—";
  const ov = sub.overrides ? JSON.stringify(sub.overrides) : "(none)";
  $("#sub-overrides").textContent = ov;
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
    const already = await browser.permissions.contains({ origins: [pattern] });
    if (!already) {
      const granted = await browser.permissions.request({ origins: [pattern] });
      if (!granted) throw new Error(`Host permission for ${pattern} was denied.`);
    }
    await browser.storage.local.set({ apiBase, apiToken });
    await refreshStatus();
  } catch (err) {
    showError(err.message);
  }
});

browser.storage.local.get(["defaultKeepDays", "defaultMaxFiles", "defaultPreset"]).then((s) => {
  if (s.defaultKeepDays) $("#f-keep").value = s.defaultKeepDays;
  if (s.defaultMaxFiles) $("#f-max").value = s.defaultMaxFiles;
  if (s.defaultPreset) $("#f-preset").value = s.defaultPreset;
});

refreshStatus();
