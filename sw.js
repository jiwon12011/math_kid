// 수리수리 도감 — 오프라인 캐시 (앱 셸 + 에셋 전체)
// 설치 시 동물 50장까지 전부 받아둬 인터넷 없이도(비행기·차 안) 안 본 동물이 빈칸으로 안 뜨게 한다.
const CACHE = "surisuri-v37";
const EMOJI = ["mascot-fox","mascot-fox-happy","mascot-fox-thinking",
  "nav-play-crayon","nav-dex-book","nav-settings-gear",
  "set-farm","set-forest","set-ocean","set-jungle","set-polar",
  "icon-fire","icon-gift","icon-camera","icon-trophy","icon-storybook",
  "rarity-common-star","rarity-rare-star","rarity-shiny-sparkle"
].map(n => `./assets/img/emoji/${n}.webp`);
// 동물 50종(= data.js의 id) — 설치 때 통째로 캐시
const ANIMAL_IDS = [
  "farm-chick","farm-pig","farm-cow","farm-sheep","farm-goat","farm-duck","farm-donkey","farm-turkey","farm-rabbit","farm-golden-chicken",
  "forest-squirrel","forest-hedgehog","forest-rabbit","forest-owl","forest-deer","forest-chipmunk","forest-fox","forest-raccoon-dog","forest-badger","forest-white-deer",
  "ocean-fish","ocean-crab","ocean-starfish","ocean-octopus","ocean-shrimp","ocean-turtle","ocean-seahorse","ocean-pufferfish","ocean-manta-ray","ocean-rainbow-fish",
  "jungle-monkey","jungle-parrot","jungle-frog","jungle-butterfly","jungle-chameleon","jungle-baby-gorilla","jungle-sloth","jungle-toucan","jungle-jaguar","jungle-golden-frog",
  "polar-penguin","polar-polar-bear","polar-seal","polar-snowy-owl","polar-reindeer","polar-ice-crab","polar-arctic-fox","polar-beluga","polar-lemming","polar-aurora-penguin",
];
const ANIMALS_IMG = ANIMAL_IDS.map(id => `./assets/img/animals/${id}.webp`);
const SHELL = [
  "./", "./index.html",
  "./css/style.css",
  "./js/app.js", "./js/data.js",
  "./manifest.webmanifest",
  "./assets/fonts/jua-korean.woff2",
  "./assets/fonts/jua-latin.woff2",
  "./assets/img/ui/sketchbook-board.webp",
  "./assets/img/ui/sketchbook-question-board-wide.webp",
  "./assets/img/ui/icon-magic-wand.webp",
  "./assets/img/ui/icon-back.webp",
  "./assets/img/ui/icon-sound.webp",
  "./assets/img/ui/icon-settings.webp",
  "./assets/img/ui/icon-parent-lock.webp",
  "./assets/img/ui/favicon-32.png",
  ...EMOJI,
  ...ANIMALS_IMG,
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
    }).catch(() => hit || new Response("", { status: 503, statusText: "offline" })))
  );
});
