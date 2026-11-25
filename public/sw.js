/**
 * Track Me service worker.
 *
 * Deliberately conservative. Athlete data is private and a phone may be shared,
 * so no HTML page, API response or uploaded media is ever cached — only
 * content-hashed build assets, which are immutable and carry no personal data.
 * Its other job is to make the app installable and to show something useful
 * when the network is gone.
 */

/*
 * Bumping this drops every cache the previous version wrote. It has to move
 * whenever a non-hashed asset changes — the icons and the favicon are cached
 * by path, not by content hash, so a device that saw an older build would
 * otherwise keep serving the old ones for ever.
 */
const VERSION = "v3";
const ASSETS = `trackme-assets-${VERSION}`;
const SHELL = `trackme-shell-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png", "/favicon.svg"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== ASSETS && k !== SHELL)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Immutable, content-hashed build output — safe to cache indefinitely. */
function isBuildAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch anything that is not a plain same-origin GET.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never cache authenticated data or media.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_next/image")
  ) {
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSETS).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Pages always come from the network; fall back to the offline notice.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error()),
      ),
    );
  }
});

/*
 * Reminders and coach comments. The payload is the server's PushPayload:
 * { title, body, url, tag }. A tag replaces an earlier notification with the
 * same one, so three comments on one meal stack as one, not three.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Track Me", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/dashboard", self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Reuse an open window of the app rather than stacking a new one.
      for (const win of windows) {
        if (new URL(win.url).origin === target.origin && "focus" in win) {
          return win.focus().then((w) => (w && "navigate" in w ? w.navigate(target.href) : w));
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
