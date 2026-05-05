const CHANNEL_PATH_RE = /^\/(?:@[^\/]+|channel\/UC[\w-]+|c\/[^\/]+|user\/[^\/]+)(?:\/.*)?$/;
const HOST_ID = "ytdl-sub-status-host";

function isChannelPage() {
  return CHANNEL_PATH_RE.test(location.pathname);
}

function isWatchPage() {
  return location.pathname === "/watch";
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

function normalizeChannelUrl(href) {
  if (!href) return null;
  try {
    const u = new URL(href, location.origin);
    if (!/(^|\.)youtube\.com$/i.test(u.hostname)) return null;
    if (!CHANNEL_PATH_RE.test(u.pathname)) return null;
    return u.origin + u.pathname.replace(URL_SUFFIX_RE, "");
  } catch {
    return null;
  }
}

async function send(msg) {
  const res = await browser.runtime.sendMessage(msg);
  if (res?.error) throw new Error(res.error);
  return res;
}

async function isConfigured() {
  const { apiBase, apiToken } = await browser.storage.local.get({ apiBase: "", apiToken: "" });
  return !!(apiBase && apiToken);
}

// ===== status cache (shared by floating card and inline badges) =====

const STATUS_TTL_MS = 60_000;
const statusCache = new Map(); // url -> {state: 'yes'|'no'|'err', ts}

async function getChannelStatus(url, { force } = {}) {
  if (!url) return "err";
  if (!(await isConfigured())) return "unconf";
  const cached = statusCache.get(url);
  if (!force && cached && Date.now() - cached.ts < STATUS_TTL_MS) return cached.state;
  try {
    const res = await send({ type: "check", url });
    let state;
    if (res.status === 200 && res.data?.subscribed) state = "yes";
    else if (res.status === 404) state = "no";
    else state = "err";
    statusCache.set(url, { state, ts: Date.now() });
    return state;
  } catch {
    statusCache.set(url, { state: "err", ts: Date.now() });
    return "err";
  }
}

function invalidateChannelStatus(url) {
  if (url) statusCache.delete(url);
}

function refreshBadgesForUrl(url) {
  if (!url) return;
  for (const badge of document.querySelectorAll(`.${BADGE_CLASS}`)) {
    if (badge.dataset.url === url) refreshBadge(badge, url);
  }
}

// ===== inline badges =====

const BADGE_CLASS = "ytdl-sub-status-badge";
const BADGE_STYLE_ID = "ytdl-sub-status-badge-style";

const SVG_NS = "http://www.w3.org/2000/svg";

function makeSvg(children) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  for (const c of children) svg.appendChild(c);
  return svg;
}

function svgPath(d) {
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("fill", "currentColor");
  p.setAttribute("d", d);
  return p;
}

function svgCircle(cx, cy, r) {
  const c = document.createElementNS(SVG_NS, "circle");
  c.setAttribute("cx", String(cx));
  c.setAttribute("cy", String(cy));
  c.setAttribute("r", String(r));
  c.setAttribute("fill", "currentColor");
  return c;
}

function iconCloudDown() {
  return makeSvg([svgPath("M19.35 10.04A7.49 7.49 0 0 0 12 4a7.5 7.5 0 0 0-6.98 4.78A5.5 5.5 0 0 0 6 19h13a4.5 4.5 0 0 0 .35-8.96zM13 13v3h-2v-3H8l4-4 4 4h-3z")]);
}

function iconCheck() {
  return makeSvg([svgPath("M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z")]);
}

function iconSpinner() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ytdl-sub-status-spin");
  const ring = document.createElementNS(SVG_NS, "circle");
  ring.setAttribute("cx", "12");
  ring.setAttribute("cy", "12");
  ring.setAttribute("r", "8");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "currentColor");
  ring.setAttribute("stroke-width", "2.5");
  ring.setAttribute("stroke-linecap", "round");
  ring.setAttribute("stroke-dasharray", "20 50");
  ring.setAttribute("opacity", "0.9");
  svg.appendChild(ring);
  return svg;
}

function iconQuestion() {
  return makeSvg([svgPath("M11 18h2v-2h-2v2zm1-16a8 8 0 0 0-8 8h2a6 6 0 1 1 9.6 4.8c-1.2.9-2.6 1.7-2.6 3.7V15h2v-.5c0-1.4 1-2 2.2-2.9A6 6 0 0 0 12 2z")]);
}

