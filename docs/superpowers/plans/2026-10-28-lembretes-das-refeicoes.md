# Lembretes das refeições: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montar, desligado, o lembrete de cada refeição do cardápio ("Almoço: você comeu?", com "Comi" e "Não comi"), a resposta no app, os horários no Perfil e o que a nutricionista vê (alerta na fila e "Refeições da semana").

**Architecture:** Uma migração cria `meal_checks` (a resposta, com RLS do paciente e leitura da nutricionista), as duas colunas do Perfil, `meal_reminders_sent` e a função `refeicoes_devidas`, que o agendador `pacefit-reminders` já chama pela rota `/api/cron/reminders`. As regras moram em módulos puros e testados (`lib/lembretesDasRefeicoes.ts`, `lib/refeicoesDoPlano.ts`, `lib/destinoDoLogin.ts`, `lib/chaveDePush.ts`). A gravação da resposta é uma função só, `marcarRefeicao`, usada pelos botões do app e pela rota `POST /api/refeicoes/marcar`, que o service worker chama.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (Postgres + RLS, supabase-js), web-push, vitest, Playwright com o Supabase falso.

**Spec:** `docs/superpowers/specs/2026-10-27-lembretes-das-refeicoes-design.md` (aprovada em 27/10). Imagem: `docs/superpowers/specs/2026-10-27-lembretes-das-refeicoes/exemplo-notificacoes.png`.

## Global Constraints

- **Nada é ligado.** Nenhuma variável na Vercel, nenhuma migração em produção: a migração roda só no Postgres local (`ferramentas/testar-sql.sh`). Ligar é o "Para ligar" do CLAUDE.md, com autorização do dono do produto.
- Interface, comentários e commits em português do Brasil. Toda frase "Não deu para …" termina com ponto.
- Segurança só por RLS; nada de service role no app.
- Datas em São Paulo: `todayISO`, `addDaysISO`, `naJanela`, `limitesDaJanela`, `dataNoBrasil` (`lib/date.ts`). Nunca `toISOString().slice(0,10)` nem `created_at.slice(0,10)`.
- Leitura que falha não é "não tem": o `error` do supabase-js vira mensagem, nunca lista vazia.
- Perfil sempre por `meuPerfil` (`lib/perfil.ts`), nunca `from("profiles")…maybeSingle()` sem id.
- App do paciente: cor só `app-*` (sem `dark:`), texto no chão em `text-app-texto` ou `text-app-texto-2`, rótulo em frase normal (sem `uppercase`), botões com 44 px, `.tabular` só no número que é dado. Lado clínico: só `clin-*`.
- O nome do produto só por `NOME` (`lib/marca.ts`); a exceção é `public/sw.js`.
- Scripts de tela: Playwright fora do `package.json`; processos parados pelo PID, nunca `pkill -f`; `npm run build` só com o dev parado.
- Copy fixada pela spec, letra por letra: `"<Refeição>: você comeu?"`, `" · ou mais 1 opção"`, `" · ou mais N opções"`, `"Toque para marcar. "`, `"Comi"`, `"Não comi"`, `"Não deu para marcar sua resposta (<Refeição>). Toque para abrir o app."`, `"Essa refeição é de mais de 7 dias."`, `"Qual opção?"`, `"Foi esta"`, `"Desfazer"`, `"Comi isso"`, `"Não deu para carregar as respostas das refeições."`, `"Não foi possível salvar. Tente de novo."`, `"Lembretes das refeições"`, `"Voltar ao sugerido"`, `"sem lembrete"`, `"Os lembretes das refeições seguem o cardápio da sua nutricionista."`, `"Os lembretes das refeições chegam em breve."`, `"No iPhone, os lembretes só chegam com o app na Tela de Início."`, `"As notificações estão bloqueadas neste celular. Libere nos ajustes do navegador."`, `"Pulou 1 refeição do plano (7d)"`, `"Pulou N refeições do plano (7d)"`, `"Refeições da semana"`, `"Almoço, terça: não comeu"`, `"Não deu para carregar as refeições da semana."`.
- Horários sugeridos: Café da manhã 08:00, Lanche da manhã 10:00, Almoço 12:30, Lanche da tarde 16:00, Jantar 20:00, Ceia 22:00.
- Commits terminam com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017NRAjF3WaQYDiVpyJ6nub9
  ```

## Decisões do plano (a spec não diz, ou diz diferente)

Cada uma vale para a tarefa indicada, e o dono do produto pode trocar qualquer uma antes da execução.

1. **"Comi" sem dizer a opção, numa refeição já registrada à mão** (pelo formulário, depois que a notificação chegou): grava só a resposta, sem refeição nova. A spec manda gravar a refeição da opção única, o que lançaria o almoço duas vezes. (Task 3)
2. **A refeição antiga sai antes da resposta nova** ("Não comi" depois de "Comi", "Desfazer"). Se a segunda escrita falha, tentar de novo chega ao mesmo fim; na ordem inversa, sobraria uma refeição órfã que nenhuma resposta aponta. (Task 3)
3. **Refeição registrada sem resposta** (estado `registrada`): "· feito" e nenhum botão, nem "Comi isso". Oferecer "Comi" ali lançaria de novo. (Task 3, Task 9)
4. **Fora dos últimos 7 dias**, a Dieta mostra as respostas sem botão e diz "Dá para marcar o plano só nos últimos 7 dias.". Hoje o "Comi isso" funciona em qualquer dia; como ele passa a gravar a resposta, a regra de 7 dias vale para ele também. O formulário "Registrar refeição" continua para dias antigos. (Task 9)
5. **Hoje, sem resposta, na semana da nutricionista** fica vazio, como os dias futuros, e não "sem resposta": às 8h o jantar ainda não aconteceu. É a regra do "hoje" da semana de treino. (Task 12)
6. **`refeicoes_devidas` chama `refeicoes_devidas_em(p_agora timestamp)`**, que ninguém fora do dono executa. A assinatura da spec fica; o teste SQL passa a hora, em vez de depender do relógio (com `now()`, o teste da meia-noite seria impossível e os outros falhariam perto dela). (Task 1)
7. **`meal_type` sem lista fechada no banco**, só tamanho (1 a 200): a spec deixa o cardápio ter tipo fora de `MEAL_TYPES`, com horário escolhido pelo paciente. E `status = 'skipped'` exige `meal_id` nulo. (Task 1)
8. **`meal_reminders_sent` guarda 7 dias**: a função apaga o que é mais velho a cada chamada. (Task 1)
9. **Desligar o lembrete diário não cancela mais a inscrição de push.** Hoje o `PwaSettings` cancela e apaga a inscrição, o que mataria os lembretes das refeições e já mata o da caneta. A chave de cada lembrete é a coluna dele; a inscrição fica. O `PwaSettings` passa a usar o `ensurePushSubscription` e, sem a chave pública, diz "Os lembretes chegam em breve.". (Task 8)
10. **Inscrição com chave velha é refeita**: o `ensurePushSubscription` reaproveitava qualquer inscrição do navegador, e uma feita com a chave embutida que sai do código nunca receberia nada. Hoje há 0 inscrições em produção (contagem lida em 28/10), então é para a próxima troca de chave. (Task 7)
11. **O texto da falha viaja na notificação** (`falha`, montado por `notificacaoDaRefeicao`): o `sw.js` não ganha uma cópia da frase. (Task 2, Task 7)
12. **O recado do service worker, na mesma página, recarrega** (`location.assign`); em outra página, `router.push`. Na Dieta já aberta em outro dia, o `router.push` não trocaria a data, que vem do endereço só ao montar. (Task 7)
13. **O login guarda a âncora.** O navegador leva o `#refeicao-…` no redirecionamento, e o login o devolve se for só letra, número, `-` e `_`. O `volta` sai sem o `_rsc` do Next. Com sessão, `/login?volta=` vai direto ao `volta`. (Task 5)
14. **A rota de marcar só aceita `Content-Type: application/json`** (415): um formulário de outro site não manda JSON sem permissão do navegador. (Task 4)
15. **O bloco do Perfil é só do paciente** e pede vínculo ativo com cardápio, como a função de envio. Leitura que falha: "Não deu para carregar os lembretes das refeições.". Navegador sem notificação: "Este navegador não mostra notificações.". Ligar que falha sem ser permissão: "Não foi possível ligar os lembretes. Tente de novo.". (Task 8)
16. **Erro de `refeicoes_devidas` não derruba os outros lembretes** na rota do agendador; a resposta JSON leva `erroRefeicoes`. (Task 6)
17. **Uma página de conferência nova**, `ferramentas/conferir-refeicoes.cjs`, para a rota, o login, o recado, o Perfil e os botões; a `conferir-dieta.cjs` continua passando. O mock ganha `GET /__tabela?nome=` para o roteiro ver o que foi gravado. (Tasks 4, 5, 7, 8, 9)

## Review Focus

1. **Paciente registra o almoço pelo formulário e depois toca "Comi" na notificação** (opção única): não pode lançar o almoço duas vezes. Teste em Task 3 ("comi sem opção com refeição do tipo já registrada não duplica").
2. **A segunda escrita falha no meio de "Não comi"**: tentar de novo tem de terminar em "não comi" sem refeição órfã. Teste em Task 3 ("apagar a refeição antiga que falha deixa a resposta como estava").
3. **Ceia às 23:30**: chega às 23:40 e não chega às 00:10 do dia seguinte (a conta de hora que dá a volta no relógio). Teste em Task 1 (`refeicoes_devidas_em` com `p_agora` 23:40 e 00:10).
4. **Desligar o lembrete diário não pode desligar o das refeições.** Guarda em Task 8 (nenhum `.unsubscribe(` em `PwaSettings.tsx` nem em `LembretesDasRefeicoes.tsx`).
5. **Sessão vencida ao tocar na notificação**: depois do login, cair na refeição certa, com a âncora, e não na Início. Testes em Task 5 (`destinoDoLogin` com âncora, `voltaDoPedido` sem `_rsc`) e o roteiro do login em `conferir-refeicoes.cjs`.

---

## File Structure

