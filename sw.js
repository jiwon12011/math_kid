// 수리수리 도감 — 오프라인 캐시 (앱 셸 + 에셋)
const CACHE = "surisuri-v3";
const SHELL = [
  "./", "./index.html",
  "./css/style.css",
  "./js/app.js", "./js/data.js",
  "./manifest.webmanifest",
  "./assets/img/ui/sketchbook-board.webp",
  "./assets/img/ui/sketchbook-question-board-wide.webp",
  "./assets/img/ui/icon-magic-wand.webp",
  "./assets/img/ui/icon-back.webp",
  "./assets/img/ui/icon-sound.webp",
  "./assets/img/ui/icon-settings.webp",
  "./assets/img/ui/icon-parent-lock.webp",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 캐시 우선 + 네트워크 폴백(동물 이미지는 처음 볼 때 캐시에 저장)
self.addEventListener("fetch", e => {
  const { request } = e;
  if (request.method !== "GET") return;
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(res => {
      if (res.ok && new URL(request.url).origin === location.origin) {
        const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
