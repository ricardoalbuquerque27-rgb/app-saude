# Pace Fit 🏋️

App para acompanhar **treinos, dieta, peso e medidas, hábitos diários (água/sono/humor) e exames** — responsivo (celular e desktop), com login e dados na nuvem via Supabase.

## Stack

- [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) — autenticação + Postgres (com Row Level Security)
- [Recharts](https://recharts.org/) — gráficos
- [lucide-react](https://lucide.dev/) — ícones

## Funcionalidades

| Módulo | O que faz |
| --- | --- |
| **Início** | Resumo do dia: treinos na semana, calorias, peso atual, água e gráfico de evolução |
| **Treinos** | Registro de treinos com exercícios (séries, reps, carga) |
| **Dieta** | Refeições por dia com calorias e macros (proteína, carbo, gordura) |
| **Medidas** | Peso e medidas corporais com gráficos de evolução por métrica |
| **Hábitos** | Contador de água, horas de sono, passos e humor |
| **Exames** | Resultados de exames e indicadores de saúde com situação (normal/atenção/alterado) |
| **Perfil** | Dados pessoais e metas (peso, água, calorias) |

## Como rodar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure as variáveis de ambiente. Copie `.env.example` para `.env.local` e preencha com os dados do seu projeto Supabase (Project Settings → API):
   ```bash
   cp .env.example .env.local
   ```
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-publishable-key
   ```
3. Rode o app:
   ```bash
   npm run dev
   ```
   Acesse http://localhost:3000

## Banco de dados

O schema (tabelas + Row Level Security) está aplicado no Supabase via migration.
Cada usuário só enxerga os próprios dados. Tabelas:

- `profiles` — perfil e metas do usuário
- `workouts` / `exercises` — treinos e exercícios
- `meals` — refeições e macros
- `body_measurements` — peso e medidas
- `daily_logs` — água, sono, passos e humor (1 registro por dia)
- `exams` — exames e indicadores

Um trigger (`on_auth_user_created`) cria automaticamente o perfil ao cadastrar.

## Deploy

Pronto para deploy na Vercel: importe o projeto, defina as duas variáveis
`NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` e publique.

> ℹ️ Se o cadastro exigir confirmação de e-mail, ative/desative isso em
> **Authentication → Providers → Email** no painel do Supabase.