| arquivo | o que faz |
| --- | --- |
| `supabase/migrations/20261027120000_lembretes_das_refeicoes.sql` | `meal_checks`, colunas do Perfil, `meal_reminders_sent`, `refeicoes_devidas` e `refeicoes_devidas_em` |
| `supabase/testes/base-local.sql` | ganha `meals`, `meal_plans`, `meal_plan_items`, `push_subscriptions`, `app_config` |
| `supabase/testes/lembretes.sql` | RLS e envio, num Postgres local |
| `lib/lembretesDasRefeicoes.ts` | horários, `slugDaRefeicao`, `notificacaoDaRefeicao`, `situacaoDosLembretes`, `horariosParaGravar` |
| `lib/cardapio.ts` | ganha `tiposDoCardapio` |
| `lib/refeicoesDoPlano.ts` | `marcarRefeicao`, `estadoDaRefeicao`, `lerPedido`, `podeMarcar`, `dataDaDieta` |
| `lib/destinoDoLogin.ts` | `caminhoDoApp`, `destinoDoLogin`, `voltaDoPedido` |
| `lib/chaveDePush.ts` | `chaveDaBase64`, `mesmaChave` |
| `lib/vapidPublicKey.ts` | sem chave embutida, `pushConfigurado()` |
| `app/api/refeicoes/marcar/route.ts` | `POST` da resposta, para o service worker |
| `app/api/cron/reminders/route.ts` | manda também as refeições |
| `lib/supabase/middleware.ts`, `app/login/page.tsx` | o login volta para onde ia |
| `public/sw.js` | botões, corpo pelo celular, marcar sem abrir, recado ao app, `pacefit-v5` |
| `components/AppShell.tsx` | ouve o recado do service worker |
| `lib/pushClient.ts`, `components/PwaSettings.tsx`, `components/PassosDoIphone.tsx`, `components/LembretesDasRefeicoes.tsx`, `app/app/perfil/page.tsx` | o Perfil |
| `components/BotoesDaRefeicao.tsx`, `components/MealPlanView.tsx`, `components/PlanCheckIn.tsx`, `app/app/dieta/page.tsx`, `app/app/nutricionista/page.tsx` | a resposta no app |
| `lib/paraHoje.ts`, `app/app/page.tsx` | a Início conta a resposta |
| `lib/nutri.ts`, `components/NutriHome.tsx`, `app/app/pacientes/[id]/secoes/Fila.tsx` | o alerta da fila |
| `components/clinico/SemanaDasRefeicoes.tsx`, `app/app/pacientes/[id]/secoes/Alimentacao.tsx` | "Refeições da semana" |
| `ferramentas/mock-supabase.cjs`, `ferramentas/conferir-refeicoes.cjs`, `ferramentas/tirar-prints-nutri.cjs`, `ferramentas/LEIAME.md`, `CLAUDE.md` | conferência e documentação |

---

### Task 1: A migração, testada no Postgres local

**Files:**
- Create: `supabase/migrations/20261027120000_lembretes_das_refeicoes.sql`
- Modify: `supabase/testes/base-local.sql` (acrescentar no fim)
- Create: `supabase/testes/lembretes.sql`

**Interfaces:**
- Produces:
  - tabela `public.meal_checks(id uuid, user_id uuid, date date, meal_type text, status text, meal_id uuid, created_at timestamptz, updated_at timestamptz)`, única em `(user_id, date, meal_type)`;
  - `profiles.meal_reminders_enabled boolean not null default false`, `profiles.meal_reminder_times jsonb not null default '{}'`;
  - `public.meal_reminders_sent(user_id, date, meal_type, sent_at)`;
  - `public.refeicoes_devidas(p_secret text) returns table(user_id uuid, data date, refeicao text, itens jsonb, endpoint text, p256dh text, auth text)`;
  - `public.refeicoes_devidas_em(p_agora timestamp)`, mesmas colunas, sem execução para `public`, `anon` e `authenticated`;
  - os sugeridos escritos como `('<tipo>', '<HH:MM>')` dentro do CTE `sugeridos`, e o formato do horário como o texto exato `'^([01][0-9]|2[0-3]):[0-5][0-9]$'` (a Task 2 lê os dois do arquivo).

- [ ] **Step 1: Copiar para `base-local.sql` as tabelas de produção que a migração usa**

  Lidas do catálogo em 28/10 (`information_schema.columns`, `pg_policies`, `pg_constraint`). Acrescentar no fim do arquivo, depois de `is_active_nutri_of`, com `grant all … to anon, authenticated` e RLS ligada em todas:
  - `meals`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null → auth.users on delete cascade`, `date date not null default current_date`, `meal_type text not null default 'refeicao'`, `description text not null`, `calories`, `protein_g`, `carbs_g`, `fat_g` (numeric), `created_at timestamptz not null default now()`. Políticas: `meals_all_own` (for all, using e with check `auth.uid() = user_id`) e `"nutri reads patient"` (select, `is_active_nutri_of(user_id)`).
  - `meal_plans`: `id`, `patient_id uuid not null → auth.users cascade`, `nutritionist_id uuid → auth.users on delete set null`, `name text not null default 'Plano alimentar'`, `notes text`, `active boolean not null default true`, `created_at`, `updated_at` (timestamptz not null default now()). Políticas: `meal_plans_nutri_all` (all, `is_active_nutri_of(patient_id)` nos dois lados) e `meal_plans_patient_read` (select, `patient_id = auth.uid()`).
  - `meal_plan_items`: `id`, `meal_plan_id uuid not null → meal_plans on delete cascade`, `user_id uuid not null → auth.users cascade`, `meal_type text not null`, `position integer not null default 1`, `description text not null check (length(trim(description)) between 1 and 2000)`, `calories`, `protein_g`, `carbs_g`, `fat_g` (numeric), `notes text`. Políticas: `meal_plan_items_nutri_all` (all, `is_active_nutri_of(user_id)`) e `meal_plan_items_patient_read` (select, `user_id = auth.uid()`).
  - `push_subscriptions`: `id`, `user_id uuid not null → auth.users cascade`, `endpoint text not null unique`, `p256dh text not null`, `auth text not null`, `created_at`. Políticas `push_select_own`, `push_insert_own`, `push_update_own`, `push_delete_own`, todas com `auth.uid() = user_id`.
  - `app_config`: `key text primary key`, `value text not null`, RLS ligada e nenhuma política (como em produção).

  Atualizar o comentário do topo de `base-local.sql` com a data e as tabelas novas.

- [ ] **Step 2: Escrever `supabase/testes/lembretes.sql`, no molde de `medidas.sql`** (transação com `ROLLBACK`, `teste.esperar`, JWT antes do papel). Usuários: `n1`, `n2` (nutris); `p1` (ativo com n1, cardápio com Café da manhã em 2 opções, Almoço, Ceia e "Pré-treino"), `p2` (ativo com n2), `p3` (revogado com n1, com cardápio), `p4` (ativo, sem cardápio), `p5` (ativo, com cardápio, lembretes desligados), `p6` (ativo, com cardápio, sem inscrição de push). Como `postgres`: `app_config` com `('cron_secret', 'segredo-de-teste')`, refeições, cardápios, inscrições (duas para p1). Asserções, uma `teste.esperar` cada:
  - `anon` lê 0 linhas de `meal_checks` mesmo com linhas gravadas, e o insert de `anon` falha;
  - p1 cria a resposta dele com `meal_id` nulo e com uma refeição dele;
  - p1 com `meal_id` de uma refeição do p2 é recusado (insert e update);
  - p1 com `user_id` do p2 é recusado;
  - p1 só lê as dele; `status = 'skipped'` com `meal_id` preenchido é recusado pela checagem;
  - apagar a refeição ligada deixa a resposta com `meal_id` nulo (`on delete set null`);
  - n1 lê as do p1; n2 não lê as do p1; n1 não lê as do p3 (revogado);
  - `authenticated` não lê nem grava `meal_reminders_sent` (erro de permissão);
  - `refeicoes_devidas('errado')` como `anon` não devolve nada, com uma refeição devida; `refeicoes_devidas('segredo-de-teste')` como `anon` roda;
  - `refeicoes_devidas_em` como `anon` dá erro de permissão;
  - como `postgres`, `refeicoes_devidas_em('<D> 12:40')` devolve o Almoço do p1 em duas linhas (as duas inscrições), com `data = D` e `itens` na ordem de `position`;
  - a mesma chamada de novo não devolve nada (já enviada);
  - Almoço às 13:31 (passou 1 hora) não sai (outro paciente, ou apague o envio antes);
  - resposta gravada no dia tira a refeição; refeição do tipo registrada no dia também;
  - p3 (revogado), p4 (sem cardápio) e p5 (desligado) não recebem;
  - p6 (sem inscrição) não recebe e **não** fica marcado como enviado;
  - horário salvo `{"Almoço": "13:00"}` vale (12:40 não sai, 13:05 sai); salvo `"25:99"` vale o sugerido;
  - "Pré-treino" sem horário salvo nunca sai; com `{"Pré-treino": "17:00"}` sai às 17:10;
  - Ceia com `{"Ceia": "23:30"}` sai em `<D> 23:40` e não sai em `<D+1> 00:10`;
  - linha de `meal_reminders_sent` com data de 8 dias antes some depois de uma chamada.

- [ ] **Step 3: Rodar e ver falhar**

  Run: `pg_ctlcluster 16 main start; ferramentas/testar-sql.sh`
  Expected: `base-local` sobe; `lembretes.sql` FALHA (`relation "public.meal_checks" does not exist`).

- [ ] **Step 4: Escrever a migração**

  - `meal_checks` com as colunas da spec; `meal_type text not null check (char_length(trim(meal_type)) between 1 and 200)`; `status text not null check (status in ('done','skipped'))`; `meal_id uuid references public.meals(id) on delete set null`; `check (status = 'done' or meal_id is null)`; `unique (user_id, date, meal_type)`; gatilho `before update` que põe `updated_at = now()`.
  - RLS ligada; políticas `to authenticated`: `meal_checks_select_own` (`auth.uid() = user_id`), `meal_checks_insert_own` e `meal_checks_update_own` (`auth.uid() = user_id and (meal_id is null or exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()))`, o update com `using (auth.uid() = user_id)`), `meal_checks_delete_own`, `meal_checks_nutri_read` (`is_active_nutri_of(user_id)`). `revoke all … from anon`.
  - `profiles`: as duas colunas, com `check (jsonb_typeof(meal_reminder_times) = 'object')`.
  - `meal_reminders_sent (user_id uuid not null references auth.users on delete cascade, date date not null, meal_type text not null, sent_at timestamptz not null default now(), primary key (user_id, date, meal_type))`, RLS ligada, nenhuma política, `revoke all … from anon, authenticated`.
  - `refeicoes_devidas_em`, plpgsql, `set search_path = public`, `#variable_conflict use_column` e toda coluna qualificada (os nomes de saída colidem com as colunas). A conta, que o teste do Step 2 fixa:

    ```sql
    -- hoje := p_agora::date; hora := p_agora::time
    delete from public.meal_reminders_sent s where s.date < hoje - 7;
    return query
    with sugeridos(tipo, horario) as (values
      ('Café da manhã', '08:00'), ('Lanche da manhã', '10:00'), ('Almoço', '12:30'),
      ('Lanche da tarde', '16:00'), ('Jantar', '20:00'), ('Ceia', '22:00')),
    plano as (            -- o cardápio ativo mais novo de cada paciente, como a Dieta lê
      select distinct on (mp.patient_id) mp.patient_id, mp.id
      from public.meal_plans mp where mp.active
      order by mp.patient_id, mp.created_at desc),
    tipos as (
      select pl.patient_id, i.meal_type,
             jsonb_agg(jsonb_build_object('id', i.id, 'description', i.description,
               'calories', i.calories, 'protein_g', i.protein_g, 'carbs_g', i.carbs_g,
               'fat_g', i.fat_g) order by i.position, i.id) as itens
      from plano pl join public.meal_plan_items i on i.meal_plan_id = pl.id
      group by pl.patient_id, i.meal_type),
    devidas as (
      select t.patient_id, t.meal_type, t.itens,
             coalesce(case when (p.meal_reminder_times ->> t.meal_type) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                           then p.meal_reminder_times ->> t.meal_type end, s.horario)::time as horario
      from tipos t
      join public.profiles p on p.id = t.patient_id and p.meal_reminders_enabled
      left join sugeridos s on s.tipo = t.meal_type
      where exists (select 1 from public.patient_links l where l.patient_id = t.patient_id and l.status = 'active')
        and exists (select 1 from public.push_subscriptions ps where ps.user_id = t.patient_id)
        and not exists (select 1 from public.meal_checks c where c.user_id = t.patient_id and c.date = hoje and c.meal_type = t.meal_type)
        and not exists (select 1 from public.meals m where m.user_id = t.patient_id and m.date = hoje and m.meal_type = t.meal_type)),
    enviadas as (
      insert into public.meal_reminders_sent (user_id, date, meal_type)
      select d.patient_id, hoje, d.meal_type from devidas d
      -- hora - horario e não horario + 1 hora: o time dá a volta à meia-noite,
      -- e a ceia das 23:30 nunca sairia.
      where d.horario is not null and hora >= d.horario and hora - d.horario < interval '1 hour'
      on conflict do nothing
      returning meal_reminders_sent.user_id, meal_reminders_sent.meal_type)
    select e.user_id, hoje, e.meal_type, d.itens, ps.endpoint, ps.p256dh, ps.auth
    from enviadas e
    join devidas d on d.patient_id = e.user_id and d.meal_type = e.meal_type
    join public.push_subscriptions ps on ps.user_id = e.user_id;
    ```
  - `revoke all on function public.refeicoes_devidas_em(timestamp) from public, anon, authenticated`.
  - `refeicoes_devidas(p_secret)`, `security definer`, `set search_path = public`: o `if p_secret is distinct from (select value from public.app_config where key = 'cron_secret') then return; end if;` do `due_reminders`, e `return query select * from public.refeicoes_devidas_em(now() at time zone 'America/Sao_Paulo')`. `grant execute … to anon, authenticated`.
  - Comentário no topo: o que é, por que só função escreve em `meal_reminders_sent`, "mudou um sugerido, mude `HORARIOS_SUGERIDOS` em `lib/lembretesDasRefeicoes.ts`" e "aplicar antes do deploy".

