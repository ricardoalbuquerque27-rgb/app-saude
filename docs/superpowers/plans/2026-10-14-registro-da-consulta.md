# Registro da consulta — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o nutricionista registra cada consulta (5 partes, rascunho que salva
sozinho, concluir com CRN, adendo), e as medidas da consulta entram na série
do paciente sem que ele possa editá-las ou apagá-las.

**Architecture:** duas migrações (medidas e CRN; registros e funções), toda
escrita por função `SECURITY DEFINER` como na agenda; lógica pura em
`lib/registro.ts` com teste; leitura em `lib/registroDb.ts`; uma página nova
por consulta em `app/app/pacientes/[id]/consultas/[consulta]/`, com
componentes em `components/registro/`; o painel da consulta, a aba Consultas,
a página Medidas do paciente e o assistente mudam junto.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind (tema clínico
`clin-*`), Supabase (Postgres, RLS), vitest, Postgres 16 local para SQL,
Playwright com o Supabase falso.

**Spec:** `docs/superpowers/specs/2026-10-13-registro-da-consulta-design.md`
(maquetes no canvas citado nela).

## Global Constraints

- Interface, comentários e commits em português do Brasil; comentário explica
  o **porquê**, citando o bug que motivou (CLAUDE.md, Convenções).
- Segurança só por RLS e funções do banco; nunca service role no app.
- Funções devolvem `{ ok, error?, id? }` (e `updated_at` em `salvar_registro`);
  `execute` revogado de `public` e `anon`, concedido a `authenticated`.
- Testes SQL só no Postgres local (`ferramentas/testar-sql.sh`); trocar de
  usuário com `set_config('request.jwt.claims', …)` **antes** de
  `set local role authenticated`.
- Leitura que falha não é "não tem": toda consulta ao banco devolve
  `{ data, falhou }` (o tipo `Res` de `lib/consultasDb.ts`), e a tela mostra
  `ErroSecao`, nunca o vazio.
- Data da medida = dia da consulta em São Paulo
  (`(starts_at at time zone 'America/Sao_Paulo')::date` no SQL;
  `diaDaConsulta` no TS). Nunca `starts_at::date`.
- Faixas (iguais no SQL e em `lib/registro.ts`): peso 20–400 kg; % de
  gordura 2–75; cintura, quadril e tórax 30–250 cm; coxa 20–120 cm; braço,
  panturrilha e pescoço 10–80 cm.
- Limites de texto: anamnese 20.000; diagnóstico 5.000; conduta 10.000;
  observar 2.000; adendo 5.000; CRN 30 caracteres.
- Mensagens de erro (iguais no banco, no mock e nos testes):
  - "Consulta não encontrada."
  - "A consulta ainda não começou."
  - "Consulta com falta ou cancelada não tem registro."
  - "O registro já foi concluído. Para corrigir, use um adendo."
  - "O rascunho mudou em outra aba. Recarregue a página."
  - "Informe o seu CRN para concluir."
  - "Preencha ao menos uma parte do registro."
  - "Texto longo demais em <parte>." (parte = Anamnese, Diagnóstico,
    Conduta ou Observar no retorno)
  - "<Rótulo> fora da faixa (<min> a <max> <unidade>)." — ex.: "Peso fora
    da faixa (20 a 400 kg).", "% de gordura fora da faixa (2 a 75%)."
  - `fechar_consulta`: "Descarte o rascunho do registro antes." e "Esta
    consulta tem registro concluído."
  - Adendo: "Registro não encontrado.", "Só registro concluído recebe
    adendo.", "Escreva o adendo (até 5.000 caracteres)."
- Classes `clin-*` só dentro do tema clínico; repetir a variante `dark:`
  quando a classe for `.card`/`.input`/`.btn-*` (CLAUDE.md).
- Sem armazenamento do navegador para o texto do registro.
- `playwright` fora do `package.json` (instalar com `--no-save`).

## Review Focus

1. Texto digitado enquanto um salvamento está em voo: nada se perde, e a
   própria aba não recebe "O rascunho mudou em outra aba" (Task 6, verificação
   de tela "digitar durante o salvamento").
2. Paciente com a tela Medidas aberta de antes, ou o assistente, tentando
   apagar ou editar a medida da consulta: aviso claro, nunca "apagado" falso
   (Task 9: `remove` confere a contagem; assistente filtra `measured_by`).
3. Medida digitada como "71,8", " 72 ", "72kg" ou "": lida ou recusada no
   campo, nunca `NaN` gravado (Task 3, testes de `lerNumero`).
4. Consulta "sem desfecho" de dias atrás registrada hoje: concluir marca
   realizada e a medida fica com a data da consulta, não a de hoje (Task 2,
   teste SQL).
5. Perfil do paciente sem altura: IMC "altura não informada no perfil", sem
   divisão por zero (Task 3, teste de `imc`).

