const CHANNEL_PATH_RE = /^\/(?:@[^\/]+|channel\/UC[\w-]+|c\/[^\/]+|user\/[^\/]+)(?:\/.*)?$/;

function isChannelPage() {
  return CHANNEL_PATH_RE.test(location.pathname);
}

function canonicalChannelUrl() {
  const link = document.querySelector('link[rel="canonical"]');
  if (link?.href && /youtube\.com\/(?:@|channel\/|c\/|user\/)/.test(link.href)) {
    return link.href;
  }
  const og = document.querySelector('meta[property="og:url"]');
  if (og?.content) return og.content;
  return location.origin + location.pathname;
}

browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "getChannelContext") {
    return Promise.resolve({
      isChannel: isChannelPage(),
      url: canonicalChannelUrl(),
      title: document.title.replace(/ - YouTube$/, ""),
    });
  }
});
