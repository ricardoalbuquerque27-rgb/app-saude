# M1 — "Treinar com o app na mão" (Modo Treino ao vivo)

Objetivo: transformar a aba de Treino de um **diário** (preenchido depois) em um
**treinador na mão** (usado durante o treino), no modelo Hevy/Strong.

Status:
- **Pacote rápido** — ✅ entregue (cronômetro de descanso, repetir último treino,
  sugestão de progressão, 1RM estimado, calculadora de anilhas).
- **M1a — Rotinas reutilizáveis** — ✅ entregue (tabelas `routines`/
  `routine_exercises`, aba Rotinas com CRUD e "Registro rápido").
- **M1b — Sessão ao vivo** — ✅ entregue (componente `WorkoutSession`: iniciar
  treino a partir da rotina, marcar séries, cronômetro de descanso automático,
  PR/1RM em tempo real, finalizar gravando no histórico).
- **M1c — Vínculo Plano ⇆ Rotina** — ✅ entregue (coluna `workout_plan.routine_id`,
  seletor de rotina no plano, botão "Iniciar treino" no dia do plano; ao
  finalizar, marca a conclusão do plano).
- **M1d — Gaia cria rotinas** — ✅ entregue (tool `criar_rotina`).

**M1 concluído.** Possíveis evoluções futuras: superséries, biblioteca de
exercícios em PT (M3), reordenar exercícios, editar séries durante a sessão.

---

## 1. Peças do M1

1. **Rotinas reutilizáveis** — modelos de treino com lista de exercícios e
   metas (séries × reps × carga × descanso). Hoje o "plano semanal" só tem
   rótulos (ex.: "Musculação"); a rotina carrega os exercícios prontos.
2. **Sessão ao vivo ("Iniciar treino")** — inicia a partir de uma rotina (ou do
   dia do plano ligado a ela), marca série por série, com carga/reps
   pré-preenchidos e **cronômetro de descanso automático** ao concluir a série.
3. **Vínculo Plano ⇆ Rotina** — cada dia do plano pode apontar para uma rotina;
   "Concluir treino de hoje" vira "Iniciar treino de hoje".
4. **Gaia monta rotinas completas** — "monte um treino de peito" cria uma rotina
   com exercícios de verdade (não só o rótulo).

---

## 2. Modelo de dados (migração)

A sessão ao vivo é **estado efêmero no cliente**; ao **finalizar**, grava nas
tabelas que já existem (`workouts` + `exercises`). Ou seja, só precisamos de
tabelas para **rotinas** — nada de tabela de "sessão".

```sql
-- Rotinas (modelos de treino)
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

-- Exercícios de uma rotina (com metas)
create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_sets int,
  target_reps int,
  target_weight_kg numeric,
  rest_seconds int default 90,
  position int not null default 0,
  notes text
);

-- Liga um dia do plano a uma rotina (opcional)
alter table public.workout_plan
  add column routine_id uuid references public.routines(id) on delete set null;

alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;

create policy "own routines" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own routine_exercises" on public.routine_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

`lib/types.ts` ganha `Routine` e `RoutineExercise`.

---

## 3. UX / telas

- **Nova aba/seção "Rotinas"** (ou reformular "Plano semanal"):
  - Lista de rotinas → criar/editar (nome + exercícios com metas + descanso).
  - Botão **"Iniciar treino"** em cada rotina.
- **Tela de sessão ao vivo** (`/app/treinos/sessao` ou modal full-screen):
  - Cabeçalho: nome da rotina + tempo total decorrido.
  - Lista de exercícios; o atual em destaque.
  - Cada série: `reps` e `carga` pré-preenchidos pela **meta** ou pela **última
    vez** (usa o `perfByName` já calculado). Botão **"✓ Concluir série"**
    → dispara o **RestTimer** (componente já existente) com o `rest_seconds`.
  - Barra de progresso (séries concluídas / total).
  - **Detecção de PR** ao vivo (novo recorde de carga/1RM) com comemoração.
  - **"Finalizar treino"** → grava `workouts` + `exercises` (fluxo atual) e
    marca `plan_completions` se veio do plano.
  - "Descartar" cancela sem salvar.

## 4. Componentes novos

- `RoutineEditor` — CRUD de rotina + exercícios (reaproveita o form atual).
- `ExercisePicker` — autocompletar por exercícios já usados (base do M3:
  biblioteca de exercícios).
- `WorkoutSession` — a tela ao vivo (usa `RestTimer`).
- Reuso: `RestTimer`, `PlateCalculator`, `progressionHint`, `perfByName`.

## 5. Integração com a Gaia

- Nova ação `criar_rotina(nome, exercicios[])` → cria `routines` +
  `routine_exercises`. A `adicionar_ao_plano_semanal` pode passar a criar/ligar
  rotina em vez de só rótulo.

---

## 6. Faseamento sugerido do M1

1. **M1a** — Migração + CRUD de rotinas (criar/editar/excluir, com metas).
2. **M1b** — "Iniciar treino" → tela de sessão ao vivo com RestTimer e
   pré-preenchimento; "Finalizar" grava em `workouts`/`exercises`.
3. **M1c** — Vínculo Plano ⇆ Rotina ("Iniciar treino de hoje").
4. **M1d** — Gaia cria rotinas completas (`criar_rotina`).

## 7. Riscos / notas

- Maior esforço de UI (tela de sessão) — vale caprichar no mobile (PWA).
- Nada de wearable/Apple Health aqui (fora do escopo do PWA).
- Manter o histórico atual compatível: a sessão ao vivo só **grava** no mesmo
  formato de hoje, então gráficos/progressão continuam funcionando.