- [ ] **Step 5: Rodar e ver passar**

  Run: `ferramentas/testar-sql.sh`
  Expected: todas as migrações sobem; cada `ok: …` de `lembretes.sql` aparece; `consultas`, `medidas` e `registro` seguem passando.

- [ ] **Step 6: Commit**

  ```bash
  git add supabase/migrations/20261027120000_lembretes_das_refeicoes.sql supabase/testes/base-local.sql supabase/testes/lembretes.sql
  git commit -m "Lembretes das refeições: a resposta (meal_checks), os horários no perfil e a função de envio, testadas no Postgres local"
  ```

---

### Task 2: Os textos e os horários (`lib/lembretesDasRefeicoes.ts`)

**Files:**
- Create: `lib/lembretesDasRefeicoes.ts`, `lib/lembretesDasRefeicoes.test.ts`
- Modify: `lib/cardapio.ts`, `lib/cardapio.test.ts`

**Interfaces:**
- Consumes: a migração da Task 1 (o teste lê o arquivo).
- Produces:
  - `tiposDoCardapio(itens: { meal_type: string }[]): string[]` em `lib/cardapio.ts`: os de `MEAL_TYPES` na ordem deles, depois os outros na ordem em que aparecem, sem repetir.
  - `HORARIOS_SUGERIDOS: Readonly<Record<string, string>>`, `FORMATO_DO_HORARIO = "^([01][0-9]|2[0-3]):[0-5][0-9]$"`, `horarioValido(h: unknown): h is string`.
  - `type HorarioDaRefeicao = { refeicao: string; horario: string | null; sugerido: string | null; mudado: boolean }` e `horariosDoPaciente(tipos: string[], salvos: unknown): HorarioDaRefeicao[]` (na ordem de `tipos`).
  - `horariosParaGravar(salvos: unknown, refeicao: string, valor: string): Record<string, string>`.
  - `slugDaRefeicao(tipo: string): string`, `idDaRefeicao(tipo: string): string` (`"refeicao-" + slug`), `urlDaRefeicao(data: string, tipo: string): string`.
  - `type NotificacaoDaRefeicao = { title: string; body: string; bodySemBotoes: string; tag: string; url: string; actions: { action: "comi" | "nao_comi"; title: string }[]; refeicao: { data: string; refeicao: string }; falha: string }` e `notificacaoDaRefeicao(r: { data: string; refeicao: string; itens: { description: string }[] }): NotificacaoDaRefeicao`.
  - `type SituacaoDosLembretes = "em_breve" | "falhou" | "sem_cardapio" | "iphone_fora" | "sem_suporte" | "pronto"` e `situacaoDosLembretes(e: { pushConfigurado: boolean; falhou: boolean; temCardapio: boolean; ios: boolean; standalone: boolean; suportado: boolean }): SituacaoDosLembretes`.

- [ ] **Step 1: Escrever os testes que falham**

  ```ts
  // lib/cardapio.test.ts
  test("tiposDoCardapio: MEAL_TYPES na ordem deles, depois os outros", () => {
    expect(tiposDoCardapio([{ meal_type: "Jantar" }, { meal_type: "Pré-treino" }, { meal_type: "Café da manhã" }, { meal_type: "Jantar" }]))
      .toEqual(["Café da manhã", "Jantar", "Pré-treino"]);
  });

  // lib/lembretesDasRefeicoes.test.ts
  test("os sugeridos são os da migração", () => {
    const sql = readFileSync("supabase/migrations/20261027120000_lembretes_das_refeicoes.sql", "utf8");
    const pares = Object.fromEntries([...sql.matchAll(/\('([^']+)',\s*'(\d\d:\d\d)'\)/g)].map((m) => [m[1], m[2]]));
    expect(pares).toEqual(HORARIOS_SUGERIDOS);
    expect(sql).toContain(`'${FORMATO_DO_HORARIO}'`);
  });
  test("horarioValido", () => { /* "08:00", "23:59" sim; "24:00", "8:00", "12:60", "", null, 800 não */ });
  test("horariosDoPaciente: o salvo vence o sugerido, o inválido não, e só as refeições pedidas", () => {
    expect(horariosDoPaciente(["Almoço", "Jantar", "Pré-treino"], { Almoço: "13:00", Jantar: "25:99", Ceia: "23:00" })).toEqual([
      { refeicao: "Almoço", horario: "13:00", sugerido: "12:30", mudado: true },
      { refeicao: "Jantar", horario: "20:00", sugerido: "20:00", mudado: false },
      { refeicao: "Pré-treino", horario: null, sugerido: null, mudado: false },
    ]);
    expect(horariosDoPaciente(["Almoço"], "lixo")).toEqual([{ refeicao: "Almoço", horario: "12:30", sugerido: "12:30", mudado: false }]);
  });
  test("horariosParaGravar guarda só o que difere do sugerido", () => {
    expect(horariosParaGravar({ Jantar: "21:00" }, "Almoço", "13:00")).toEqual({ Jantar: "21:00", Almoço: "13:00" });
    expect(horariosParaGravar({ Almoço: "13:00" }, "Almoço", "12:30")).toEqual({});   // voltou ao sugerido
    expect(horariosParaGravar({ Almoço: "13:00" }, "Almoço", "")).toEqual({});        // campo limpo
    expect(horariosParaGravar({ Almoço: "13:00", x: 5 }, "Jantar", "25:00")).toEqual({ Almoço: "13:00" }); // inválido e lixo saem
  });
  test("slugDaRefeicao", () => {
    expect(slugDaRefeicao("Café da manhã")).toBe("cafe-da-manha");
    expect(slugDaRefeicao("Pré-treino (academia)")).toBe("pre-treino-academia");
    expect(slugDaRefeicao("☕")).toBe("outra");
    expect(urlDaRefeicao("2026-10-28", "Almoço")).toBe("/app/dieta?data=2026-10-28#refeicao-almoco");
  });
  test("notificacaoDaRefeicao: título, botões, tag, url e falha", () => {
    const n = notificacaoDaRefeicao({ data: "2026-10-28", refeicao: "Almoço", itens: [{ description: "Arroz, feijão e frango" }] });
    expect(n.title).toBe("Almoço: você comeu?");
    expect(n.body).toBe("Arroz, feijão e frango");
    expect(n.bodySemBotoes).toBe("Toque para marcar. Arroz, feijão e frango");
    expect(n.tag).toBe("refeicao-2026-10-28-almoco");
    expect(n.url).toBe("/app/dieta?data=2026-10-28#refeicao-almoco");
    expect(n.actions).toEqual([{ action: "comi", title: "Comi" }, { action: "nao_comi", title: "Não comi" }]);
    expect(n.refeicao).toEqual({ data: "2026-10-28", refeicao: "Almoço" });
    expect(n.falha).toBe("Não deu para marcar sua resposta (Almoço). Toque para abrir o app.");
  });
  test("o cardápio cortado em 110 numa palavra inteira, sem pontuação antes do …", () => {
    const longo = "Arroz integral, feijão, frango grelhado, salada de folhas verdes, tomate, cenoura ralada, azeite, limão e uma fruta";
    const n = notificacaoDaRefeicao({ data: "2026-10-28", refeicao: "Almoço", itens: [{ description: longo }] });
    expect(n.body.length).toBeLessThanOrEqual(110);
    expect(n.body.endsWith("…")).toBe(true);
    expect(longo.startsWith(n.body.slice(0, -1))).toBe(true);
    expect(n.body).not.toMatch(/[\s,;:.·-]…$/);
    expect(longo[n.body.length - 1]).toMatch(/[\s,]/); // cortou antes de um espaço ou vírgula
  });
  test("ou mais 1 opção / ou mais N opções, e quebra de linha vira espaço", () => {
    const um = notificacaoDaRefeicao({ data: "2026-10-28", refeicao: "Café da manhã", itens: [{ description: "Ovos\n+ pão" }, { description: "b" }] });
    expect(um.body).toBe("Ovos + pão · ou mais 1 opção");
    const tres = notificacaoDaRefeicao({ data: "2026-10-28", refeicao: "Jantar", itens: [{ description: "a" }, { description: "b" }, { description: "c" }] });
    expect(tres.body).toBe("a · ou mais 2 opções");
  });
  test("situacaoDosLembretes, na ordem de precedência", () => {
    const base = { pushConfigurado: true, falhou: false, temCardapio: true, ios: false, standalone: false, suportado: true };
    expect(situacaoDosLembretes({ ...base, pushConfigurado: false, falhou: true })).toBe("em_breve");
    expect(situacaoDosLembretes({ ...base, falhou: true, temCardapio: false })).toBe("falhou");
    expect(situacaoDosLembretes({ ...base, temCardapio: false })).toBe("sem_cardapio");
    expect(situacaoDosLembretes({ ...base, ios: true, suportado: false })).toBe("iphone_fora");
    expect(situacaoDosLembretes({ ...base, ios: true, standalone: true })).toBe("pronto");
    expect(situacaoDosLembretes({ ...base, suportado: false })).toBe("sem_suporte");
    expect(situacaoDosLembretes(base)).toBe("pronto");
  });
  ```

