const CHANNEL_PATH_RE = /^\/(?:@[^\/]+|channel\/UC[\w-]+|c\/[^\/]+|user\/[^\/]+)(?:\/.*)?$/;
const HOST_ID = "ytdl-sub-status-host";

function isChannelPage() {
  return CHANNEL_PATH_RE.test(location.pathname);
}

const URL_SUFFIX_RE = /\/(videos|featured|streams|playlists|shorts|community|about)\/?$/;

function pagePathUrl() {
  return location.origin + location.pathname.replace(URL_SUFFIX_RE, "");
}

function linkCanonicalUrl() {
  const link = document.querySelector('link[rel="canonical"]');
  if (link?.href && /youtube\.com\/(?:@|channel\/|c\/|user\/)/.test(link.href)) {
    return link.href;
  }
  const og = document.querySelector('meta[property="og:url"]');
  if (og?.content) return og.content;
  return null;
}

function candidateChannelUrls() {
  const seen = new Set();
  const out = [];
  for (const u of [pagePathUrl(), linkCanonicalUrl()]) {
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

function canonicalChannelUrl() {
  return pagePathUrl();
}

function channelTitle() {
  return document.title.replace(/ - YouTube$/, "");
}

async function send(msg) {
  const res = await browser.runtime.sendMessage(msg);
  if (res?.error) throw new Error(res.error);
  return res;
}

const STYLE = `
  :host {
    position: fixed;
    top: 72px;
    right: 16px;
    z-index: 2147483647;
    font: 13px/1.4 system-ui, sans-serif;
    color: #1f1f1f;
  }
  .card {
    width: 300px;
    background: white;
    border: 1px solid #d8d8d8;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,.12);
    overflow: hidden;
  }
  .card.collapsed .body, .card.collapsed .details, .card.collapsed .form { display: none; }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    cursor: pointer;
    user-select: none;
    background: #fafafa;
    border-bottom: 1px solid #eee;
  }
  .card.collapsed header { border-bottom: none; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #bbb; flex: 0 0 auto; }
  .dot.yes { background: #2bb24c; }
  .dot.no { background: #999; }
  .dot.err { background: #d44; }
  .title { font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  .status { margin-left: auto; font-size: 11px; color: #666; }
  .body { padding: 10px; }
  .muted { color: #777; font-size: 12px; }
  .mono { font-family: ui-monospace, Menlo, monospace; font-size: 11px; word-break: break-all; color: #555; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 0 0 8px; }
  dt { color: #777; }
  dd { margin: 0; }
  label { display: block; margin: 6px 0; font-size: 12px; }
  label span { display: block; color: #555; margin-bottom: 2px; }
  input {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font: inherit;
    box-sizing: border-box;
  }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .row { display: flex; gap: 6px; margin-top: 8px; }
  button {
    flex: 1;
    padding: 5px 8px;
    border: 1px solid #bbb;
    background: white;
    border-radius: 3px;
    cursor: pointer;
    font: inherit;
  }
  button:hover { background: #f2f2f2; }
  button.primary { background: #2a6fdb; border-color: #2a6fdb; color: white; }
  button.primary:hover { background: #2059b5; }
  button.danger { color: #c04040; border-color: #c04040; }
  button.danger:hover { background: #fbeaea; }
  button:disabled { opacity: .6; cursor: default; }
  .err {
    background: #fbeaea;
    color: #8a1f1f;
    padding: 6px 8px;
    border-radius: 3px;
    margin-top: 6px;
    white-space: pre-wrap;
    font-size: 11px;
  }
  .close {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    color: #888;
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
  }
  .close:hover { color: #222; background: transparent; }
`;

const TEMPLATE = `
  <div class="card" part="card">
    <header>
      <span class="dot"></span>
      <span class="title">ytdl-sub</span>
      <span class="status">checking…</span>
      <button class="close" title="Hide">×</button>
    </header>
    <div class="body">
      <div class="context muted"></div>
      <div class="details" hidden>
        <dl>
          <dt>Name</dt><dd data-k="name">—</dd>
          <dt>Preset</dt><dd data-k="preset">—</dd>
          <dt>Retention</dt><dd data-k="overrides" class="mono">—</dd>
        </dl>
        <div class="row">
          <button data-act="run">Pull now</button>
          <button data-act="unsub" class="danger">Unsubscribe</button>
        </div>
      </div>
      <div class="form" hidden>
        <label><span>Name</span><input data-f="name" placeholder="(auto)"></label>
        <div class="grid2">
          <label><span>Keep days</span><input data-f="keep" type="number" min="1" value="14"></label>
          <label><span>Max files</span><input data-f="max" type="number" min="1" value="10"></label>
        </div>
        <label><span>Preset</span><input data-f="preset" value="Jellyfin TV Show"></label>
        <div class="row">
          <button data-act="sub" class="primary">Subscribe</button>
          <button data-act="sub-run">Sub + pull</button>
        </div>
      </div>
      <div class="err" hidden></div>
    </div>
  </div>
`;

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (host) return host;
  host = document.createElement("div");
  host.id = HOST_ID;
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  shadow.appendChild(style);
  const wrap = document.createElement("div");
  wrap.innerHTML = TEMPLATE;
  shadow.appendChild(wrap.firstElementChild);
  document.body.appendChild(host);
  wireHost(host);
  return host;
}

function removeHost() {
  const host = document.getElementById(HOST_ID);
  if (host) host.remove();
}

let currentUrl = null;

function $(host, sel) { return host.shadowRoot.querySelector(sel); }
function $$(host, sel) { return host.shadowRoot.querySelectorAll(sel); }

function setDot(host, kind, statusText) {
  const dot = $(host, ".dot");
  dot.classList.remove("yes", "no", "err");
  if (kind) dot.classList.add(kind);
  $(host, ".status").textContent = statusText;
}

function showError(host, msg) {
  const el = $(host, ".err");
  el.hidden = false;
  el.textContent = msg;
}

function clearError(host) {
  const el = $(host, ".err");
  el.hidden = true;
  el.textContent = "";
}

function showDetails(host, sub) {
  $(host, ".details").hidden = false;
  $(host, ".form").hidden = true;
  $(host, '[data-k="name"]').textContent = sub.name || "—";
  $(host, '[data-k="preset"]').textContent = sub.preset || "—";
  $(host, '[data-k="overrides"]').textContent = sub.overrides ? JSON.stringify(sub.overrides) : "(none)";
}

function showForm(host) {
  $(host, ".details").hidden = true;
  $(host, ".form").hidden = false;
}

function wireHost(host) {
  $(host, "header").addEventListener("click", (e) => {
    if (e.target.closest(".close")) return;
    $(host, ".card").classList.toggle("collapsed");
  });
  $(host, ".close").addEventListener("click", (e) => {
    e.stopPropagation();
    host.remove();
    sessionStorage.setItem("ytdl-sub-status:hidden", location.pathname);
  });
  host.shadowRoot.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    clearError(host);
    if (act === "run") return runNow(host, btn);
    if (act === "unsub") return unsubscribe(host);
    if (act === "sub") return subscribe(host, { runAfter: false });
    if (act === "sub-run") return subscribe(host, { runAfter: true });
  });
}

