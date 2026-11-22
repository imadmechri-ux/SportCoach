// Service worker : l'application fonctionne hors ligne une fois chargée.
// Aucune donnée personnelle n'est mise en cache : seulement les fichiers de l'application.
const VERSION = "coaching-v3";
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
    caches.match(e.request).then((reponse) => reponse || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});