- [ ] **Step 2: Rodar e ver falhar**

  Run: `npx vitest run lib/lembretesDasRefeicoes.test.ts lib/cardapio.test.ts`
  Expected: FAIL (módulo e `tiposDoCardapio` não existem).

- [ ] **Step 3: Implementar**

  - O corte: espaços em branco (quebra de linha inclusive) viram um espaço e as pontas saem; até 110 caracteres, fica como está; acima, `slice(0, 109)`, corta no último espaço se houver, tira `[\s,;:.·-]+` do fim e põe `"…"`.
  - `slugDaRefeicao`: minúsculas, sem acento (`normalize("NFD")` e `[\u0300-\u036f]`, sem a flag `u`: o tsc do projeto recusa), o que não é `[a-z0-9]` vira `-`, sem `-` repetido nem nas pontas; vazio vira `"outra"`.
  - Comentário do topo: a notificação manda os dois corpos porque quem sabe se há botão é o celular, e o `falha` viaja junto para o `sw.js` não ter cópia da frase.

- [ ] **Step 4: Rodar e ver passar**

  Run: `npx vitest run lib/lembretesDasRefeicoes.test.ts lib/cardapio.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/lembretesDasRefeicoes.ts lib/lembretesDasRefeicoes.test.ts lib/cardapio.ts lib/cardapio.test.ts
  git commit -m "Lembretes das refeições: o texto da notificação, os horários sugeridos e a situação do Perfil, testados"
  ```

---

### Task 3: A resposta (`lib/refeicoesDoPlano.ts`)

**Files:**
- Create: `lib/refeicoesDoPlano.ts`, `lib/refeicoesDoPlano.test.ts`

**Interfaces:**
- Consumes: `bancoEmMemoria` (`lib/bancoEmMemoria.ts`), `naJanela`, `todayISO` (`lib/date.ts`).
- Produces:
  - `ERRO_AO_MARCAR = "Não foi possível salvar. Tente de novo."`, `ERRO_DATA_FORA = "Essa refeição é de mais de 7 dias."`, `ERRO_REFEICAO_FORA = "Essa refeição não está no seu cardápio."`.
  - `type RespostaDaRefeicao = "comi" | "nao_comi" | "desfazer"`; `type PedidoDeMarcacao = { data: string; refeicao: string; resposta: RespostaDaRefeicao; itemId?: string | null }`; `type ResultadoDaMarcacao = { ok: true } | { ok: false; erro: string; invalido: boolean }`.
  - `podeMarcar(data: string, hoje: string): boolean` (data ISO real e `naJanela(data, hoje, 7)`).
  - `lerPedido(corpo: unknown): PedidoDeMarcacao | null` (data `AAAA-MM-DD` real; refeição de 1 a 200 caracteres depois do `trim`; resposta da lista; `itemId` string, nulo ou ausente).
  - `marcarRefeicao(supabase: any, uid: string, pedido: PedidoDeMarcacao, hoje?: string): Promise<ResultadoDaMarcacao>`.
  - `type RespostaGravada = { meal_type: string; status: "done" | "skipped"; meal_id: string | null }`.
  - `type EstadoDaRefeicao = { tipo: "sem_resposta" } | { tipo: "registrada"; opcaoId: string | null } | { tipo: "comi"; opcaoId: string | null } | { tipo: "qual_opcao" } | { tipo: "nao_comi" }` e `estadoDaRefeicao(e: { opcoes: { id: string; description: string }[]; resposta: RespostaGravada | null; registradas: { id: string; description: string }[] }): EstadoDaRefeicao` (`registradas` = as refeições do dia DESSE tipo).
  - `dataDaDieta(param: string | null, hoje: string): string`.

- [ ] **Step 1: Escrever os testes que falham**

  Contra `bancoEmMemoria({ meal_plans, meal_plan_items, meal_checks, meals })`, com `hoje = "2026-10-28"`, o cardápio ativo do paciente `u` com "Almoço" (uma opção, `i1`, com macros) e "Café da manhã" (`i2`, `i3`). Nomes e o que cada um confere:
  - `comi com uma opção grava a refeição da opção e a resposta ligada` → `meals` ganha uma linha com `description`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `meal_type` e `date` da opção; `meal_checks` tem `{ status: "done", meal_id: <id dela> }`.
  - `comi com várias opções grava só a resposta` → `meal_id: null`, `meals` intacta.
  - `comi sem opção com refeição do tipo já registrada não duplica` → com um almoço em `meals` e sem resposta, só a resposta `done` com `meal_id: null`; `meals` continua com uma linha.
  - `comi de novo com resposta done não escreve nada` → nenhuma chamada `insert`, `upsert` ou `delete` em `banco.chamadas`.
  - `a refeição que falha não deixa resposta` → `falhar` no `insert` de `meals`: `{ ok: false, erro: ERRO_AO_MARCAR, invalido: false }` e `meal_checks` vazia.
  - `a resposta que falha apaga a refeição que acabou de criar` → `falhar` no `upsert` de `meal_checks`: `meals` volta vazia.
  - `não comi depois de comi apaga só a refeição ligada` → com a refeição ligada e outra refeição do dia: sobra a outra; resposta `{ status: "skipped", meal_id: null }`.
  - `apagar a refeição antiga que falha deixa a resposta como estava` → `falhar` no `delete` de `meals`: `ok: false` e a resposta continua `done` com o `meal_id` de antes.
  - `desfazer apaga a resposta e a refeição ligada` e `desfazer sem resposta não escreve`.
  - `foi esta grava a opção escolhida e liga à resposta sem opção` → resposta `done` sem `meal_id` + `itemId: "i3"`: `meals` com a descrição do `i3` e a resposta apontando para ela.
  - `itemId de outra refeição é recusado` → `{ ok: false, erro: ERRO_REFEICAO_FORA, invalido: true }`.
  - `a janela de 7 dias` → `"2026-10-22"` passa; `"2026-10-21"` e `"2026-10-29"` dão `{ erro: ERRO_DATA_FORA, invalido: true }` sem nenhuma chamada ao banco.
  - `sem cardápio, ou refeição fora dele, é recusado` → `ERRO_REFEICAO_FORA`, `invalido: true`.
  - `a leitura do cardápio que falha é falha, não recusa` → `invalido: false`.
  - `estadoDaRefeicao`, um teste por estado: sem resposta e sem registro → `sem_resposta`; sem resposta com registro de mesma descrição → `{ registrada, opcaoId }` e de outra descrição → `{ registrada, opcaoId: null }`; `done` com a refeição ligada → `{ comi, opcaoId }` pela descrição da refeição ligada; `done` com refeição ligada que não bate com opção nenhuma (o nutri editou) → `{ comi, opcaoId: null }`; `done` sem ligada mas com registro à mão → `comi`; `done` sem ligada e sem registro → `qual_opcao`; `skipped` → `nao_comi`.
  - `lerPedido` → aceita `{ data, refeicao, resposta }` e com `itemId`; recusa resposta fora da lista, data `"2026-02-30"`, refeição vazia, corpo nulo.
  - `dataDaDieta` → passada vale; futura, `"2026-02-30"`, `null` e `"lixo"` dão `hoje`.

- [ ] **Step 2: Rodar e ver falhar**

  Run: `npx vitest run lib/refeicoesDoPlano.test.ts`
  Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `marcarRefeicao`, nesta ordem**

  1. `!podeMarcar` → `ERRO_DATA_FORA`, `invalido: true`, sem tocar no banco.
  2. Cardápio: `meal_plans` `id` com `patient_id = uid`, `active = true`, o mais novo (`order created_at desc`, `limit 1`, `maybeSingle`). Erro → `ERRO_AO_MARCAR`; nenhum → `ERRO_REFEICAO_FORA`.
  3. Opções: `meal_plan_items` `id, description, calories, protein_g, carbs_g, fat_g` do plano e da refeição, por `position`. Erro → falha; vazia, ou `itemId` fora dela → `ERRO_REFEICAO_FORA`.
  4. Resposta atual: `meal_checks` `id, status, meal_id` do `uid`, data e refeição (`maybeSingle`). Erro → falha.
  5. Decidir:
     - `desfazer`: sem resposta → ok. Senão, a refeição ligada (se houver) e depois a resposta.
     - `nao_comi`: já `skipped` → ok. Senão, a refeição ligada (se houver) e depois o `upsert` `{ status: "skipped", meal_id: null }`.
     - `comi` sem `itemId`: já `done` → ok. Com uma opção só, lê `meals` do tipo no dia (`limit 1`; erro → falha); sem nenhuma, segue como `comi` com essa opção; com alguma, ou com várias opções, `upsert` `{ status: "done", meal_id: null }`.
     - `comi` com opção: apaga a refeição ligada (se houver), insere a refeição da opção (`select("id").single()`), `upsert` `{ status: "done", meal_id }`; se o `upsert` falha, apaga a refeição nova.
  6. `upsert` sempre com `{ user_id, date, meal_type, status, meal_id }` e `onConflict: "user_id,date,meal_type"`; `delete` sempre com `.eq("id", …).eq("user_id", uid)`.

  O comentário do topo explica a ordem (a refeição antiga sai primeiro, para tentar de novo chegar ao mesmo fim) e por que "comi" sem opção numa refeição já registrada não lança de novo.