async function subscribe(host, { runAfter }) {
  try {
    const res = await send({
      type: "subscribe",
      url: currentUrl,
      name: $(host, '[data-f="name"]').value.trim() || undefined,
      keepDays: Number($(host, '[data-f="keep"]').value) || undefined,
      maxFiles: Number($(host, '[data-f="max"]').value) || undefined,
      preset: $(host, '[data-f="preset"]').value.trim() || undefined,
    });
    if (!res.ok) throw new Error(res.data?.error || `status ${res.status}`);
    if (runAfter) await send({ type: "runNow" });
    await refresh(host);
  } catch (err) {
    setDot(host, "err", "error");
    showError(host, err.message);
  }
}

async function unsubscribe(host) {
  const name = $(host, '[data-k="name"]').textContent;
  if (!name || name === "—") return;
  if (!confirm(`Unsubscribe "${name}"?`)) return;
  try {
    const res = await send({ type: "unsubscribe", name });
    if (!res.ok) throw new Error(res.data?.error || `status ${res.status}`);
    await refresh(host);
  } catch (err) {
    setDot(host, "err", "error");
    showError(host, err.message);
  }
}

async function runNow(host, btn) {
  const was = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Pulling…";
  try {
    const res = await send({ type: "runNow" });
    if (!res.ok) throw new Error(res.data?.error || `status ${res.status}`);
    btn.textContent = `Exit ${res.data?.exit_code ?? "?"}`;
    setTimeout(() => { btn.textContent = was; btn.disabled = false; }, 2500);
  } catch (err) {
    btn.textContent = was;
    btn.disabled = false;
    showError(host, err.message);
  }
}

