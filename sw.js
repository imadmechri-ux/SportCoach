// Service worker : l'application fonctionne hors ligne une fois chargée.
// Stratégie "réseau d'abord" : chaque mise à jour arrive dès que l'iPhone est connecté,
// et le cache sert seulement si le réseau est absent. Aucune donnée personnelle n'est mise en cache.
const VERSION = "coaching-v4";
const FICHIERS = ["./", "./index.html", "./app.js", "./exercices.js", "./programme.js", "./adaptation.js", "./coach.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copie)).catch(() => {});
        return reponse;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("./index.html")))
  );
});
