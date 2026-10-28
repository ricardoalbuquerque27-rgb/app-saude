// Chave pública VAPID: segura para expor no cliente, e vem só da variável.
// A que estava escrita aqui não tinha a privada em lugar nenhum: tudo que se
// inscrevia com ela nunca receberia nada. Sem a variável, o push fica
// desligado no app inteiro (`pushConfigurado`), e as telas dizem que os
// lembretes chegam em breve. Ligar é o "Para ligar" do CLAUDE.md.
export const VAPID_PUBLIC_KEY = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();

export function pushConfigurado(): boolean {
  return VAPID_PUBLIC_KEY.length > 0;
}