async function hasToken() {
  const { apiToken } = await browser.storage.local.get({ apiToken: "" });
  return !!apiToken;
}

async function refresh(host) {
  clearError(host);
  if (!(await hasToken())) {
    setDot(host, "err", "not configured");
    $(host, ".details").hidden = true;
    $(host, ".form").hidden = true;
    $(host, ".context").innerHTML =
      `<span class="muted">No API token configured. Open the extension's settings to add your <code>API_TOKEN</code>.</span>`;
    return;
  }
  const title = channelTitle();
  const candidates = candidateChannelUrls();
  currentUrl = candidates[0] || canonicalChannelUrl();
  $(host, ".context").innerHTML = `<strong>${title}</strong><br><span class="mono">${currentUrl}</span>`;
  setDot(host, null, "checking…");
  try {
    let hit = null;
    let lastRes = null;
    for (const url of candidates) {
      const res = await send({ type: "check", url });
      lastRes = res;
      if (res.status === 200 && res.data?.subscribed) {
        hit = res;
        break;
      }
      if (res.status !== 404) break;
    }
    const res = hit || lastRes;
    if (res.status === 200 && res.data?.subscribed) {
      setDot(host, "yes", "backed up");
      showDetails(host, res.data);
    } else if (res.status === 404) {
      setDot(host, "no", "not backed up");
      $(host, '[data-f="name"]').value = "";
      showForm(host);
      const prefs = await browser.storage.local.get(["defaultKeepDays", "defaultMaxFiles", "defaultPreset"]);
      if (prefs.defaultKeepDays) $(host, '[data-f="keep"]').value = prefs.defaultKeepDays;
      if (prefs.defaultMaxFiles) $(host, '[data-f="max"]').value = prefs.defaultMaxFiles;
      if (prefs.defaultPreset) $(host, '[data-f="preset"]').value = prefs.defaultPreset;
    } else {
      setDot(host, "err", `err ${res.status}`);
      showError(host, typeof res.data === "string" ? res.data : JSON.stringify(res.data));
    }
  } catch (err) {
    setDot(host, "err", "error");
    showError(host, err.message);
  }
}

function sync() {
  if (!isChannelPage()) {
    removeHost();
    return;
  }
  if (sessionStorage.getItem("ytdl-sub-status:hidden") === location.pathname) return;
  const host = ensureHost();
  refresh(host);
}

let lastPath = location.pathname;
function onNav() {
  if (location.pathname === lastPath) return;
  lastPath = location.pathname;
  sync();
}

document.addEventListener("yt-navigate-finish", sync);
window.addEventListener("popstate", onNav);
setInterval(onNav, 1500);

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "getChannelContext") {
    const urls = candidateChannelUrls();
    return Promise.resolve({
      isChannel: isChannelPage(),
      url: urls[0] || canonicalChannelUrl(),
      urls,
      title: channelTitle(),
    });
  }
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", sync, { once: true });
} else {
  sync();
}