- [ ] **Step 4: Rodar e ver passar**

  Run: `npx vitest run lib/refeicoesDoPlano.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/refeicoesDoPlano.ts lib/refeicoesDoPlano.test.ts
  git commit -m "Lembretes das refeições: marcarRefeicao e o estado de cada refeição, uma regra para o app e para a notificação"
  ```

---

### Task 4: A rota de marcar e o mock

**Files:**
- Create: `app/api/refeicoes/marcar/route.ts`, `ferramentas/conferir-refeicoes.cjs`
- Modify: `ferramentas/mock-supabase.cjs`

**Interfaces:**
- Consumes: `lerPedido`, `marcarRefeicao` (Task 3).
- Produces: `POST /api/refeicoes/marcar` → 415 `{ error: "Envie JSON." }` sem `Content-Type: application/json`; 401 `{ error: "Não autenticado." }`; 400 `{ error: "Pedido inválido." }` ou `{ error: <erro de recusa> }`; 500 `{ error: ERRO_AO_MARCAR }`; 200 `{ ok: true }`. No mock: `meal_checks` com estado e `GET /__tabela?nome=<tabela>`. O roteiro `conferir-refeicoes.cjs` com `entrar`, `etapa`, `ok`, `reset`, `comFalha` (o molde de `conferir-dieta.cjs`) e a etapa `rota`.

- [ ] **Step 1: Mock**

  - `T.meal_checks ||= []` e `"meal_checks"` em `TABELAS_COM_ESTADO`.
  - `POST` em `meal_checks`: upsert por `(user_id, date, meal_type)`; 403 com o código `42501` se `user_id !== quem` ou se `meal_id` não é nulo e não é de uma refeição de `quem` (a RLS da migração).
  - `DELETE` em `meal_checks` só das de `quem`; e o `meal_id` das respostas vira nulo quando a refeição ligada é apagada (`DELETE` de `meals`).
  - `GET /__tabela?nome=` devolve as linhas da tabela, para o roteiro conferir o que gravou.
  - Comentário no bloco de escritas, como os outros.

- [ ] **Step 2: Escrever a etapa `rota` em `conferir-refeicoes.cjs` e ver falhar**

  Como a Maria (cenário padrão, `hoje` de São Paulo): `page.request.post("/api/refeicoes/marcar")` com `text/plain` → 415; num contexto novo, sem cookie → 401; `{ data: "x" }` → 400; `{ data: hoje, refeicao: "Almoço", resposta: "comi" }` → 200, e o `/__tabela?nome=meal_checks` tem a resposta `done` com `meal_id` de uma refeição nova em `/__tabela?nome=meals`; `{ …, resposta: "desfazer" }` → 200, as duas somem; `{ data: <8 dias antes>, … }` → 400 com `"Essa refeição é de mais de 7 dias."`; com `comFalha("meal_checks", …, { escrita: true })` → 500.

  Run (mock sem cenário e dev no ar, ver `ferramentas/LEIAME.md`): `SO=rota node ferramentas/conferir-refeicoes.cjs`
  Expected: FALHA (404 na rota).

- [ ] **Step 3: Escrever a rota**

  `export const dynamic = "force-dynamic"`; `createClient` de `@/lib/supabase/server`; a ordem da Interface acima; `marcarRefeicao(supabase, user.id, pedido)`. Comentário: quem chama é o service worker, com o cookie da sessão; o app chama a função direto; o 415 é porque formulário de outro site não manda JSON sem preflight.

- [ ] **Step 4: Rodar e ver passar**

  Run: `SO=rota node ferramentas/conferir-refeicoes.cjs`
  Expected: todas as linhas `OK`, saída 0.

- [ ] **Step 5: Commit**

  ```bash
  git add app/api/refeicoes/marcar/route.ts ferramentas/mock-supabase.cjs ferramentas/conferir-refeicoes.cjs
  git commit -m "Lembretes das refeições: a rota que o botão da notificação chama, conferida contra o Supabase falso"
  ```

---

### Task 5: O login volta para a refeição

**Files:**
- Create: `lib/destinoDoLogin.ts`, `lib/destinoDoLogin.test.ts`
- Modify: `lib/supabase/middleware.ts`, `app/login/page.tsx`, `ferramentas/conferir-refeicoes.cjs`

**Interfaces:**
- Produces:
  - `caminhoDoApp(c: unknown): string | null` — o caminho se for de dentro do app (`/app`, `/app/…`, `/app?…`, `/app#…`), até 300 caracteres, sem `//`, `\`, segmento `..`, espaço ou caractere de controle; senão nulo.
  - `destinoDoLogin(volta: string | null, ancora?: string): string` — `caminhoDoApp(volta)` com a âncora se ela for `#[A-Za-z0-9_-]{1,80}`; senão `"/app"`.
  - `voltaDoPedido(pathname: string, search: string): string` — o caminho com a busca, sem o `_rsc`.

- [ ] **Step 1: Escrever os testes que falham**

  ```ts
  test("destinoDoLogin aceita o caminho do app e a âncora", () => {
    expect(destinoDoLogin("/app/dieta?data=2026-10-28", "#refeicao-almoco")).toBe("/app/dieta?data=2026-10-28#refeicao-almoco");
    expect(destinoDoLogin("/app", "")).toBe("/app");
    expect(destinoDoLogin("/app/dieta", "#<script>")).toBe("/app/dieta");
  });
  test.each([null, "", "https://outro.site/app", "//outro.site", "/login", "/app\\outro", "/applications", "/app/../login", "/app/ x", "/app//outro"])(
    "destinoDoLogin(%s) vai para /app", (v) => expect(destinoDoLogin(v as any)).toBe("/app"));
  test("voltaDoPedido tira o _rsc e mantém o resto", () => {
    expect(voltaDoPedido("/app/dieta", "?data=2026-10-28&_rsc=abc")).toBe("/app/dieta?data=2026-10-28");
    expect(voltaDoPedido("/app", "")).toBe("/app");
  });
  ```

- [ ] **Step 2: Rodar e ver falhar**

  Run: `npx vitest run lib/destinoDoLogin.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implementar e ligar**

  - `lib/destinoDoLogin.ts` sem import de Node nem de navegador (roda no middleware).
  - Middleware, sem sessão em rota do app: `new URL("/login", request.url)` com `volta = voltaDoPedido(...)` (a busca original não vai junto). Com sessão em `/login`: `destinoDoLogin(searchParams.get("volta"))`; em `/`, `/app` como hoje.
  - Login, no ramo do `signInWithPassword`: `window.location.assign(destinoDoLogin(new URLSearchParams(location.search).get("volta"), location.hash))`. O cadastro continua indo a `/app`. Comentário: o navegador herda a âncora no redirecionamento, e é daí que ela volta.

- [ ] **Step 4: Rodar e ver passar; etapa `login` no roteiro**

  Run: `npx vitest run lib/destinoDoLogin.test.ts` → PASS.
  Etapa `login` em `conferir-refeicoes.cjs`: num contexto sem sessão, `goto(APP + "/app/dieta?data=<ontem>#refeicao-almoco")` cai em `/login?volta=%2Fapp%2Fdieta%3Fdata%3D<ontem>`; depois de entrar, a URL é `/app/dieta?data=<ontem>#refeicao-almoco`.
  Run: `SO=login node ferramentas/conferir-refeicoes.cjs` → `OK`. E `node ferramentas/conferir-entrada.cjs` → segue passando.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/destinoDoLogin.ts lib/destinoDoLogin.test.ts lib/supabase/middleware.ts app/login/page.tsx ferramentas/conferir-refeicoes.cjs
  git commit -m "Login: volta para onde a pessoa ia (a refeição da notificação), só por caminho do app"
  ```

---

### Task 6: O envio no servidor

**Files:**
- Modify: `lib/vapidPublicKey.ts`, `lib/webpush.ts`, `app/api/cron/reminders/route.ts`, `app/api/push/test/route.ts`
- Create: `lib/vapidPublicKey.test.ts`

**Interfaces:**
- Consumes: `notificacaoDaRefeicao` (Task 2); `refeicoes_devidas` (Task 1).
- Produces: `VAPID_PUBLIC_KEY: string` (vazia sem a variável) e `pushConfigurado(): boolean`.

- [ ] **Step 1: Escrever os testes que falham**

  ```ts
  test("sem a variável, o push está desligado", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    vi.resetModules();
    const m = await import("./vapidPublicKey");
    expect(m.VAPID_PUBLIC_KEY).toBe("");
    expect(m.pushConfigurado()).toBe(false);
  });
  test("com a variável, ligado", async () => { /* stubEnv "BAbc…", resetModules, true */ });
  test("a chave embutida antiga não está em lugar nenhum", () => {
    // percorre app/, components/ e lib/ (menos este teste) e procura "BNwiOJi8Vb7tuHSA"
  });
  ```

- [ ] **Step 2: Rodar e ver falhar**

  Run: `npx vitest run lib/vapidPublicKey.test.ts`
  Expected: FAIL (a chave embutida ainda vale e `pushConfigurado` não existe).

- [ ] **Step 3: Implementar**

  - `lib/vapidPublicKey.ts`: `process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""` e `pushConfigurado()`; comentário: a chave embutida não tinha a privada em lugar nenhum, e é a variável que liga o push no app inteiro.
  - `lib/webpush.ts`: `getWebPush` lança "NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada" sem a pública.
  - `/api/push/test` e `/api/cron/reminders`: 503 sem `pushConfigurado()`, como já fazem sem a privada.
  - `/api/cron/reminders`, depois da caneta: `rpc("refeicoes_devidas", { p_secret: secret })`; para cada linha, `deliver(...)` com `notificacaoDaRefeicao(linha)`; a resposta ganha `refeicoes` (quantas linhas) e, com erro, `erroRefeicoes` com a mensagem, sem derrubar o resto (antes da migração, a função não existe).

- [ ] **Step 4: Rodar e ver passar**

  Run: `npx vitest run lib/vapidPublicKey.test.ts && npx tsc --noEmit`
  Expected: PASS e o tsc sem erro.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/vapidPublicKey.ts lib/vapidPublicKey.test.ts lib/webpush.ts app/api/cron/reminders/route.ts app/api/push/test/route.ts
  git commit -m "Push: a chave pública sai do código e liga o push no app inteiro; o agendador manda os lembretes das refeições"
  ```

