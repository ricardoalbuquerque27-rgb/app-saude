import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import MarcaIcone from "@/components/MarcaIcone";
import { NOME, SLOGAN, TITULO, linkDaVaga } from "@/lib/marca";
import { textoDesvios, textoExames, textoFaltas, textoParado } from "@/lib/nutri";

// A página de entrada fala com quem paga, a nutricionista. A antiga falava com
// o consumidor ("Começar grátis", treinos, fotos externas, fundo preto e
// degradês), e o board apontou isso (founder/board.md). Ela é estática e não lê
// o banco. Os textos da demonstração saem das mesmas funções da fila, para a
// página nunca mostrar um alerta que a fila não escreve. O número do WhatsApp é
// uma variável NEXT_PUBLIC_, que entra no código no build: trocar o número pede
// um deploy novo, e sem ele a página diz que as vagas abrem em breve, em vez de
// um link quebrado.

export const metadata: Metadata = { title: TITULO, description: SLOGAN };

const DEMONSTRACAO = [
  { nome: "Ana R.", texto: textoDesvios(1) },
  { nome: "Bruno M.", texto: textoParado(5) },
  { nome: "Carla S.", texto: textoFaltas(2) },
  { nome: "Diego T.", texto: textoExames(1) },
];

const PASSOS = [
  {
    dia: "Dia 1:",
    texto:
      "uma chamada de 30 minutos. Criamos a sua conta e convidamos de 3 a 5 pacientes seus, com a mensagem pronta para o WhatsApp.",
  },
  { dia: "Dia 7:", texto: "15 minutos para abrir a fila juntos." },
  { dia: "Dia 14:", texto: "mais 15 minutos, e a fila já mostra quem precisa de você." },
];

function BotaoDaVaga({ link }: { link: string | null }) {
  if (!link) return <p className="text-app-texto-2">As vagas de implantação abrem em breve.</p>;
  return (
    <a className="btn-primary w-full px-5 text-base sm:w-auto" href={link} target="_blank" rel="noopener">
      Quero uma vaga de implantação
    </a>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold text-app-texto">{titulo}</h2>
      <div className="mt-3 leading-relaxed text-app-texto">{children}</div>
    </section>
  );
}

export default function Entrada() {
  const link = linkDaVaga(process.env.NEXT_PUBLIC_WHATSAPP_VAGAS);

  return (
    <div className="mx-auto max-w-2xl px-4">
      <header className="flex items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-2.5">
          <MarcaIcone tamanho={36} />
          <span className="text-lg font-semibold text-app-texto">{NOME}</span>
        </div>
        <Link href="/login" className="btn-ghost">
          Entrar
        </Link>
      </header>

      <main>
        <section className="pt-10 sm:pt-16">
          <h1 className="text-[2rem] font-semibold leading-tight text-app-texto sm:text-5xl">
            {SLOGAN}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-app-texto-2">
            Em 14 dias, uma fila mostra quais dos seus pacientes estão saindo do plano entre as
            consultas. A implantação é feita comigo, sem migrar ninguém.
          </p>
          <div className="mt-6">
            <BotaoDaVaga link={link} />
          </div>
          <p className="mt-3 text-sm text-app-texto-2">30 dias grátis, sem cartão.</p>
        </section>

        <section className="card mt-10">
          <p className="text-sm text-app-texto-2">Demonstração, com pacientes fictícios</p>
          <ul className="mt-2 divide-y divide-app-linha">
            {DEMONSTRACAO.map((linha) => (
              <li
                key={linha.nome}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3"
              >
                <span className="font-medium text-app-texto">{linha.nome}</span>
                <span className="text-app-texto-2">{linha.texto}</span>
              </li>
            ))}
          </ul>
        </section>

        <Secao titulo="Como funciona">
          <ol className="space-y-3">
            {PASSOS.map((passo) => (
              <li key={passo.dia}>
                <span className="font-semibold">{passo.dia}</span> {passo.texto}
              </li>
            ))}
          </ol>
        </Secao>

        <Secao titulo="A garantia">
          <p>
            Se no dia 14 menos de 3 desses pacientes estiverem registrando, você ganha mais 30
            dias grátis e a implantação é refeita.
          </p>
        </Secao>

        <Secao titulo="O que você tem">
          <p>
            Não precisa migrar ninguém para testar: os outros pacientes seguem onde estão. Você
            prescreve metas, cardápio e, se quiser, treino, e tem agenda, conversa e o registro
            de cada consulta, concluído com o seu CRN.
          </p>
        </Secao>

        {/* A última frase é verdade pela RLS, e é o máximo que se diz até
            existir a política de privacidade (founder/offer.md). */}
        <Secao titulo="O paciente">
          <p>
            Seu paciente usa um app de graça, no celular ou no navegador. Ele registra comida,
            água, peso e treino, e pode fazer isso conversando com uma assistente. Ela não muda a
            meta que você deu. Cada paciente só aparece, no app, para você e para ele mesmo.
          </p>
        </Secao>

        <Secao titulo="As vagas">
          <p>São 10 vagas de implantação por mês, porque cada uma é feita pelo fundador.</p>
          <div className="mt-5">
            <BotaoDaVaga link={link} />
          </div>
        </Secao>
      </main>

      <footer className="mt-16 border-t border-app-linha py-6 text-sm text-app-texto-2">
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center text-app-texto underline-offset-4 hover:underline"
        >
          Recebi um convite do meu nutricionista: entrar
        </Link>
        <p className="mt-1">
          © {new Date().getFullYear()} {NOME}
        </p>
      </footer>
    </div>
  );
}
