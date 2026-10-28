// Service worker do app — habilita instalação (PWA) e um shell offline.
// Estratégia enxuta: nunca mexe em /api nem em requisições externas (Supabase).
// O nome do produto está escrito à mão aqui (o título padrão do push, lá
// embaixo): este arquivo é estático e não lê lib/marca.ts. Trocou o NOME de
// lib/marca.ts, troque aqui também.
// v3: a v2 guardava a resposta do router.refresh() de /app (ver abaixo); trocar
// o nome apaga esse cache no "activate".
// v4: o ícone trocou (o haltere saiu), e o /icon.svg em cache era o velho.
// v5: os botões das refeições ("Comi" / "Não comi") e o recado ao app.
const CACHE = "pacefit-v5";
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
//
// A dos lembretes das refeições ("Almoço: você comeu?") traz dois corpos e os
// botões. Quem sabe se o botão aparece é o celular: o iPhone (app web na Tela
// de Início) não mostra botão, e lá o texto começa com "Toque para marcar.",
// antes do cardápio, porque a tela bloqueada corta o fim. O resto já vem
// pronto e testado do servidor (lib/lembretesDasRefeicoes.ts).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Pace Fit", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Pace Fit";
  const semBotoes = !(self.Notification && Notification.maxActions >= 2);
  event.waitUntil(
    self.registration.showNotification(title, {
      body: (semBotoes && data.bodySemBotoes) || data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "pacefit",
      renotify: true,
      actions: !semBotoes && Array.isArray(data.actions) ? data.actions : [],
      data: { url: data.url || "/app", refeicao: data.refeicao || null, falha: data.falha || null },
    })
  );
});

// Leva a pessoa ao endereço. Com o app aberto (em outra tela, em segundo
// plano), põe a janela na frente e manda um recado: o AppShell navega. O
// client.navigate de antes pode não existir no navegador do iPhone, e o app
// voltava para a frente na tela em que estava. Sem o app aberto, abre direto.
function abrir(url) {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
    const doApp = lista.find((c) => {
      try {
        return new URL(c.url).pathname.startsWith("/app");
      } catch {
        return false;
      }
    });
    if (doApp) {
      // O recado sai mesmo se o focus() recusar (o WebKit pode, pela regra do
      // gesto do usuário): o sistema já traz o app para a frente no toque, e
      // sem o recado ele ficaria na tela em que estava.
      return Promise.resolve()
        .then(() => doApp.focus && doApp.focus())
        .catch(() => {})
        .then(() => doApp.postMessage({ tipo: "abrir", url }));
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  });
}

// O toque: nos botões "Comi" e "Não comi", marca sem abrir o app (a rota usa o
// cookie da sessão); se não der (sem internet, sessão vencida, gravação
// recusada), mostra outra notificação, que leva à refeição. A resposta nunca
// some calada. No texto, leva à refeição.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const url = d.url || "/app";
  if ((event.action === "comi" || event.action === "nao_comi") && d.refeicao) {
    event.waitUntil(
      fetch("/api/refeicoes/marcar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: d.refeicao.data,
          refeicao: d.refeicao.refeicao,
          resposta: event.action,
          usuario: d.refeicao.usuario,
        }),
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
        })
        .catch(() =>
          self.registration.showNotification(d.falha || "Não deu para marcar sua resposta. Toque para abrir o app.", {
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: (event.notification.tag || "pacefit") + "-falha",
            data: { url },
          })
        )
    );
    return;
  }
  event.waitUntil(abrir(url));
});