---

### Task 7: No celular: service worker, recado ao app e inscrição

**Files:**
- Create: `lib/chaveDePush.ts`, `lib/chaveDePush.test.ts`
- Modify: `lib/pushClient.ts`, `public/sw.js`, `components/AppShell.tsx`, `ferramentas/conferir-refeicoes.cjs`

**Interfaces:**
- Consumes: `VAPID_PUBLIC_KEY`, `pushConfigurado` (Task 6); `caminhoDoApp` (Task 5); o payload de `notificacaoDaRefeicao` (Task 2): `title`, `body`, `bodySemBotoes`, `tag`, `url`, `actions`, `refeicao`, `falha`.
- Produces: `chaveDaBase64(b64url: string): Uint8Array`, `mesmaChave(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean`; o recado `{ tipo: "abrir", url: string }` do service worker ao app.

- [ ] **Step 1: Teste que falha**

  ```ts
  test("chaveDaBase64 lê base64url sem preenchimento", () => { /* "AQID" → [1,2,3]; "-_8" → [251,255] */ });
  test("mesmaChave compara byte a byte", () => {
    expect(mesmaChave(new Uint8Array([1, 2, 3]).buffer, new Uint8Array([1, 2, 3]))).toBe(true);
    expect(mesmaChave(new Uint8Array([1, 2, 4]).buffer, new Uint8Array([1, 2, 3]))).toBe(false);
    expect(mesmaChave(null, new Uint8Array([1]))).toBe(false);
  });
  ```

  Run: `npx vitest run lib/chaveDePush.test.ts` → FAIL.

- [ ] **Step 2: Implementar `lib/chaveDePush.ts` e usar no `pushClient`**

  `ensurePushSubscription`: `"unsupported"` sem `pushConfigurado()`; inscrição existente com `options.applicationServerKey` diferente da chave atual → `unsubscribe()`, apaga a linha do endpoint velho em `push_subscriptions` (erro ignorado) e inscreve de novo. O `urlB64ToUint8Array` local sai.

  Run: `npx vitest run lib/chaveDePush.test.ts` → PASS.

- [ ] **Step 3: `public/sw.js`**

  - `CACHE = "pacefit-v5"`, com a linha `// v5: os botões das refeições e o recado ao app.`.
  - `push`: `semBotoes = !(self.Notification && Notification.maxActions >= 2)`; `body` = `data.bodySemBotoes` quando `semBotoes` e ele existe, senão `data.body`; `actions` só quando não é `semBotoes` e `data.actions` é lista; `data: { url, refeicao: data.refeicao || null, falha: data.falha || null }`.
  - `notificationclick` com `event.action` `"comi"` ou `"nao_comi"` e `refeicao`: `fetch("/api/refeicoes/marcar", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, refeicao, resposta: event.action }) })`; resposta fora de 2xx ou erro de rede → `showNotification(falha || "Não deu para marcar sua resposta. Toque para abrir o app.", { tag: tag + "-falha", icon, badge, data: { url } })`. Não abre o app.
  - Toque no texto: a primeira janela cujo caminho começa com `/app` recebe `focus()` e `postMessage({ tipo: "abrir", url })`; sem ela, `openWindow(url)`. Sai o `client.navigate`.
  - Comentários: por que o corpo é escolhido aqui, e que o `navigate` não é confiável no iPhone.