---

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/testes/base-local.sql` (muda) | réplica local de `body_measurements` e `profiles.height_cm`, com as políticas de produção |
| `supabase/migrations/20261014120000_medidas_da_consulta.sql` (novo) | `profiles.crn`; `body_measurements.measured_by`/`appointment_id`; as quatro políticas do paciente e a do autor |
| `supabase/migrations/20261014120100_registro_da_consulta.sql` (novo) | tabelas `consultation_records` e `consultation_addenda`, leitura, funções, `fechar_consulta` nova |
| `supabase/testes/medidas.sql`, `supabase/testes/registro.sql` (novos) | testes SQL das duas migrações |
| `lib/registro.ts` + `lib/registro.test.ts` (novos) | tipos, faixas, leitura de número, IMC, situação do registro, "antes" |
| `lib/registroDb.ts` (novo) | consultas ao banco do registro |
| `lib/types.ts` (muda) | tabelas, colunas e funções novas no tipo `Database` |
| `components/registro/acoes.ts` (novo) | `chamarRegistro` (RPC tipada) |
| `components/registro/useSalvarRascunho.ts` (novo) | salvamento automático, um por vez |
| `components/registro/EditorRegistro.tsx`, `ContextoDaConsulta.tsx`, `ConcluirRegistro.tsx`, `RegistroConcluido.tsx` (novos) | a página em si |
| `app/app/pacientes/[id]/consultas/[consulta]/page.tsx` (novo) | página de servidor que carrega tudo |
| `components/AppShell.tsx` (muda) | tela larga também na rota nova |
| `components/consultas/PainelConsulta.tsx`, `app/app/pacientes/[id]/secoes/Consultas.tsx`, `components/consultas/agenda/Agenda.tsx`, `app/app/agenda/page.tsx` (mudam) | botão, selo e "Observar" |
| `app/app/medidas/page.tsx`, `lib/aiActions.ts`, `app/app/pacientes/[id]/secoes/Corpo.tsx`, `app/app/perfil/page.tsx` (mudam) | lado do paciente, assistente, marca na aba Corpo, CRN no perfil |
| `ferramentas/mock-supabase.cjs`, `ferramentas/tirar-prints-nutri.cjs`, `ferramentas/conferir-consulta-paciente.cjs` (mudam) | Supabase falso e verificações de tela |
| `CLAUDE.md`, `ferramentas/LEIAME.md` (mudam) | documentação |

---

### Task 1: Medidas da consulta e CRN no banco

**Files:**
- Modify: `supabase/testes/base-local.sql`
- Create: `supabase/migrations/20261014120000_medidas_da_consulta.sql`
- Test: `supabase/testes/medidas.sql`

**Interfaces:**
- Produces: `profiles.crn text` (até 30); `body_measurements.measured_by
  uuid` e `body_measurements.appointment_id uuid` (índice único parcial
  `where appointment_id is not null`); políticas `measurements_patient_read`,
  `measurements_patient_insert`, `measurements_patient_update`,
  `measurements_patient_delete`, `measurements_author_read`; a política
  `measurements_all_own` deixa de existir; `nutri reads patient` fica.

- [ ] **Step 1: Réplica local.** Em `base-local.sql`, acrescente
  `profiles.height_cm numeric` e a tabela `public.body_measurements` com as
  colunas de produção (`id uuid pk default gen_random_uuid()`, `user_id uuid
  not null references auth.users`, `date date not null default
  current_date`, `weight_kg`, `body_fat_pct`, `waist_cm`, `hip_cm`,
  `chest_cm`, `arm_cm`, `thigh_cm`, `neck_cm`, `calf_cm` numeric, `notes
  text`, `created_at timestamptz default now()`), RLS ligada e as duas
  políticas de produção, copiadas do catálogo:
  `measurements_all_own` (ALL, `auth.uid() = user_id` nos dois lados) e
  `nutri reads patient` (SELECT, `is_active_nutri_of(user_id)`).

- [ ] **Step 2: Testes que falham** em `supabase/testes/medidas.sql`, no
  estilo de `consultas.sql` (mesmo cabeçalho, `teste.esperar`, um nutri
  `n1`, um paciente `p1` com vínculo ativo, `p3` revogado). Asserções:
  - paciente insere medida própria com `measured_by` nulo: passa;
  - paciente insere com `measured_by` preenchido: recusado
    (`insufficient_privilege` ou violação de política);
  - com uma linha `measured_by = n1, appointment_id = <uuid>` inserida como
    `postgres`: paciente a lê; `update ... set weight_kg = 1` afeta 0 linhas;
    `delete` afeta 0 linhas (conferir com `get diagnostics` ou `returning`);
  - paciente edita e apaga a própria (`measured_by` nulo): 1 linha cada;
  - `n1` lê a medida que tirou depois de o vínculo virar `revoked`;
  - `n2` (sem vínculo) não lê;
  - duas linhas com o mesmo `appointment_id`: a segunda falha (índice único);
  - `profiles.crn` existe e o próprio usuário o atualiza.

- [ ] **Step 3: Rodar e ver falhar.**
  Run: `pg_ctlcluster 16 main start; ferramentas/testar-sql.sh 20261014120000_medidas_da_consulta medidas`
  Expected: erro na migração ausente / coluna `measured_by` inexistente.

- [ ] **Step 4: Escrever a migração** com o comentário do porquê (a política
  `ALL` deixava o paciente apagar a avaliação física do prontuário).
  `measurements_author_read`: SELECT `using (measured_by = auth.uid())`.

- [ ] **Step 5: Rodar e ver passar.**
  Run: `ferramentas/testar-sql.sh`
  Expected: todos os `ok:` de `consultas.sql` e `medidas.sql`, nenhum `FALHOU`.

- [ ] **Step 6: Commit** — `git add supabase/ && git commit -m "Banco: medidas da consulta protegidas do paciente, CRN no perfil"`

### Task 2: Registros, adendos e funções no banco

**Files:**
- Create: `supabase/migrations/20261014120100_registro_da_consulta.sql`
- Test: `supabase/testes/registro.sql`

**Interfaces:**
- Consumes: Task 1 (colunas e políticas de medida, `profiles.crn`);
  `appointments` e `fechar_consulta` da migração da agenda.
- Produces (assinaturas exatas, para `lib/types.ts` e o mock):
  - `salvar_registro(p_consulta uuid, p_campos jsonb, p_visto_em timestamptz)
    returns jsonb` → `{ ok, id, updated_at }`. `p_campos` = `{ anamnese,
    diagnostico, conduta, observar, medidas }` (texto ou nulo; `medidas`
    objeto de `CampoMedida` → número). Grava o conjunto inteiro (não é
    remendo). `p_visto_em` nulo só cria; com registro existente e
    `p_visto_em` nulo ou diferente de `updated_at` → concorrência.
  - `concluir_registro(p_consulta uuid, p_visto_em timestamptz, p_crn text
    default null) returns jsonb` → `{ ok, id }`.
  - `descartar_rascunho(p_consulta uuid) returns jsonb` → `{ ok }`.
  - `adicionar_adendo(p_registro uuid, p_texto text) returns jsonb` →
    `{ ok, id }`.
  - `fechar_consulta(p_id uuid, p_desfecho text)` com as duas recusas novas.
  - Tabelas e colunas como na spec, seção Dados.

- [ ] **Step 1: Testes que falham** em `registro.sql` (mesma moldura; `n1`
  com `p1` ativo; `n2` com `p2`; uma consulta `c1` de `p1` começando há 10
  min; `c2` futura; `c3` de 3 dias atrás às 22:00 de São Paulo, agendada;
  `c4` faltou). Asserções, uma `teste.ok`/`teste.erro` cada:
  - `salvar_registro(c1, campos, null)` cria e devolve `updated_at`;
  - segunda chamada com o `updated_at` devolvido: ok; com o antigo:
    "O rascunho mudou em outra aba";
  - com registro existente e `p_visto_em` nulo: "mudou em outra aba";
  - `c2` (futura): "A consulta ainda não começou."; `c4`: "Consulta com falta
    ou cancelada não tem registro.";
  - `n2` em `c1`: "Consulta não encontrada."; `n1` em consulta de `p3`
    (revogado): "Consulta não encontrada.";
  - anamnese com 20.001 caracteres: "Texto longo demais em Anamnese.";
  - `concluir_registro` sem CRN no perfil e sem `p_crn`: "Informe o seu CRN";
    com `p_crn = 'CRN-3 12345'`: ok, `profiles.crn` gravado, registro
    `concluido`, `assinatura_nome = 'Nutri Um'`, `assinatura_crn` copiado;
  - concluir com `medidas.weight_kg = 718`: "Peso fora da faixa (20 a 400 kg).";
  - concluir sem nenhuma parte: "Preencha ao menos uma parte do registro.";
  - concluir `c3` (sem desfecho): a consulta vira `realizada`, e a linha em
    `body_measurements` tem `date` = o dia da consulta em São Paulo (não o
    UTC, não hoje), `measured_by = n1`, `appointment_id = c3`, e
    `consultation_records.measurement_id` aponta para ela;
  - concluir sem medidas: nenhuma linha em `body_measurements`;
  - depois de concluído: `salvar_registro` e `descartar_rascunho` recusam com
    "O registro já foi concluído";
  - `descartar_rascunho` de um rascunho: some a linha;
  - `fechar_consulta(c_com_rascunho, 'faltou')`: "Descarte o rascunho do
    registro antes."; `fechar_consulta(c1_concluida, 'cancelada')`: "Esta
    consulta tem registro concluído.";
  - `adicionar_adendo`: em rascunho, "Só registro concluído recebe adendo.";
    vazio, "Escreva o adendo"; ok com nome e CRN copiados; `n2`: "Registro
    não encontrado.";
  - leitura: `p1` não lê `consultation_records` nem `consultation_addenda`;
    `n2` não lê; `n1` lê depois de revogar o vínculo de `p1` (e não salva
    mais: "Consulta não encontrada.");
  - `insert`/`update`/`delete` direto nas duas tabelas como
    `authenticated`: recusado;
  - `anon` não executa nenhuma das quatro funções.

- [ ] **Step 2: Rodar e ver falhar.**
  Run: `ferramentas/testar-sql.sh`
  Expected: falha em `registro.sql` (função inexistente).

- [ ] **Step 3: Escrever a migração.** Uma função interna
  `public.erro_das_medidas(p jsonb) returns text` (nulo = ok; mensagem da
  primeira medida fora da faixa ou não numérica; chave desconhecida =
  "Medida desconhecida."), sem `execute` para ninguém além do dono. Conferir
  o nutri com `nutritionist_id is distinct from auth.uid() or not
  is_active_nutri_of(patient_id)` → "Consulta não encontrada." (igual à
  agenda). Concluir: `for update` na consulta e no registro; se a consulta
  está `agendada`, vira `realizada`; publicar medidas só se o objeto tiver
  ao menos uma chave. Leitura: `nutritionist_id = auth.uid()` (registro) e
  `exists` no registro do autor (adendo). Recriar `fechar_consulta` com as
  duas recusas antes do `update`.

- [ ] **Step 4: Rodar e ver passar.**
  Run: `ferramentas/testar-sql.sh`
  Expected: todos os `ok:` de `consultas.sql`, `medidas.sql` e `registro.sql`.

- [ ] **Step 5: Commit** — `git commit -m "Banco: registro da consulta, adendos e funções"`

### Task 3: Lógica pura do registro

**Files:**
- Create: `lib/registro.ts`, `lib/registro.test.ts`

**Interfaces:**
- Consumes: `Consulta`, `situacao`, `diaDaConsulta` de `lib/consultas.ts`.
- Produces:
  - `type CampoMedida = "weight_kg" | "body_fat_pct" | "waist_cm" | "hip_cm"
    | "chest_cm" | "arm_cm" | "thigh_cm" | "calf_cm" | "neck_cm"`;
    `CAMPOS_PRINCIPAIS` (os 4 primeiros) e `CAMPOS_EXTRAS` (os 5 outros);
  - `FAIXAS: Record<CampoMedida, { min; max; rotulo; unidade }>` (valores e
    rótulos das Global Constraints: Peso/kg, % de gordura/%, Cintura,
    Quadril, Tórax, Coxa, Braço, Panturrilha, Pescoço/cm);
  - `LIMITES = { anamnese: 20000, diagnostico: 5000, conduta: 10000,
    observar: 2000, adendo: 5000, crn: 30 }`;
  - `type Medidas = Partial<Record<CampoMedida, number>>`;
  - `type CamposRegistro = { anamnese: string; diagnostico: string; conduta: string; observar: string; medidas: Medidas }`
    (o que o editor manda a cada salvamento);
  - `type Registro`, `type Adendo` (colunas da spec) e `COLUNAS_REGISTRO`,
    `COLUNAS_ADENDO` (strings de `select`);
  - `lerNumero(texto: string): { ok: true; valor: number | null } | { ok: false }`;
  - `erroDaMedida(campo: CampoMedida, valor: number): string | null`;
  - `imc(pesoKg?: number | null, alturaCm?: number | null): number | null`
    (uma casa decimal);
  - `type SituacaoRegistro = "sem-direito" | "sem-registro" | "rascunho" | "registrada"`;
    `situacaoDoRegistro(c: Consulta, r: { status: "rascunho" | "concluido" } | null | undefined, agora: number | string): SituacaoRegistro`;
    `ROTULO_REGISTRO: Record<Exclude<SituacaoRegistro, "sem-direito">, string>`
    = `{ "sem-registro": "Sem registro", rascunho: "Rascunho", registrada: "Registrada" }`;
  - `rotuloDaAnamnese(kind: Consulta["kind"]): "Anamnese" | "Evolução"`;
  - `anteriores(serie: ({ date: string; appointment_id: string | null } & Medidas)[], diaDaConsulta: string): Partial<Record<CampoMedida, { valor: number; data: string }>>`
    — só linhas com `appointment_id`, com `date < diaDaConsulta`, a mais
    recente por campo;
  - `temAlgumaParte(campos: Partial<CamposRegistro>): boolean`.

- [ ] **Step 1: Testes que falham** em `lib/registro.test.ts`:
  - `lerNumero("71,8")` → `{ ok: true, valor: 71.8 }`; `"71.8"` → 71.8;
    `" 72 "` → 72; `""` e `"  "` → `{ ok: true, valor: null }`; `"72kg"`,
    `"7,1,8"`, `"abc"` → `{ ok: false }`;
  - `erroDaMedida("weight_kg", 718)` → "Peso fora da faixa (20 a 400 kg).";
    `erroDaMedida("body_fat_pct", 80)` → "% de gordura fora da faixa (2 a 75%).";
    `erroDaMedida("weight_kg", 20)` e `(…, 400)` → null (bordas valem);
  - `imc(71.8, 165)` → 26.4; `imc(71.8, null)` → null; `imc(71.8, 0)` → null;
    `imc(null, 165)` → null;
  - `situacaoDoRegistro`: consulta futura → "sem-direito"; começou há 10 min,
    sem registro → "sem-registro"; sem desfecho com rascunho → "rascunho";
    realizada com concluído → "registrada"; faltou e cancelada →
    "sem-direito"; pedido → "sem-direito";
  - `rotuloDaAnamnese("primeira")` → "Anamnese"; `("retorno")` → "Evolução";
  - `anteriores`: ignora linha com `appointment_id` nulo (de casa), ignora a
    do próprio dia e posteriores, pega a mais recente por campo (peso de
    29/09 e cintura de 01/09 quando 29/09 não tem cintura);
  - `temAlgumaParte({ anamnese: "  " })` → false; com uma medida → true.

- [ ] **Step 2: Rodar e ver falhar.** Run: `npx vitest run lib/registro.test.ts` — Expected: módulo inexistente.
- [ ] **Step 3: Implementar** em `lib/registro.ts` (a mensagem de faixa usa
  "%" colado e " cm"/" kg" com espaço, como nos exemplos).
- [ ] **Step 4: Rodar e ver passar.** Run: `npm test` — Expected: todos passam.
- [ ] **Step 5: Commit** — `git commit -m "Registro: lógica pura (faixas, número, IMC, situação, antes)"`

### Task 4: Tipos, leitura do banco e chamada das funções

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/registroDb.ts`, `components/registro/acoes.ts`

