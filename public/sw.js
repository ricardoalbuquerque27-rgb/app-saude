// Service worker do app — habilita instalação (PWA) e um shell offline.
// Estratégia enxuta: nunca mexe em /api nem em requisições externas (Supabase).
// O nome do produto está escrito à mão aqui (o título padrão do push, lá
// embaixo): este arquivo é estático e não lê lib/marca.ts. Trocou o NOME de
// lib/marca.ts, troque aqui também.
// v3: a v2 guardava a resposta do router.refresh() de /app (ver abaixo); trocar
// o nome apaga esse cache no "activate".
// v4: o ícone trocou (o haltere saiu), e o /icon.svg em cache era o velho.
const CACHE = "pacefit-v4";
const OFFLINE_URLS = ["/app", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só lida com GET no mesmo domínio. Deixa passar API, auth e terceiros.
  if (
    req.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api")
  ) {
    return;
  }

  // A resposta que o Next busca no router.refresh() e na navegação do lado do
  // cliente (`?_rsc=…`, cabeçalho RSC) é dado da página, nunca do cache. Antes,
  // `/app?_rsc=…` caía na regra de cache-primeiro abaixo (o caminho é "/app",
  // que está em OFFLINE_URLS), e depois de qualquer ação na Início (confirmar
  // treino, ler recado, cancelar consulta) a página voltava com o dado VELHO.
  if (url.searchParams.has("_rsc") || req.headers.get("RSC") === "1") return;

  // Navegações (páginas): rede primeiro, cai no cache se offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(req)) || caches.match("/app"))
    );
    return;
  }

  // Arquivos estáticos do Next (o nome tem hash, nunca mudam) e o manifesto e
  // o ícone: cache primeiro. Só `/_next/static/`: `/_next/image` e afins mudam.
  if (
    url.pathname.startsWith("/_next/static/") ||
    (OFFLINE_URLS.includes(url.pathname) && url.pathname !== "/app" && !url.search)
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            return res;
          })
      )
    );
  }
});

// Recebe uma notificação push (funciona com o app fechado).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Pace Fit", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Pace Fit";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "pacefit",
      renotify: true,
      data: { url: data.url || "/app" },
    })
  );
});

// Ao tocar na notificação, abre/foca o app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
