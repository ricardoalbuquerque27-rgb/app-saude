// Utilitários para as rotas de IA: timeout de requisição e parse tolerante de JSON.

// Cria um AbortController que dispara após `ms`. Lembre de chamar clear() no finally.
export function withTimeout(ms: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(id) };
}

// Detecta erro de timeout (AbortController).
export function isAbortError(err: unknown): boolean {
  return (err as { name?: string })?.name === "AbortError";
}

// Faz o parse do JSON vindo do modelo, tolerando cercas de markdown e texto ao redor.
// Retorna null se não conseguir extrair um objeto válido.
export function parseModelJson(text: string): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    /* tenta limpar abaixo */
  }
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* tenta extrair o primeiro objeto abaixo */
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      /* desiste */
    }
  }
  return null;
}