**Interfaces:**
- Consumes: Task 2 (assinaturas), Task 3 (tipos e colunas), `Res` de
  `lib/consultasDb.ts` (exportar se ainda não for).
- Produces:
  - em `lib/types.ts`: tabelas `consultation_records`,
    `consultation_addenda`; `profiles.crn`; `body_measurements.measured_by`
    e `appointment_id`; as quatro funções em `Functions`;
  - `getRegistroDaConsulta(supabase, consultaId: string): Promise<Res<Registro | null>>`;
  - `getRegistrosDoPaciente(supabase, pacienteId: string): Promise<Res<Registro[]>>` (todos, `updated_at` desc);
  - `getRegistrosDasConsultas(supabase, consultaIds: string[]): Promise<Res<Record<string, Registro["status"]>>>` (vazio sem chamar o banco quando a lista é vazia);
  - `getObservarDosPacientes(supabase, pacienteIds: string[]): Promise<Res<Record<string, { texto: string; data: string }>>>` — o `observar` não vazio do último concluído de cada paciente, com `concluded_at`;
  - `getAdendos(supabase, registroId: string): Promise<Res<Adendo[]>>` (`created_at` asc);
  - `getMedidasDoPaciente(supabase, pacienteId: string): Promise<Res<({ date: string; appointment_id: string | null; measured_by: string | null } & Medidas)[]>>` (até 200, `date` desc);
  - `type FuncaoRegistro = "salvar_registro" | "concluir_registro" | "descartar_rascunho" | "adicionar_adendo"`;
    `chamarRegistro<F extends FuncaoRegistro>(funcao: F, args: Args<F>): Promise<{ erro: string | null; dados: { id?: string; updated_at?: string } | null }>`
    — mesma mensagem de rede de `chamarConsulta` ("Não foi possível salvar.
    Confira a conexão e tente de novo.").

- [ ] **Step 1: Tipos** em `lib/types.ts`, no formato que o arquivo já usa.
- [ ] **Step 2: Consultas** em `lib/registroDb.ts`, cada uma devolvendo `{ data, falhou: !!error }`.
- [ ] **Step 3: `chamarRegistro`** em `components/registro/acoes.ts`, no molde de `chamarConsulta`.
- [ ] **Step 4: Verificar.** Run: `npx tsc --noEmit && npm test` — Expected: sem erro, testes passando.
- [ ] **Step 5: Commit** — `git commit -m "Registro: tipos, leitura e chamada das funções"`

### Task 5: Supabase falso com registros

**Files:**
- Modify: `ferramentas/mock-supabase.cjs`, `ferramentas/LEIAME.md`

**Interfaces:**
- Consumes: Task 2 (regras e mensagens), Task 4 (colunas lidas).
- Produces: no cenário `carteira`, tabelas `consultation_records` e
  `consultation_addenda` (GET com os filtros `eq`, `in`, `order`, `limit`
  que o mock já entende) e as quatro funções em `rpcConsulta` (ou numa
  `rpcRegistro` ao lado), com as mesmas recusas e mensagens; `fechar_consulta`
  com as duas recusas novas; `body_measurements` com `measured_by` e
  `appointment_id`; o nutri do mock **sem CRN** no perfil (para o diálogo
  pedir); `POST /__reset` restaura também os registros.
  Dados: Luiza com registro **concluído** na consulta realizada há 14 dias
  (as 5 partes, `observar` = "Adesão no fim de semana. Testar café da manhã
  com ovos.", medida de peso 72,6 kg ligada a ela e um adendo); a consulta
  em andamento da Luiza **sem** registro; Joana (sem desfecho há 5 dias) com
  **rascunho** só de anamnese.

- [ ] **Step 1: Implementar** no mock, comentando que as regras espelham a
  migração (o mock não é o banco; a verdade é o teste SQL).
- [ ] **Step 2: Conferir** à mão: `curl` em `/rest/v1/rpc/salvar_registro`
  com o token do nutri devolve `{ ok: true, id, updated_at }`; repetido com
  `p_visto_em` velho devolve a mensagem de concorrência.
- [ ] **Step 3: Falha sob encomenda.** `POST /__falhar` com `{ "tabela":
  "consultation_records" }` faz os GET nessa tabela devolverem 500 até o
  próximo `/__reset` (as leituras são do servidor do Next, que o
  `page.route` do Playwright não intercepta).
- [ ] **Step 4: LEIAME** — a lista do cenário `carteira` ganha os registros
  e o `/__falhar`.
- [ ] **Step 5: Rodar as verificações que já existem.**
  Run: `node ferramentas/tirar-prints-nutri.cjs` (com mock e dev no ar)
  Expected: as mesmas 331 passando (nada novo quebrou).
- [ ] **Step 6: Commit** — `git commit -m "Supabase falso: registros, adendos e medidas da consulta"`

### Task 6: Página do registro em rascunho

**Files:**
- Create: `app/app/pacientes/[id]/consultas/[consulta]/page.tsx`,
  `components/registro/EditorRegistro.tsx`,
  `components/registro/useSalvarRascunho.ts`,
  `components/registro/ContextoDaConsulta.tsx`
- Modify: `components/AppShell.tsx`, `ferramentas/tirar-prints-nutri.cjs`

**Interfaces:**
- Consumes: Tasks 3 e 4; `getConsultasDoPaciente`, `getDesdeDoPaciente`
  (`lib/consultasDb.ts`); `getUltimaPrescricao` (`lib/nutri.ts`);
  `meuPerfil` (`lib/perfil.ts`); `SemAcesso`, `LinkPacientes`
  (`secoes/SemAcesso.tsx`); `ErroSecao`, `estilos.ts`; `rotuloDaConsulta`.
- Produces:
  - `useSalvarRascunho(consultaId: string, inicial: { updatedAt: string | null }): { salvar: (campos: CamposRegistro) => void; agora: () => Promise<boolean>; estado: "ocioso" | "salvando" | "salvo" | "erro"; salvoEm: string | null; erro: string | null; updatedAt: string | null; pendente: boolean }`
    — agenda o salvamento 1.500 ms depois da última chamada; `agora()`
    salva já (usado no blur e antes de concluir); uma gravação por vez: a
    chamada que chega durante uma gravação vira a próxima, com o
    `updated_at` que a anterior devolveu; erro mantém `pendente`; registra
    `beforeunload` enquanto `pendente`.
  - `EditorRegistro` (cliente) com as props que a página passa (consulta,
    nome, registro ou nulo, `anteriores`, altura, metas em vigor, contexto).

- [ ] **Step 1: Verificação de tela que falha** (Verificação 16 em
  `tirar-prints-nutri.cjs`, computador 1440 e celular 390):
  - abrir `/app/pacientes/<luiza>/consultas/<em andamento>`: título
    "Consulta de …", rótulo "Evolução", selo ausente até digitar;
  - digitar na Evolução: aparece "Salvando…" e depois "Salvo às";
  - **digitar durante o salvamento** (segunda digitação antes de o primeiro
    "Salvo às" aparecer): no fim, as duas partes do texto estão no mock e
    não aparece "mudou em outra aba";
  - recarregar: o texto volta do banco;
  - "antes 72,6 em …" embaixo do Peso; IMC com a altura do perfil;
  - a coluna "Para esta consulta" mostra o "Observar no retorno" do registro
    de 14 dias atrás;
  - celular: sem transbordo; o contexto recolhido com o "Observar" à vista;
  - página do registro de paciente sem vínculo: "Sem acesso a este paciente".
- [ ] **Step 2: Rodar e ver falhar** (rota 404).
- [ ] **Step 3: AppShell** — `detalheDoPaciente` também casa
  `/app/pacientes/<id>/consultas/<consulta>` (tela larga), comentado.
- [ ] **Step 4: Página de servidor** — perfil do paciente (nulo →
  `SemAcesso`), a consulta (de outro paciente ou inexistente → `notFound()`),
  o registro, as medidas, os registros anteriores, o "desde", a prescrição e
  o perfil do nutri, em paralelo; cada leitura que falha mostra `ErroSecao`
  no lugar dela (registro ou consulta falhando → só o erro, nunca o
  formulário em branco). Consulta concluída → `RegistroConcluido` (Task 7;
  até lá, um marcador). `generateMetadata` com "Registro · Paciente · Pace Fit".
- [ ] **Step 5: `useSalvarRascunho`, `EditorRegistro`, `ContextoDaConsulta`**
  conforme a maquete 1 e 5; campos de medida com `inputMode="decimal"` e
  `lerNumero` (inválido marca o campo e não salva o valor); "Mais medidas"
  aberto se alguma extra tiver valor; "Ajustar na aba Alimentação" →
  `hrefDaAba(uid, "alimentacao")`; "Descartar rascunho" com confirmação,
  volta para a aba Consultas.
- [ ] **Step 6: Rodar e ver passar.** Run: `npm test && npx tsc --noEmit && node ferramentas/tirar-prints-nutri.cjs` — Expected: tudo passando.
- [ ] **Step 7: Commit** — `git commit -m "Registro: página da consulta com rascunho que salva sozinho"`

### Task 7: Concluir, registro concluído e adendo

**Files:**
- Create: `components/registro/ConcluirRegistro.tsx`,
  `components/registro/RegistroConcluido.tsx`
- Modify: `components/registro/EditorRegistro.tsx`,
  `app/app/pacientes/[id]/consultas/[consulta]/page.tsx`,
  `ferramentas/tirar-prints-nutri.cjs`

**Interfaces:**
- Consumes: Task 6 (`useSalvarRascunho().agora`, `updatedAt`), Task 4
  (`chamarRegistro`, `getAdendos`), `Dialogo` de `components/consultas/`,
  `useRecarregar`.
- Produces: `ConcluirRegistro({ aberto, aoFechar, medidas, precisaCrn, aoConcluir })`;
  `RegistroConcluido({ registro, adendos, consulta, anteriores, alturaCm })`.

- [ ] **Step 1: Verificações que falham** (Verificação 17):
  - "Concluir registro" abre o diálogo com as medidas para conferir e o
    campo "Seu CRN" (o nutri do mock não tem);
  - concluir sem CRN mostra "Informe o seu CRN para concluir.";
  - com peso 718 o botão mostra "Peso fora da faixa (20 a 400 kg)." antes de
    chamar o banco;
  - concluir com "CRN-3 12345": a página vira concluída, com "Concluído em …
    por … · CRN-3 12345", sem campos de edição, medidas com a diferença
    ("−0,8");
  - "Novo adendo" vazio não salva; com texto, aparece na lista com data e
    CRN;
  - no mock, a consulta virou realizada e a medida tem a data da consulta.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** conforme as maquetes 2 e 3: concluir chama
  `agora()` antes (salva o que falta) e passa o `updatedAt` resultante;
  erro do banco aparece no diálogo; sucesso recarrega a página
  (`useRecarregar`), sem fechar o diálogo antes da página nova chegar (a
  armadilha do `depois` em `components/consultas/acoes.ts`).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "Registro: concluir com CRN, registro travado e adendo"`

### Task 8: Por onde se chega — painel, aba Consultas e agenda

**Files:**
- Modify: `components/consultas/PainelConsulta.tsx`,
  `app/app/pacientes/[id]/secoes/Consultas.tsx`,
  `app/app/pacientes/[id]/page.tsx`, `components/consultas/agenda/Agenda.tsx`,
  `app/app/agenda/page.tsx`, `ferramentas/tirar-prints-nutri.cjs`

**Interfaces:**
- Consumes: `situacaoDoRegistro`, `ROTULO_REGISTRO` (Task 3);
  `getRegistrosDasConsultas`, `getObservarDosPacientes` (Task 4).
- Produces: `PainelConsulta` ganha as props opcionais `registro?:
  "rascunho" | "concluido" | null` e `observar?: { texto: string; data:
  string } | null`; o botão é um `Link` para
  `/app/pacientes/<patient_id>/consultas/<id>` com "Registrar consulta",
  "Continuar registro" ou "Ver registro" (só quando `situacaoDoRegistro`
  não é "sem-direito").

- [ ] **Step 1: Verificações que falham** (Verificação 18):
  - na agenda (Dia de hoje), o painel da consulta em andamento da Luiza tem
    "Registrar consulta" e o "Observar no retorno" do registro anterior;
  - o painel da Joana (sem desfecho com rascunho) tem "Continuar registro";
  - a aba Consultas da Luiza mostra "Registrada" na de 14 dias atrás e "Sem
    registro" na em andamento; a de 42 dias atrás (faltou) sem selo;
  - "Faltou" na Joana (que tem rascunho) mostra "Descarte o rascunho do
    registro antes.";
  - com `POST /__falhar {"tabela":"consultation_records"}` no mock (Task 5),
    a aba Consultas mostra a lista sem selos e o aviso "Não foi possível
    carregar os registros.", não "Sem registro"; depois, `/__reset`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.** A página do paciente busca os registros só
  na aba Consultas (a regra de "só a aba aberta consulta o banco"); a agenda
  busca para as consultas do período e as pendências, junto das leituras que
  já faz. Selo com `CLASSE_SELO`: "Rascunho" e "Sem registro" em
  `atencao-fundo`/`atencao`, "Registrada" com borda `clin-linha` e texto
  `clin-primaria` (pares já testados em `lib/temaClinico.ts`).
- [ ] **Step 4: Rodar e ver passar.**
- [ ] **Step 5: Commit** — `git commit -m "Registro: botão no painel, selos na aba Consultas e Observar na agenda"`

### Task 9: Lado do paciente, assistente, aba Corpo e CRN no perfil

**Files:**
- Modify: `app/app/medidas/page.tsx`, `lib/aiActions.ts`,
  `app/app/pacientes/[id]/secoes/Corpo.tsx`, `app/app/perfil/page.tsx`,
  `ferramentas/conferir-consulta-paciente.cjs`, `ferramentas/tirar-prints-nutri.cjs`
- Test: `lib/aiActions.test.ts` (novo)

**Interfaces:**
- Consumes: `body_measurements.measured_by` (Task 1), mock (Task 5);
  `executeAction(name: string, rawArgs: string, supabase: any, uid: string)`
  de `lib/aiActions.ts`.

- [ ] **Step 1: Verificações que falham:**
  - paciente (Luiza no `carteira`, ou a conta do `padrao` com uma medida de
    consulta no mock): na página Medidas, a linha da consulta tem "Medida na
    consulta" e **não** tem o botão de excluir; as dela têm;
  - aba Corpo do nutri: a linha da consulta tem a marca "na consulta";
  - perfil do nutri: campo "CRN" salva e reaparece; o paciente não vê o campo;
  - assistente, teste unitário novo `lib/aiActions.test.ts` com um
    `supabase` falso em memória (um construtor encadeável que guarda as
    linhas de `body_measurements` e aplica `eq`, `is`, `order`, `limit`):
    - `executeAction("atualizar_peso", '{"peso_kg":70}', falso, uid)` com
      hoje só uma linha `measured_by = nutri` → a linha do nutri continua
      com o peso antigo e há uma linha nova `{ weight_kg: 70, measured_by: null }`;
    - com hoje uma linha do nutri e uma do paciente → a do paciente vira 70;
    - `executeAction("remover_ultimo", '{"tipo":"peso"}', …)` com a do
      nutri mais recente → apaga a mais recente **do paciente**; só a do
      nutri → "Não há registro de peso para apagar."
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar.**
  - `medidas/page.tsx`: sem excluir quando `measured_by`; `remove` usa
    `.delete({ count: "exact" })` e, com `count === 0`, avisa "Este registro
    não pode ser apagado." em vez de sumir com ele;
  - `aiActions.ts`: em `atualizar_peso` e em `remover_ultimo` com `tipo ===
    "peso"`, `.is("measured_by", null)` na busca, com o comentário do porquê
    (o banco recusaria sem erro e o assistente diria que atualizou);
  - `Corpo.tsx`: `measured_by` no `select` e a marca na linha;
  - `perfil/page.tsx`: campo "CRN (aparece no prontuário)" só com
    `role === "nutritionist"`, até 30 caracteres, salvo em `profiles.crn`.
- [ ] **Step 4: Rodar e ver passar.** Run: `npm test && node ferramentas/conferir-consulta-paciente.cjs && node ferramentas/tirar-prints-nutri.cjs`.
- [ ] **Step 5: Commit** — `git commit -m "Medidas da consulta no app do paciente, no assistente e na aba Corpo; CRN no perfil"`

### Task 10: Documentação e verificação final

**Files:**
- Modify: `CLAUDE.md`, `docs/superpowers/specs/2026-10-13-registro-da-consulta-design.md` (só se algo mudou na execução)

- [ ] **Step 1: CLAUDE.md** — seção "Registro da consulta" (tabelas só com
  leitura do autor, funções, rascunho→concluído→adendo, medidas publicadas
  em `body_measurements` com `measured_by`, a política do paciente, o
  assistente filtrando `measured_by`); `lib/registro.ts` na lista de lógica
  testada; contagem de testes atualizada; a armadilha "update/delete
  barrado pela RLS não dá erro, devolve zero linhas" em "Armadilhas".
- [ ] **Step 2: Suíte inteira.** Run: `ferramentas/testar-sql.sh && npm test && npx tsc --noEmit`; parar o dev; `npm run build`; subir o dev de novo; `node ferramentas/tirar-prints-nutri.cjs && node ferramentas/conferir-consulta-paciente.cjs` — Expected: tudo passando.
- [ ] **Step 3: Commit** — `git commit -m "Docs: registro da consulta no CLAUDE.md"`

A publicação (aplicar as duas migrações em produção e fazer o merge) não é
tarefa deste plano: pede autorização explícita do dono do produto, como nas
anteriores.