function ensureBadgeStyle() {
  if (document.getElementById(BADGE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = BADGE_STYLE_ID;
  style.textContent = `
    .${BADGE_CLASS} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      margin-left: 6px;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      background: transparent;
      color: var(--yt-spec-text-secondary, #aaa);
      cursor: pointer;
      border-radius: 50%;
      transition: background-color .15s, color .15s;
    }
    .${BADGE_CLASS}:hover { background: var(--yt-spec-badge-chip-background, rgba(127,127,127,.18)); }
    .${BADGE_CLASS}[data-state="yes"] { color: #2bb24c; }
    .${BADGE_CLASS}[data-state="no"] { color: #4a90e2; }
    .${BADGE_CLASS}[data-state="err"] { color: #d44; }
    .${BADGE_CLASS}[data-state="unconf"] { color: #e0a72b; }
    .${BADGE_CLASS}[data-state="loading"] { color: #888; }
    .${BADGE_CLASS} svg { display: block; }
    .${BADGE_CLASS} svg.ytdl-sub-status-spin {
      animation: ytdl-sub-status-spin 0.9s linear infinite;
      transform-origin: 50% 50%;
    }
    @keyframes ytdl-sub-status-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function setBadgeState(badge, state) {
  badge.dataset.state = state;
  let icon;
  let title;
  if (state === "yes") {
    icon = iconCheck();
    title = "Backed up by ytdl-sub — click to manage";
  } else if (state === "no") {
    icon = iconCloudDown();
    title = "Not backed up — click to subscribe";
  } else if (state === "unconf") {
    icon = iconQuestion();
    title = "ytdl-sub not configured — click to set up";
  } else if (state === "err") {
    icon = iconCloudDown();
    title = "ytdl-sub status unavailable — click for details";
  } else {
    icon = iconSpinner();
    title = "Checking ytdl-sub status…";
  }
  badge.replaceChildren(icon);
  badge.title = title;
  badge.setAttribute("aria-label", title);
}

function makeBadge(url, label) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = BADGE_CLASS;
  btn.dataset.url = url;
  if (label) btn.dataset.label = label;
  setBadgeState(btn, "loading");
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCardFor(btn.dataset.url, btn.dataset.label || "");
  });
  return btn;
}

async function refreshBadge(badge, url) {
  setBadgeState(badge, "loading");
  const state = await getChannelStatus(url);
  setBadgeState(badge, state);
}

function reuseOrCreateBadge(existing, url, label) {
  if (!existing) return { badge: makeBadge(url, label), isNew: true };
  if (existing.dataset.url !== url) {
    existing.dataset.url = url;
    if (label) existing.dataset.label = label;
    invalidateChannelStatus(url);
  }
  return { badge: existing, isNew: false };
}

function injectBadgeAfter(target, url, label) {
  if (!target || !target.parentElement) return;
  const parent = target.parentElement;
  const existing = parent.querySelector(`:scope > .${BADGE_CLASS}`);
  ensureBadgeStyle();
  const { badge, isNew } = reuseOrCreateBadge(existing, url, label);
  if (isNew) target.insertAdjacentElement("afterend", badge);
  refreshBadge(badge, url);
}

function injectBadgeInside(target, url, label) {
  if (!target) return;
  const existing = target.querySelector(`:scope > .${BADGE_CLASS}`);
  ensureBadgeStyle();
  const { badge, isNew } = reuseOrCreateBadge(existing, url, label);
  if (isNew) target.appendChild(badge);
  refreshBadge(badge, url);
}

function scanWatchPage() {
  if (!isWatchPage()) return;
  const anchors = document.querySelectorAll("ytd-video-owner-renderer ytd-channel-name a");
  for (const a of anchors) {
    const url = normalizeChannelUrl(a.href);
    if (!url) continue;
    injectBadgeAfter(a, url, a.textContent.trim());
  }
}

function scanChannelHeader() {
  if (!isChannelPage()) return;
  const url = canonicalChannelUrl();
  const label = channelTitle();
  // Modern page-header layout: title is an <h1> inside a yt-dynamic-text-view-model.
  const headers = document.querySelectorAll(
    "yt-page-header-renderer h1, #page-header h1, #channel-header h1"
  );
  for (const h of headers) {
    injectBadgeInside(h, url, label);
  }
  // Legacy channel header (older watch experience): inject after the channel-name node.
  const legacy = document.querySelector("#channel-header ytd-channel-name #text");
  if (legacy) injectBadgeAfter(legacy, url, label);
}

function scanAll() {
  try {
    scanWatchPage();
    scanChannelHeader();
  } catch (err) {
    // Never let scanning break the page.
    console.debug("[ytdl-sub] scan error", err);
  }
}

function scanWithRetries() {
  scanAll();
  setTimeout(scanAll, 500);
  setTimeout(scanAll, 1500);
  setTimeout(scanAll, 3500);
}

// ===== floating card =====

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
  input, select {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font: inherit;
    box-sizing: border-box;
    background: white;
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
          <dt>Downloads</dt><dd data-k="downloads">—</dd>
        </dl>
        <div class="row">
          <button data-act="unsub" class="danger">Unsubscribe</button>
        </div>
      </div>
      <div class="form" hidden>
        <label><span>Name</span><input data-f="name" placeholder="(auto)"></label>
        <div class="grid2">
          <label><span>Keep days</span><input data-f="keep" type="number" min="1" value="14"></label>
          <label><span>Max files</span><input data-f="max" type="number" min="1" value="10"></label>
        </div>
        <label><span>Preset</span><select data-f="preset"></select></label>
        <div class="row">
          <button data-act="sub" class="primary">Subscribe</button>
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
  const parsed = new DOMParser().parseFromString(TEMPLATE, "text/html");
  shadow.appendChild(parsed.body.firstElementChild);
  document.body.appendChild(host);
  wireHost(host);
  return host;
}

function removeHost() {
  const host = document.getElementById(HOST_ID);
  if (host) host.remove();
}

let currentUrl = null;
let cardTarget = null; // {url, label} when opened via badge click; null = derive from page

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

function showDetails(host, sub) {
  $(host, ".details").hidden = false;
  $(host, ".form").hidden = true;
  $(host, '[data-k="name"]').textContent = sub.name || "—";
  $(host, '[data-k="preset"]').textContent = sub.preset || "—";
  $(host, '[data-k="overrides"]').textContent = sub.overrides ? JSON.stringify(sub.overrides) : "(none)";
  $(host, '[data-k="downloads"]').textContent = describeDownloads(sub.downloads);
}

const presetsLoaded = new WeakSet();
const hostPresetDetails = new WeakMap();

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

function parseDays(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = v.match(/^\s*(\d+)\s*(d|day|days)?\s*$/i);
  return m ? Number(m[1]) : null;
}

function applyPresetOverrides(host, details) {
  const ov = details?.overrides || {};
  const keepEl = $(host, '[data-f="keep"]');
  const maxEl = $(host, '[data-f="max"]');
  const days = parseDays(ov.only_recent_date_range);
  if (keepEl && days != null) keepEl.value = String(days);
  if (maxEl && ov.only_recent_max_files != null) maxEl.value = String(ov.only_recent_max_files);
}

function applySelectedPresetOverrides(host) {
  const sel = $(host, '[data-f="preset"]');
  const map = hostPresetDetails.get(host);
  if (!sel || sel.tagName !== "SELECT" || !map) return;
  applyPresetOverrides(host, map.get(sel.value));
}

async function loadPresets(host) {
  if (presetsLoaded.has(host)) return;
  const sel = $(host, '[data-f="preset"]');
  if (!sel || sel.tagName !== "SELECT") return;
  try {
    const res = await send({ type: "listPresets" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const choices = buildPresetChoices(res.data);
    if (!choices.length) throw new Error("empty");
    const { defaultPreset } = await browser.storage.local.get({ defaultPreset: "" });
    sel.replaceChildren();
    const map = new Map();
    hostPresetDetails.set(host, map);
    let matched = false;
    for (const c of choices) {
      const opt = document.createElement("option");
      opt.value = c.value;
      opt.textContent = c.label;
      if (c.value === defaultPreset) { opt.selected = true; matched = true; }
      sel.appendChild(opt);
      if (c.details) map.set(c.value, c.details);
    }
    if (defaultPreset && !matched) {
      const opt = document.createElement("option");
      opt.value = defaultPreset;
      opt.textContent = `${defaultPreset} (saved)`;
      opt.selected = true;
      sel.prepend(opt);
    }
    sel.addEventListener("change", () => applySelectedPresetOverrides(host));
    applySelectedPresetOverrides(host);
    presetsLoaded.add(host);
  } catch {
    // Older API or unreachable — swap in a free-text input.
    const input = document.createElement("input");
    input.dataset.f = "preset";
    input.value = "Jellyfin TV Show";
    sel.replaceWith(input);
    const { defaultPreset } = await browser.storage.local.get({ defaultPreset: "" });
    if (defaultPreset) input.value = defaultPreset;
    presetsLoaded.add(host);
  }
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
    cardTarget = null;
    sessionStorage.setItem("ytdl-sub-status:hidden", location.pathname);
  });
  host.shadowRoot.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const act = btn.dataset.act;
    clearError(host);
    if (act === "unsub") return unsubscribe(host);
    if (act === "sub") return subscribe(host);
  });
}

async function subscribe(host) {
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
    invalidateChannelStatus(currentUrl);
    refreshBadgesForUrl(currentUrl);
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
    invalidateChannelStatus(currentUrl);
    refreshBadgesForUrl(currentUrl);
    await refresh(host);
  } catch (err) {
    setDot(host, "err", "error");
    showError(host, err.message);
  }
}

function openCardFor(url, label) {
  cardTarget = { url, label: label || "" };
  sessionStorage.removeItem("ytdl-sub-status:hidden");
  const host = ensureHost();
  refresh(host);
}

async function refresh(host) {
  clearError(host);
  if (!(await isConfigured())) {
    setDot(host, "err", "not configured");
    $(host, ".details").hidden = true;
    $(host, ".form").hidden = true;
    const ctx = $(host, ".context");
    ctx.replaceChildren();
    const msg = document.createElement("span");
    msg.className = "muted";
    msg.textContent = "Not configured. Open the extension's settings to set your ytdl-sub-api base URL and token.";
    ctx.appendChild(msg);
    return;
  }
  let title;
  let candidates;
  if (cardTarget) {
    title = cardTarget.label || cardTarget.url;
    candidates = [cardTarget.url];
    currentUrl = cardTarget.url;
  } else {
    title = channelTitle();
    candidates = candidateChannelUrls();
    currentUrl = candidates[0] || canonicalChannelUrl();
  }
  const ctx = $(host, ".context");
  ctx.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = title;
  const urlSpan = document.createElement("span");
  urlSpan.className = "mono";
  urlSpan.textContent = currentUrl;
  ctx.append(strong, document.createElement("br"), urlSpan);
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
      statusCache.set(currentUrl, { state: "yes", ts: Date.now() });
    } else if (res.status === 404) {
      setDot(host, "no", "not backed up");
      $(host, '[data-f="name"]').value = "";
      showForm(host);
      const prefs = await browser.storage.local.get(["defaultKeepDays", "defaultMaxFiles"]);
      if (prefs.defaultKeepDays) $(host, '[data-f="keep"]').value = prefs.defaultKeepDays;
      if (prefs.defaultMaxFiles) $(host, '[data-f="max"]').value = prefs.defaultMaxFiles;
      await loadPresets(host);
      statusCache.set(currentUrl, { state: "no", ts: Date.now() });
    } else {
      setDot(host, "err", `err ${res.status}`);
      showError(host, typeof res.data === "string" ? res.data : JSON.stringify(res.data));
      statusCache.set(currentUrl, { state: "err", ts: Date.now() });
    }
    refreshBadgesForUrl(currentUrl);
  } catch (err) {
    setDot(host, "err", "error");
    showError(host, err.message);
  }
}

function sync() {
  if (cardTarget) {
    const host = ensureHost();
    refresh(host);
    return;
  }
  if (!isChannelPage()) {
    removeHost();
    return;
  }
  if (sessionStorage.getItem("ytdl-sub-status:hidden") === location.pathname) return;
  const host = ensureHost();
  refresh(host);
}

let lastPath = location.pathname;
let lastSearch = location.search;
function onNav() {
  if (location.pathname === lastPath && location.search === lastSearch) {
    scanAll();
    return;
  }
  lastPath = location.pathname;
  lastSearch = location.search;
  cardTarget = null;
  sync();
  scanWithRetries();
}

document.addEventListener("yt-navigate-finish", () => {
  cardTarget = null;
  sync();
  scanWithRetries();
});
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
  document.addEventListener("DOMContentLoaded", () => { sync(); scanWithRetries(); }, { once: true });
} else {
  sync();
  scanWithRetries();
}