- [ ] **Step 4: O ouvinte no `AppShell`**

  `useEffect` com `navigator.serviceWorker?.addEventListener("message", …)` e `startMessages?.()`; aceita só `{ tipo: "abrir", url }` com `caminhoDoApp(url)` não nulo; mesmo `pathname` da página atual → `window.location.assign(url)`; outro → `router.push(url)`. Remove o ouvinte ao desmontar. Comentário com a Decisão 12.

  Etapa `recado` em `conferir-refeicoes.cjs`: na Início da Maria, `page.evaluate` despacha `new MessageEvent("message", { data: { tipo: "abrir", url: "/app/dieta?data=<ontem>#refeicao-almoco" } })` em `navigator.serviceWorker` → a URL da página vira essa; de novo, já na Dieta, com `<anteontem>` → a URL troca e a página recarregou (um marcador posto em `window` antes some); `{ tipo: "abrir", url: "https://outro.site" }` e `{ tipo: "outro", url: "/app" }` não saem da página. (O rótulo do dia, que depende do `?data=` da Dieta, entra nesta etapa na Task 9.)

  Run: `SO=recado node ferramentas/conferir-refeicoes.cjs` → `OK`.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/chaveDePush.ts lib/chaveDePush.test.ts lib/pushClient.ts public/sw.js components/AppShell.tsx ferramentas/conferir-refeicoes.cjs
  git commit -m "Notificação das refeições: Comi e Não comi sem abrir o app, o texto certo no iPhone e o toque que leva à refeição"
  ```

---

### Task 8: O Perfil

**Files:**
- Create: `components/PassosDoIphone.tsx`, `components/LembretesDasRefeicoes.tsx`
- Modify: `components/PwaSettings.tsx`, `app/app/perfil/page.tsx`, `lib/lembretesDasRefeicoes.test.ts`, `ferramentas/conferir-refeicoes.cjs`

**Interfaces:**
- Consumes: `pushConfigurado`, `ensurePushSubscription`, `pushSupported` (`lib/pushClient.ts`); `situacaoDosLembretes`, `horariosDoPaciente`, `horariosParaGravar`, `HORARIOS_SUGERIDOS` (Task 2); `tiposDoCardapio` (Task 2); `meuPerfil`.
- Produces: em `components/PassosDoIphone.tsx`, `<PassosDoIphone />` (os três passos que hoje estão no `PwaSettings`), `ehIphone(): boolean` e `abertoNaTelaDeInicio(): boolean` (o `isIOS` e o `isStandalone` locais do `PwaSettings`, que passam a morar ali); e `<LembretesDasRefeicoes />`. O `pushSupported` local do `PwaSettings` sai: vale o de `lib/pushClient.ts`.

- [ ] **Step 1: A guarda que falha**

  Em `lib/lembretesDasRefeicoes.test.ts`: `test("desligar um lembrete não cancela a inscrição de push")` lê `components/PwaSettings.tsx` e `components/LembretesDasRefeicoes.tsx` e espera que nenhum contenha `.unsubscribe(` nem `from("push_subscriptions").delete`.

  Run: `npx vitest run lib/lembretesDasRefeicoes.test.ts` → FAIL (o `PwaSettings` cancela; o outro arquivo ainda não existe).

- [ ] **Step 2: `PwaSettings`**

  - Os três passos do iPhone saem para `PassosDoIphone` (mesmo texto e ícones), usados nos dois blocos.
  - Desligar só grava `reminder_enabled: false`. Comentário: a inscrição serve também às refeições e à caneta.
  - Ligar chama `ensurePushSubscription()` (o `subscribeAndSave` e o `urlB64ToUint8Array` locais saem); `"denied"` mostra a permissão bloqueada como hoje.
  - Sem `pushConfigurado()`, o cartão dos lembretes diz só "Os lembretes chegam em breve.".

- [ ] **Step 3: `LembretesDasRefeicoes`**

  - Lê, em paralelo: `meuPerfil(supabase, "meal_reminders_enabled, meal_reminder_times")`, o vínculo ativo (`patient_links` `status = active`, `limit 1`, `maybeSingle`) e o cardápio ativo mais novo com os `meal_type` dos itens. Qualquer erro → `falhou`. `temCardapio` = vínculo ativo e ao menos um item.
  - `situacaoDosLembretes` decide o que aparece, com as frases da spec; `iphone_fora` mostra a frase e `<PassosDoIphone />`; `falhou` diz "Não deu para carregar os lembretes das refeições."; `sem_suporte`, "Este navegador não mostra notificações.".
  - `pronto`: título "Lembretes das refeições" (`section-title`), a chave (44 px, `role="switch"`, `aria-checked`) e uma linha por refeição de `horariosDoPaciente(tiposDoCardapio(itens), salvos)`: o nome, `<input type="time">` com `horario ?? ""` e, sem horário, "sem lembrete" ao lado; "Voltar ao sugerido" quando `mudado`. Os horários aparecem com a chave ligada ou desligada.
  - Mudar um horário grava `meal_reminder_times: horariosParaGravar(salvos, refeicao, valor)` (na saída do campo e no "Voltar ao sugerido").
  - Ligar: `ensurePushSubscription()`; `"ok"` → grava `meal_reminders_enabled: true`; `"denied"` → "As notificações estão bloqueadas neste celular. Libere nos ajustes do navegador." e a chave fica desligada; outro → "Não foi possível ligar os lembretes. Tente de novo.". Desligar grava `false`.
  - Gravação no `profiles` que falha → "Não foi possível salvar. Tente de novo." e a tela volta ao que estava.
  - No `perfil/page.tsx`, depois do `<PwaSettings />`, só quando `role !== "nutritionist"`.

- [ ] **Step 4: Rodar**

  Run: `npx vitest run lib/lembretesDasRefeicoes.test.ts && npx tsc --noEmit` → PASS.
  Etapa `perfil` em `conferir-refeicoes.cjs` (o dev do mock sobe sem a chave pública): o Perfil da Maria mostra "Os lembretes das refeições chegam em breve." e "Os lembretes chegam em breve.", sem chave nem campo de horário; sem rolagem lateral em 390 px.
  Run: `SO=perfil node ferramentas/conferir-refeicoes.cjs` → `OK`.

- [ ] **Step 5: Commit**

  ```bash
  git add components/PassosDoIphone.tsx components/LembretesDasRefeicoes.tsx components/PwaSettings.tsx app/app/perfil/page.tsx lib/lembretesDasRefeicoes.test.ts ferramentas/conferir-refeicoes.cjs
  git commit -m "Perfil: os horários dos lembretes das refeições, e desligar um lembrete não desliga os outros"
  ```

---

### Task 9: A resposta no app (Dieta e Meu plano)

**Files:**
- Create: `components/BotoesDaRefeicao.tsx`
- Modify: `components/PlanCheckIn.tsx`, `components/MealPlanView.tsx`, `app/app/dieta/page.tsx`, `app/app/nutricionista/page.tsx`, `ferramentas/conferir-refeicoes.cjs`, e `ferramentas/conferir-dieta.cjs` se alguma conferência dela contar "Comi isso"

**Interfaces:**
- Consumes: `marcarRefeicao`, `estadoDaRefeicao`, `podeMarcar`, `dataDaDieta`, `ERRO_AO_MARCAR`, `RespostaGravada` (Task 3); `idDaRefeicao` (Task 2).
- Produces:
  - `ESTILO_DO_CHECKIN = { botao, primario, secundario, aviso }`, exportado de `components/PlanCheckIn.tsx` (as classes que o `BotoesDoCheckIn` já usa, agora com nome);
  - `MealPlanView` com `registradas: { id: string; meal_type: string; description: string }[]` (no lugar de `jaRegistrados`), `respostas?: RespostaGravada[]` e `respostasFalharam?: boolean`.

- [ ] **Step 1: Etapa `botoes` em `conferir-refeicoes.cjs`, que falha**

  Na Dieta de hoje da Maria (Almoço com uma opção; Café da manhã com duas), depois de `reset`:
  - Almoço: "Comi" sólido e "Não comi" secundário, os dois com 44 px de altura; Café da manhã: "Comi isso" em cada opção e "Não comi" embaixo.
  - "Comi" no Almoço → a opção diz "comi", aparece "Desfazer", a refeição entra em "Refeições registradas", e `/__tabela?nome=meal_checks` tem `done` ligada.
  - "Desfazer" → volta a "Comi" / "Não comi" e a refeição sai da lista.
  - "Não comi" no Almoço → "Não comi" marcado em `app-atencao` e "Comi" secundário.
  - Com uma resposta `done` sem refeição gravada pela rota (`page.request.post`, `resposta: "comi"`) no Café da manhã → "Qual opção?", "Foi esta" nas duas opções e "Desfazer"; "Foi esta" na segunda → ela diz "comi".
  - `comFalha("meal_checks", …, { escrita: true })` + "Não comi" → "Não foi possível salvar. Tente de novo." embaixo dos botões da refeição.
  - `comFalha("meal_checks", …)` (leitura) → nenhum botão no plano e "Não deu para carregar as respostas das refeições.".
  - `/app/dieta?data=<ontem>` abre em ontem; `/app/dieta?data=<amanhã>` abre em hoje; `/app/dieta?data=<10 dias antes>` mostra o plano sem botão e "Dá para marcar o plano só nos últimos 7 dias.".
  - `/app/dieta?data=<hoje>#refeicao-jantar` rola até o Jantar (o topo do bloco dentro da janela, abaixo da barra de cima).
  - Meu plano (`/app/nutricionista?aba=cardapio`): os mesmos botões; "Comi" no Almoço vira "comi".
  - Sem rolagem lateral em 390 px.

  Run: `SO=botoes node ferramentas/conferir-refeicoes.cjs` → FALHA.

- [ ] **Step 2: `BotoesDaRefeicao` e `MealPlanView`**

  - `BotoesDaRefeicao({ estado, umaOpcao, ocupado, erro, onMarcar })`: a linha de botões embaixo das opções, pela tabela da spec ("No app"), com `ESTILO_DO_CHECKIN`; o "Não comi" marcado é o `aviso`; `erro` embaixo, em `app-perigo`, com `role="alert"`.
  - Em cada opção: `sem_resposta` com várias → "Comi isso"; `qual_opcao` → "Foi esta"; `comi`/`registrada` com `opcaoId` igual → "comi" com o check; o resto, sem botão. "Qual opção?" em `text-app-texto-2` logo abaixo do nome da refeição.
  - O cabeçalho da refeição diz "· feito" em `registrada` e `comi`.
  - O contêiner de cada refeição ganha `id={idDaRefeicao(tipo)}` e `scroll-mt-20`.
  - Todo toque chama `marcarRefeicao(supabase, user.id, { data: date, refeicao, resposta, itemId })`; `ok` → `onRegistrado()` ou `router.refresh()`; senão o `erro` devolvido (ou `ERRO_AO_MARCAR`), só naquela refeição.
  - Fora de `podeMarcar(date, todayISO())`: nenhum botão e a linha "Dá para marcar o plano só nos últimos 7 dias.". Com `respostasFalharam`: nenhum botão e "Não deu para carregar as respostas das refeições.".
  - O `comiIsso` com `insert` direto em `meals` sai. O comentário de `registradas` explica que o "comi" vem da resposta, e a descrição só diz qual opção (e serve às refeições de antes).

- [ ] **Step 3: Dieta e Meu plano**

  - Dieta: a data inicial é `dataDaDieta(params.get("data"), todayISO())` (o `useSearchParams` passa para antes do `useState` da data); o `load` lê também `meal_checks` `meal_type, status, meal_id` do dia, e o `DiaLido` ganha `respostas` e `respostasFalharam`; o efeito que rola até `#plano` passa a rolar também até `#refeicao-…` (uma vez, como hoje).
  - Meu plano: as refeições de hoje com `id, meal_type, description` e as respostas de hoje (`.eq("user_id", uid)`), com o `error` de cada uma; a nota embaixo do cardápio vira "“Comi” e “Comi isso” registram a refeição na sua Dieta, sem digitar de novo.".

- [ ] **Step 4: Rodar**

  Na etapa `recado`, acrescentar: depois de cada recado, o rótulo do dia da Dieta é o da data pedida (`<ontem>`, depois `<anteontem>`).

  Run: `SO='botoes|recado' node ferramentas/conferir-refeicoes.cjs` → todas `OK`.
  Run: `node ferramentas/conferir-dieta.cjs` → segue passando (ajuste só a conferência que contava o "Comi isso" do Almoço, que virou "Comi").
  Run: `npx tsc --noEmit` → sem erro.

- [ ] **Step 5: Commit**

  ```bash
  git add components/BotoesDaRefeicao.tsx components/PlanCheckIn.tsx components/MealPlanView.tsx app/app/dieta/page.tsx app/app/nutricionista/page.tsx ferramentas/conferir-refeicoes.cjs ferramentas/conferir-dieta.cjs
  git commit -m "Dieta e Meu plano: Comi e Não comi em cada refeição do plano, o Qual opção? e a Dieta abrindo no dia da notificação"
  ```

---

### Task 10: A Início conta a resposta

**Files:**
- Modify: `lib/paraHoje.ts`, `lib/paraHoje.test.ts`, `app/app/page.tsx`

**Interfaces:**
- Produces: `refeicoesQueFaltam(tiposDoPlano: string[], registradas: string[], respondidas: string[]): number` em `lib/paraHoje.ts`.

- [ ] **Step 1: Testes que falham**

  ```ts
  test("refeicoesQueFaltam: registrada ou respondida (comi ou não comi) não falta", () => {
    expect(refeicoesQueFaltam(["Café da manhã", "Almoço", "Almoço", "Jantar"], ["Café da manhã"], ["Jantar"])).toBe(1);
    expect(refeicoesQueFaltam(["Almoço"], [], [])).toBe(1);
    expect(refeicoesQueFaltam([], ["Almoço"], [])).toBe(0);
  });
  ```
  Run: `npx vitest run lib/paraHoje.test.ts` → FAIL.

- [ ] **Step 2: Implementar e ligar**

  A Início lê `meal_checks` `meal_type` do `uid` e de hoje junto da primeira leva; `refeicoesFaltando: refeicoesQueFaltam(...)` no lugar do `tiposFaltando`; `!!checksRes.error` entra no `falhouParaHoje`. O comentário do tipo `refeicoesFaltando` em `EntradaParaHoje` diz "sem registro e sem resposta".

- [ ] **Step 3: Rodar**

  Run: `npx vitest run lib/paraHoje.test.ts` → PASS.
  Etapa `inicio` em `conferir-refeicoes.cjs`: depois de "Não comi" no Almoço pela rota, a linha do "Para hoje" da Maria conta uma refeição a menos.
  Run: `SO=inicio node ferramentas/conferir-refeicoes.cjs && node ferramentas/conferir-inicio.cjs` → passam.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/paraHoje.ts lib/paraHoje.test.ts app/app/page.tsx ferramentas/conferir-refeicoes.cjs
  git commit -m "Início: a refeição respondida (comi ou não comi) não conta mais como faltando"
  ```

---

### Task 11: O alerta da fila

**Files:**
- Modify: `lib/nutri.ts`, `lib/nutri.test.ts`, `components/NutriHome.tsx`, `app/app/pacientes/[id]/secoes/Fila.tsx`

**Interfaces:**
- Produces: `TipoAlerta` com `"refeicao"`; `textoRefeicoesPuladas(n: number): string`; `DadosResumo.respostas?: { user_id: string; date: string; status: string }[]`; `PatientSummary.refeicoesPuladas7: number`.

- [ ] **Step 1: Testes que falham** (em `lib/nutri.test.ts`, no molde dos de `montarResumos`)

  - `textoRefeicoesPuladas` → `1` dá "Pulou 1 refeição do plano (7d)"; `3` dá "Pulou 3 refeições do plano (7d)".
  - `com 3 "não comi" em 7 dias, o alerta de refeição no nível 4` → `alertas` contém `{ tipo: "refeicao", nivel: 4, texto: "Pulou 3 refeições do plano (7d)" }`, depois dos de treino.
  - `com 2, não alerta` e `"não comi" de 7 dias antes não conta` (`hoje - 7`); `done` não conta; data futura não conta.
  - `a resposta conta como registro` → paciente só com uma resposta de ontem: `lastActivity` é ontem e `daysLogged7` é 1 (sem o alerta "Nunca registrou nada").
  - `resumirPacientes com a leitura das respostas falhando devolve falhou` → com o `bancoFalso` de `lib/nutri.test.ts` (o `bancoEmMemoria` não tem o `.not`, o `.neq` nem o `.is` que o resumo usa), que ganha um segundo parâmetro opcional, as tabelas que respondem `{ data: null, error: { message: "falha de teste" } }`; aqui, `meal_checks`.
  - `ultimosRegistros conta a resposta` → paciente parado há 40 dias com uma resposta de 40 dias atrás: `lastActivity` é essa data.

  Run: `npx vitest run lib/nutri.test.ts` → FAIL.

- [ ] **Step 2: Implementar**

  - `resumirPacientes`: mais uma leitura em paralelo, `meal_checks` `user_id, date, status` com `.in("user_id", ids)`, `.gte("date", d30)` e `.lte("date", today)`, entrando em `respostas`, no `falhou` e em `dados.respostas`; o comentário "Faz 9 consultas" passa a contar as de agora.
  - `ultimosRegistros`: `"meal_checks"` na lista de tabelas.
  - `montarResumos`: as datas das respostas entram em `activeDays`; `refeicoesPuladas7` conta `status === "skipped"` com `naJanela(date, today, 7)`; `if (summary.refeicoesPuladas7 >= 3) alertar("refeicao", 4, textoRefeicoesPuladas(...))` logo depois dos dois de treino. Comentário: a partir de 3, porque com cinco ou seis refeições por dia uma só seria ruído, e "sem resposta" não alerta.
  - O comentário de `lastActivity` em `PatientSummary` cita a resposta das refeições.
  - `NutriHome`: `refeicao: Utensils` no `ICONE` (import de `lucide-react`).
  - `Fila.tsx`: `case "refeicao"` → link "Ver alimentação" para `hrefDaAba(uid, "alimentacao")`.

- [ ] **Step 3: Rodar**

  Run: `npx vitest run lib/nutri.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/nutri.ts lib/nutri.test.ts components/NutriHome.tsx "app/app/pacientes/[id]/secoes/Fila.tsx"
  git commit -m "Fila do nutricionista: Pulou N refeições do plano (7d), e a resposta conta como registro do paciente"
  ```

---

### Task 12: "Refeições da semana" na aba Alimentação

**Files:**
- Create: `components/clinico/SemanaDasRefeicoes.tsx`
- Modify: `lib/nutri.ts`, `lib/nutri.test.ts`, `app/app/pacientes/[id]/secoes/Alimentacao.tsx`, `ferramentas/mock-supabase.cjs` (cenário `carteira`), `ferramentas/tirar-prints-nutri.cjs`

**Interfaces:**
- Consumes: `weekDates` (`lib/planCheckIn.ts`), `tiposDoCardapio` (Task 2).
- Produces:
  - `type EstadoDaCasa = "comeu" | "nao_comeu" | "sem_resposta" | "hoje" | "futuro"`;
  - `semanaDasRefeicoes(tipos: string[], respostas: { date: string; meal_type: string; status: string }[], hoje: string): { refeicao: string; dias: { data: string; estado: EstadoDaCasa }[] }[]`;
  - `rotuloDaCasa(refeicao: string, data: string, estado: EstadoDaCasa): string`.

- [ ] **Step 1: Testes que falham**

  - `semanaDasRefeicoes vai de segunda a domingo` → com `hoje` numa quarta, 7 dias, o primeiro é a segunda e o último o domingo, para cada refeição, na ordem de `tipos`.
  - `os estados` → `done` = `comeu`, `skipped` = `nao_comeu`, passado sem resposta = `sem_resposta`, hoje sem resposta = `hoje`, hoje respondido = a resposta, depois de hoje = `futuro` (mesmo com resposta gravada).
  - `rotuloDaCasa` → `("Almoço", <uma terça>, "nao_comeu")` dá "Almoço, terça: não comeu"; `comeu` → "comeu"; `sem_resposta` → "sem resposta"; `hoje` → "ainda sem resposta"; `futuro` → "ainda não chegou"; o dia em "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo".

  Run: `npx vitest run lib/nutri.test.ts` → FAIL.

- [ ] **Step 2: Implementar a conta e o bloco**

  - `semanaDasRefeicoes` e `rotuloDaCasa` em `lib/nutri.ts`, com o comentário da Decisão 5.
  - `SemanaDasRefeicoes({ semana, falhou })`: `falhou` → "Não deu para carregar as refeições da semana." e nada mais; senão título "Refeições da semana" (`TITULO_BLOCO` da aba) e uma `<table>`: refeições nas linhas, "seg ter qua qui sex sáb dom" no cabeçalho; `comeu` com o ícone de check em `clin-primaria`, `nao_comeu` com um ✕ em `clin-atencao`, `sem_resposta` com "–" em `clin-texto-2`, `hoje` e `futuro` vazias; cada casa com o `rotuloDaCasa` num `sr-only`, e o símbolo `aria-hidden`. Em 390 px a tabela rola dentro do bloco (`overflow-x-auto`), nunca a página.
  - `Alimentacao.tsx`: lê `meal_checks` `date, meal_type, status` do paciente de `weekDates(hoje)[0]` até `hoje`, junto das outras leituras, mas o erro dela só passa `falhou` ao bloco (não entra no `ErroSecao` da aba). O bloco entra depois do Cardápio, antes do histórico, e só com cardápio que tem item.

- [ ] **Step 3: Mock e prints**

  - Cenário `carteira`: respostas da semana para o paciente cujas abas o `tirar-prints-nutri.cjs` já fotografa, com três `skipped` nos últimos 7 dias, algumas `done` e dias sem resposta. Se alguma conferência existente desse paciente contar os alertas, ajuste-a para incluir "Pulou 3 refeições do plano (7d)".
  - `tirar-prints-nutri.cjs`: na aba Alimentação, o bloco "Refeições da semana" existe, a casa de um `skipped` tem o texto "<Refeição>, <dia>: não comeu" e não há rolagem lateral em 390 px; na fila, o alerta aparece com o link "Ver alimentação", que abre a aba.

  Run: `npx vitest run lib/nutri.test.ts` → PASS.
  Run (mock com `CENARIO=carteira`): `node ferramentas/tirar-prints-nutri.cjs` → todas as conferências passam, as de antes inclusive.

- [ ] **Step 4: Commit**

  ```bash
  git add lib/nutri.ts lib/nutri.test.ts components/clinico/SemanaDasRefeicoes.tsx "app/app/pacientes/[id]/secoes/Alimentacao.tsx" ferramentas/mock-supabase.cjs ferramentas/tirar-prints-nutri.cjs
  git commit -m "Aba Alimentação: Refeições da semana, com comeu, não comeu e sem resposta por dia"
  ```

---

### Task 13: Documentação e conferência final

**Files:**
- Modify: `CLAUDE.md`, `ferramentas/LEIAME.md`

- [ ] **Step 1: `CLAUDE.md`**

  - Seção nova **"Lembretes das refeições"**, depois de "Registro da consulta": a spec; desligado até o "Para ligar"; `marcarRefeicao` é a regra única (app e rota), com a ordem das escritas e o "comi" que não lança de novo; o service worker só escolhe o corpo, chama a rota e manda o recado; o login com `volta`; desligar um lembrete não cancela a inscrição; a chave pública sem cópia no código; os sugeridos em dois lugares (migração e `HORARIOS_SUGERIDOS`, com teste).
  - **"Para ligar"**, com os comandos prontos: (1) a migração no SQL Editor, antes do deploy; (2) o deploy; (3) `npx web-push generate-vapid-keys`, as três variáveis na Vercel (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`), `insert into public.app_config (key, value) values ('cron_secret', '<o mesmo CRON_SECRET>') on conflict (key) do update set value = excluded.value;` e um deploy novo (a pública entra no build); (4) conferir no SQL Editor que o `pacefit-reminders` chama `https://app-saude-silk.vercel.app/api/cron/reminders` com `Authorization: Bearer <CRON_SECRET>` (o comando tem o segredo: quem confere é o dono); (5) o teste num Android e num iPhone, do jeito da spec. E que ligar faz chegar também o lembrete diário e o da caneta.
  - "Lógica testada": `lib/lembretesDasRefeicoes.ts`, `lib/refeicoesDoPlano.ts`, `lib/destinoDoLogin.ts`, `lib/chaveDePush.ts`, `lib/vapidPublicKey.ts`, `tiposDoCardapio`, `refeicoesQueFaltam`, `textoRefeicoesPuladas`, `semanaDasRefeicoes`, `rotuloDaCasa`.
  - "Comandos": a contagem nova do `npm test` (a que o Step 3 mostrar) e o `conferir-refeicoes.cjs` na lista de scripts de tela.
  - "Em aberto": o item "O 'comi' do plano casa por descrição" passa a dizer que a resposta liga a refeição por `meal_id`, e a descrição só diz qual opção foi (e vale para as refeições de antes); "Sem Web Push (falta VAPID)" aponta para "Para ligar"; itens novos: a notificação nunca vista num celular de verdade; no iPhone, só com o app na Tela de Início; "Comi" por reflexo; a semana da nutricionista mostra o padrão, não a verdade de cada refeição.

