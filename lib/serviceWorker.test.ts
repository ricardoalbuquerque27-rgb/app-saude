import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// O public/sw.js roda num service worker, que o navegador de teste não
// dispara (a notificação do sistema não aparece). Aqui ele roda numa caixa do
// Node, com um `self` falso: dá para conferir o que ele faz com a notificação
// e com o toque, sem celular.

type Cliente = { url: string; focus?: () => Promise<unknown>; postMessage: ReturnType<typeof vi.fn> };

function carregar({
  clientes = [] as Cliente[],
  maxActions,
  fetch = vi.fn(async () => ({ ok: true, status: 200 })),
}: { clientes?: Cliente[]; maxActions?: number; fetch?: (...a: any[]) => Promise<any> } = {}) {
  const ouvintes: Record<string, (e: any) => void> = {};
  const showNotification = vi.fn(async () => {});
  const openWindow = vi.fn(async () => null);
  const Notification = maxActions === undefined ? undefined : { maxActions };
  const self: any = {
    addEventListener: (tipo: string, f: (e: any) => void) => (ouvintes[tipo] = f),
    registration: { showNotification },
    clients: { matchAll: async () => clientes, openWindow, claim: () => {} },
    skipWaiting: () => {},
    location: { origin: "https://app.exemplo" },
    Notification,
  };
  vm.runInContext(
    readFileSync("public/sw.js", "utf8"),
    vm.createContext({ self, caches: {}, fetch, URL, Notification })
  );
  const disparar = async (tipo: string, evento: any) => {
    const promessas: Promise<unknown>[] = [];
    ouvintes[tipo]({ ...evento, waitUntil: (p: Promise<unknown>) => promessas.push(p) });
    await Promise.all(promessas);
  };
  return { disparar, showNotification, openWindow, fetch };
}

const DADOS = {
  title: "Almoço: você comeu?",
  body: "Arroz e feijão",
  bodySemBotoes: "Toque para marcar. Arroz e feijão",
  tag: "refeicao-2026-10-28-almoco",
  url: "/app/dieta?data=2026-10-28#refeicao-almoco",
  actions: [
    { action: "comi", title: "Comi" },
    { action: "nao_comi", title: "Não comi" },
  ],
  refeicao: { data: "2026-10-28", refeicao: "Almoço", usuario: "pac-1" },
  falha: "Não deu para marcar sua resposta (Almoço). Toque para abrir o app.",
};
const toque = (action = "", data: any = { url: DADOS.url, refeicao: DADOS.refeicao, falha: DADOS.falha }) => ({
  action,
  notification: { close: vi.fn(), tag: DADOS.tag, data },
});

describe("o toque na notificação (sw.js)", () => {
  it("com o app aberto, o recado sai mesmo se o focus() recusar", async () => {
    // O WebKit pode recusar o focus() (InvalidAccessError); o sistema já traz o
    // app para a frente, e sem o recado ele ficaria na tela em que estava.
    const app: Cliente = {
      url: "https://app.exemplo/app/treinos",
      focus: () => Promise.reject(new Error("InvalidAccessError")),
      postMessage: vi.fn(),
    };
    const sw = carregar({ clientes: [app] });
    await sw.disparar("notificationclick", toque());
    expect(app.postMessage).toHaveBeenCalledWith({ tipo: "abrir", url: DADOS.url });
    expect(sw.openWindow).not.toHaveBeenCalled();
  });

  it("com o app aberto e o focus() aceito, o recado sai", async () => {
    const app: Cliente = { url: "https://app.exemplo/app", focus: async () => null, postMessage: vi.fn() };
    const sw = carregar({ clientes: [app] });
    await sw.disparar("notificationclick", toque());
    expect(app.postMessage).toHaveBeenCalledWith({ tipo: "abrir", url: DADOS.url });
  });

  it("sem janela do app, abre direto na refeição", async () => {
    const fora: Cliente = { url: "https://app.exemplo/login", focus: async () => null, postMessage: vi.fn() };
    const sw = carregar({ clientes: [fora] });
    await sw.disparar("notificationclick", toque());
    expect(fora.postMessage).not.toHaveBeenCalled();
    expect(sw.openWindow).toHaveBeenCalledWith(DADOS.url);
  });

  it("o botão que não consegue marcar mostra a notificação da falha", async () => {
    const sw = carregar({ fetch: vi.fn(async () => ({ ok: false, status: 401 })) });
    await sw.disparar("notificationclick", toque("comi"));
    expect(sw.fetch).toHaveBeenCalledWith(
      "/api/refeicoes/marcar",
      expect.objectContaining({ method: "POST", credentials: "same-origin" })
    );
    // O pedido leva de quem é a notificação, para a rota recusar outra conta.
    const corpo = JSON.parse((sw.fetch as any).mock.calls[0][1].body);
    expect(corpo).toEqual({ data: "2026-10-28", refeicao: "Almoço", resposta: "comi", usuario: "pac-1" });
    expect(sw.showNotification).toHaveBeenCalledWith(DADOS.falha, expect.objectContaining({ data: { url: DADOS.url } }));
    expect(sw.openWindow).not.toHaveBeenCalled();
  });
});

describe("a notificação que chega (sw.js)", () => {
  it("com botões, o corpo com botões e as ações", async () => {
    const sw = carregar({ maxActions: 2 });
    await sw.disparar("push", { data: { json: () => DADOS } });
    const [titulo, opcoes] = sw.showNotification.mock.calls[0] as any[];
    expect(titulo).toBe("Almoço: você comeu?");
    expect(opcoes.body).toBe("Arroz e feijão");
    expect(opcoes.actions).toEqual(DADOS.actions);
  });

  it("sem botões (o iPhone), o corpo que começa por Toque para marcar", async () => {
    const sw = carregar();
    await sw.disparar("push", { data: { json: () => DADOS } });
    const [, opcoes] = sw.showNotification.mock.calls[0] as any[];
    expect(opcoes.body).toBe("Toque para marcar. Arroz e feijão");
    expect(opcoes.actions).toEqual([]);
  });
});