- [ ] **Step 2: `ferramentas/LEIAME.md`**

  O `meal_checks` do mock (o que grava e a RLS que imita), o `GET /__tabela`, as respostas do cenário `carteira` e o `conferir-refeicoes.cjs` (o que confere, que roda sem cenário, e as etapas por `SO=`).

- [ ] **Step 3: Conferência final**

  Run, nesta ordem:
  1. `npm test` → todos passam; anote a contagem para o CLAUDE.md.
  2. `npx tsc --noEmit` → sem erro.
  3. `ferramentas/testar-sql.sh` → todos os `ok`.
  4. Com o mock sem cenário e o dev no ar: `node ferramentas/conferir-refeicoes.cjs`, `node ferramentas/conferir-dieta.cjs`, `node ferramentas/conferir-inicio.cjs`, `node ferramentas/conferir-treinos.cjs`, `node ferramentas/conferir-consulta-paciente.cjs`, `node ferramentas/tirar-prints.cjs`, `node ferramentas/conferir-entrada.cjs` → saída 0.
  5. Com `CENARIO=carteira`: `node ferramentas/tirar-prints-nutri.cjs` → saída 0.
  6. Pare o dev e o mock pelo PID; `npm run build` → sem erro.

- [ ] **Step 4: Commit e push**

  ```bash
  git add CLAUDE.md ferramentas/LEIAME.md
  git commit -m "Docs: lembretes das refeições, o que está montado e o passo a passo para ligar"
  git push -u origin claude/friendly-keller-rxl7qb
  ```
