// Ações que o assistente de IA pode executar no app do usuário.
//
// Cada "tool" é exposta ao modelo (Groq) no formato OpenAI. Quando o modelo
// decide usar uma, o servidor executa a escrita no Supabase usando o cliente
// autenticado do próprio usuário (a RLS garante que ele só escreve nos seus
// próprios dados). O user_id é sempre definido pelo servidor, nunca pelo modelo.

import { todayISO, addDaysISO } from "@/lib/date";

// Formato das ferramentas para a API de chat (compatível com OpenAI/Groq).
export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "adicionar_ao_plano_semanal",
      description:
        "Adiciona uma ou mais sessões de treino ao PLANO SEMANAL do usuário (a aba 'Plano semanal' da área de Treinos). Use quando o usuário pedir para montar/adicionar/salvar um treino ou uma rotina semanal no plano dele.",
      parameters: {
        type: "object",
        properties: {
          sessoes: {
            type: "array",
            description: "Lista de sessões de treino, uma por dia da semana.",
            items: {
              type: "object",
              properties: {
                dia_semana: {
                  type: "integer",
                  description:
                    "Dia da semana: 0=Segunda, 1=Terça, 2=Quarta, 3=Quinta, 4=Sexta, 5=Sábado, 6=Domingo.",
                  minimum: 0,
                  maximum: 6,
                },
                esporte: {
                  type: "string",
                  description:
                    "Modalidade/esporte. Ex.: Musculação, Corrida, Ciclismo, Natação, Funcional, HIIT, Yoga, Descanso.",
                },
                titulo: {
                  type: "string",
                  description:
                    "Foco do dia (opcional). Ex.: 'Treino A — Peito e tríceps', 'Corrida 5km'.",
                },
                observacoes: {
                  type: "string",
                  description:
                    "Detalhes do treino (opcional). Ex.: exercícios, séries, intensidade.",
                },
              },
              required: ["dia_semana", "esporte"],
            },
          },
        },
        required: ["sessoes"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_treino",
      description:
        "Registra um treino JÁ FEITO no histórico de treinos (com exercícios, séries e carga). Use quando o usuário disser que fez/concluiu um treino e quiser registrá-lo.",
      parameters: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "Nome do treino. Ex.: 'Treino A — Peito e tríceps'.",
          },
          data: {
            type: "string",
            description: "Data no formato AAAA-MM-DD. Se omitido, usa hoje.",
          },
          categoria: {
            type: "string",
            description: "Categoria/grupo muscular ou modalidade. Ex.: 'Musculação'.",
          },
          duracao_min: { type: "number", description: "Duração em minutos." },
          observacoes: { type: "string", description: "Observações do treino." },
          exercicios: {
            type: "array",
            description: "Exercícios feitos no treino.",
            items: {
              type: "object",
              properties: {
                nome: { type: "string", description: "Nome do exercício." },
                series: {
                  type: "array",
                  description: "Séries do exercício.",
                  items: {
                    type: "object",
                    properties: {
                      reps: { type: "number", description: "Repetições." },
                      carga_kg: { type: "number", description: "Carga em kg." },
                    },
                  },
                },
                rpe: { type: "number", description: "Esforço percebido (1 a 10)." },
              },
              required: ["nome"],
            },
          },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_refeicao",
      description:
        "Registra uma refeição no diário de alimentação (aba Dieta), com macros quando possível. Use quando o usuário quiser registrar/adicionar o que comeu.",
      parameters: {
        type: "object",
        properties: {
          descricao: {
            type: "string",
            description: "O que foi comido. Ex.: '150g de frango grelhado com arroz e salada'.",
          },
          tipo: {
            type: "string",
            description: "Tipo da refeição.",
            enum: [
              "Café da manhã",
              "Lanche da manhã",
              "Almoço",
              "Lanche da tarde",
              "Jantar",
              "Ceia",
            ],
          },
          calorias: { type: "number", description: "Calorias estimadas (kcal)." },
          proteina_g: { type: "number", description: "Proteína em gramas." },
          carbo_g: { type: "number", description: "Carboidratos em gramas." },
          gordura_g: { type: "number", description: "Gordura em gramas." },
          data: {
            type: "string",
            description: "Data no formato AAAA-MM-DD. Se omitido, usa hoje.",
          },
        },
        required: ["descricao"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_agua",
      description:
        "Adiciona uma quantidade de água (em ml) ao total de hoje, na aba Hábitos. Use quando o usuário disser que bebeu água.",
      parameters: {
        type: "object",
        properties: {
          ml: {
            type: "number",
            description: "Quantidade de água a adicionar, em mililitros. Ex.: 500.",
          },
        },
        required: ["ml"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_peso",
      description:
        "Registra o peso corporal (e opcionalmente % de gordura) na aba Medidas. Use quando o usuário informar o peso atual e quiser registrar.",
      parameters: {
        type: "object",
        properties: {
          peso_kg: { type: "number", description: "Peso corporal em kg." },
          gordura_pct: { type: "number", description: "Percentual de gordura (opcional)." },
          data: {
            type: "string",
            description: "Data no formato AAAA-MM-DD. Se omitido, usa hoje.",
          },
        },
        required: ["peso_kg"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_exame",
      description:
        "Registra o resultado de um exame na aba Exames. Use quando o usuário informar um resultado de exame (ex.: colesterol, glicose, vitamina D) e quiser guardar.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Nome do exame. Ex.: 'Colesterol total', 'Glicose', 'Vitamina D'.",
          },
          valor: {
            type: "string",
            description: "Valor do resultado. Ex.: '190', '5.4'.",
          },
          unidade: {
            type: "string",
            description: "Unidade do resultado. Ex.: 'mg/dL', 'ng/mL'.",
          },
          referencia: {
            type: "string",
            description: "Faixa de referência (opcional). Ex.: '< 200', '70-99'.",
          },
          status: {
            type: "string",
            description:
              "Situação do resultado: 'normal' (dentro do esperado), 'atencao' (limítrofe) ou 'alterado' (fora da faixa).",
            enum: ["normal", "atencao", "alterado"],
          },
          tipo: {
            type: "string",
            description: "Categoria do exame (opcional). Ex.: 'Sangue', 'Hormonal'.",
          },
          observacoes: { type: "string", description: "Observações (opcional)." },
          data: {
            type: "string",
            description: "Data do exame no formato AAAA-MM-DD. Se omitido, usa hoje.",
          },
        },
        required: ["titulo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_dose",
      description:
        "Registra a aplicação da dose do tratamento com caneta (GLP-1, ex.: Ozempic, Mounjaro, Wegovy) na aba Tratamento, e atualiza a data da próxima dose. Use quando o usuário disser que aplicou/tomou a caneta. Só funciona se o usuário já tiver um tratamento ativo cadastrado.",
      parameters: {
        type: "object",
        properties: {
          dose: {
            type: "string",
            description:
              "Dose aplicada (opcional). Ex.: '0.5 mg'. Se omitido, usa a dose cadastrada no tratamento.",
          },
        },
      },
    },
  },
] as const;

type ActionResult = { ok: boolean; resumo: string };

// Área do app afetada por cada ferramenta (usado para recarregar a tela certa).
export const TOOL_AREAS: Record<string, string> = {
  adicionar_ao_plano_semanal: "treinos",
  registrar_treino: "treinos",
  registrar_refeicao: "dieta",
  registrar_agua: "habitos",
  registrar_peso: "medidas",
  registrar_exame: "exames",
  registrar_dose: "tratamento",
};

const DIAS = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

function toNum(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isValidDate(s: any): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Executa uma ação pedida pelo modelo. Retorna um resumo curto para a IA
// confirmar ao usuário. Sempre usa o supabase autenticado + uid do servidor.
export async function executeAction(
  name: string,
  rawArgs: string,
  supabase: any,
  uid: string
): Promise<ActionResult> {
  let args: any = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, resumo: "Não entendi os detalhes. Pode repetir?" };
  }

  try {
    switch (name) {
      case "adicionar_ao_plano_semanal": {
        const sessoes = Array.isArray(args.sessoes) ? args.sessoes : [];
        const limpas = sessoes
          .map((s: any) => ({
            dia: toNum(s?.dia_semana),
            esporte: typeof s?.esporte === "string" ? s.esporte.trim() : "",
            titulo: typeof s?.titulo === "string" ? s.titulo.trim() : "",
            observacoes: typeof s?.observacoes === "string" ? s.observacoes.trim() : "",
          }))
          .filter(
            (s: any) => s.dia != null && s.dia >= 0 && s.dia <= 6 && s.esporte
          );
        if (limpas.length === 0) {
          return { ok: false, resumo: "Nenhuma sessão válida para adicionar." };
        }

        // Posição inicial de cada dia (para manter a ordem na coluna do dia).
        const { data: existentes } = await supabase
          .from("workout_plan")
          .select("day_of_week")
          .eq("user_id", uid);
        const posPorDia: Record<number, number> = {};
        (existentes ?? []).forEach((r: any) => {
          posPorDia[r.day_of_week] = (posPorDia[r.day_of_week] ?? 0) + 1;
        });

        const rows = limpas.map((s: any) => {
          const position = posPorDia[s.dia] ?? 0;
          posPorDia[s.dia] = position + 1;
          return {
            user_id: uid,
            day_of_week: s.dia,
            sport: s.esporte,
            title: s.titulo || null,
            notes: s.observacoes || null,
            position,
          };
        });

        const { error } = await supabase.from("workout_plan").insert(rows);
        if (error) throw error;

        const dias = Array.from(
          new Set(limpas.map((s: any) => DIAS[s.dia]))
        ).join(", ");
        return {
          ok: true,
          resumo: `${rows.length} sessão(ões) adicionada(s) ao plano semanal (${dias}). O usuário pode ver na aba Treinos › Plano semanal.`,
        };
      }

      case "registrar_treino": {
        const nome = typeof args.nome === "string" ? args.nome.trim() : "";
        if (!nome) return { ok: false, resumo: "Faltou o nome do treino." };
        const data = isValidDate(args.data) ? args.data : todayISO();

        const { data: workout, error } = await supabase
          .from("workouts")
          .insert({
            user_id: uid,
            date: data,
            name: nome,
            category:
              typeof args.categoria === "string" && args.categoria.trim()
                ? args.categoria.trim()
                : null,
            duration_min: toNum(args.duracao_min),
            notes:
              typeof args.observacoes === "string" && args.observacoes.trim()
                ? args.observacoes.trim()
                : null,
          })
          .select()
          .single();
        if (error) throw error;

        const exercicios = Array.isArray(args.exercicios) ? args.exercicios : [];
        const rows = exercicios
          .filter((ex: any) => typeof ex?.nome === "string" && ex.nome.trim())
          .map((ex: any, i: number) => {
            const series = Array.isArray(ex.series)
              ? ex.series
                  .map((s: any) => ({
                    reps: toNum(s?.reps),
                    weight: toNum(s?.carga_kg),
                  }))
                  .filter((s: any) => s.reps != null || s.weight != null)
              : [];
            const pesos = series
              .map((s: any) => s.weight)
              .filter((w: any): w is number => w != null);
            return {
              workout_id: workout.id,
              user_id: uid,
              name: ex.nome.trim(),
              sets: series.length || null,
              reps: series[0]?.reps ?? null,
              weight_kg: pesos.length ? Math.max(...pesos) : null,
              sets_json: series.length ? series : null,
              rpe: toNum(ex.rpe),
              position: i,
            };
          });
        if (rows.length) {
          const { error: exErr } = await supabase.from("exercises").insert(rows);
          if (exErr) throw exErr;
        }

        return {
          ok: true,
          resumo: `Treino "${nome}" registrado${
            rows.length ? ` com ${rows.length} exercício(s)` : ""
          } no histórico.`,
        };
      }

      case "registrar_refeicao": {
        const descricao =
          typeof args.descricao === "string" ? args.descricao.trim() : "";
        if (!descricao) return { ok: false, resumo: "Faltou a descrição da refeição." };
        const row: any = {
          user_id: uid,
          date: isValidDate(args.data) ? args.data : todayISO(),
          description: descricao,
          calories: toNum(args.calorias),
          protein_g: toNum(args.proteina_g),
          carbs_g: toNum(args.carbo_g),
          fat_g: toNum(args.gordura_g),
        };
        if (typeof args.tipo === "string" && args.tipo.trim()) {
          row.meal_type = args.tipo.trim();
        }
        const { error } = await supabase.from("meals").insert(row);
        if (error) throw error;
        const cal = toNum(args.calorias);
        return {
          ok: true,
          resumo: `Refeição registrada${cal != null ? ` (~${Math.round(cal)} kcal)` : ""} na aba Dieta.`,
        };
      }

      case "registrar_agua": {
        const ml = toNum(args.ml);
        if (ml == null || ml <= 0) {
          return { ok: false, resumo: "Quantidade de água inválida." };
        }
        const hoje = todayISO();
        const { data: atual } = await supabase
          .from("daily_logs")
          .select("water_ml")
          .eq("user_id", uid)
          .eq("date", hoje)
          .maybeSingle();
        const total = (toNum(atual?.water_ml) ?? 0) + ml;
        const { error } = await supabase
          .from("daily_logs")
          .upsert(
            { user_id: uid, date: hoje, water_ml: total },
            { onConflict: "user_id,date" }
          );
        if (error) throw error;
        return {
          ok: true,
          resumo: `+${ml} ml de água. Total de hoje: ${total} ml (${(total / 1000).toFixed(1)} L).`,
        };
      }

      case "registrar_peso": {
        const peso = toNum(args.peso_kg);
        if (peso == null || peso <= 0) {
          return { ok: false, resumo: "Peso inválido." };
        }
        const { error } = await supabase.from("body_measurements").insert({
          user_id: uid,
          date: isValidDate(args.data) ? args.data : todayISO(),
          weight_kg: peso,
          body_fat_pct: toNum(args.gordura_pct),
        });
        if (error) throw error;
        return { ok: true, resumo: `Peso de ${peso} kg registrado na aba Medidas.` };
      }

      case "registrar_exame": {
        const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
        if (!titulo) return { ok: false, resumo: "Faltou o nome do exame." };
        const status = ["normal", "atencao", "alterado"].includes(args.status)
          ? args.status
          : "normal";
        const { error } = await supabase.from("exams").insert({
          user_id: uid,
          date: isValidDate(args.data) ? args.data : todayISO(),
          title: titulo,
          exam_type:
            typeof args.tipo === "string" && args.tipo.trim() ? args.tipo.trim() : null,
          result_value:
            typeof args.valor === "string" && args.valor.trim()
              ? args.valor.trim()
              : args.valor != null
                ? String(args.valor)
                : null,
          unit:
            typeof args.unidade === "string" && args.unidade.trim()
              ? args.unidade.trim()
              : null,
          reference_range:
            typeof args.referencia === "string" && args.referencia.trim()
              ? args.referencia.trim()
              : null,
          status,
          notes:
            typeof args.observacoes === "string" && args.observacoes.trim()
              ? args.observacoes.trim()
              : null,
        });
        if (error) throw error;
        return { ok: true, resumo: `Exame "${titulo}" registrado na aba Exames.` };
      }

      case "registrar_dose": {
        // Encontra o tratamento ativo (Modo Caneta) do usuário.
        const { data: treat } = await supabase
          .from("treatments")
          .select("id, dose, frequency_days")
          .eq("user_id", uid)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!treat) {
          return {
            ok: false,
            resumo:
              "O usuário ainda não tem um tratamento ativo cadastrado. Oriente-o a configurar o Modo Caneta na aba Tratamento primeiro.",
          };
        }
        const hoje = todayISO();
        // Evita registrar duas doses no mesmo dia.
        const { data: jaHoje } = await supabase
          .from("dose_logs")
          .select("id")
          .eq("user_id", uid)
          .eq("treatment_id", treat.id)
          .eq("date", hoje)
          .limit(1);
        if ((jaHoje ?? []).length > 0) {
          return { ok: true, resumo: "A dose de hoje já estava registrada." };
        }
        const dose =
          typeof args.dose === "string" && args.dose.trim()
            ? args.dose.trim()
            : treat.dose;
        const { error } = await supabase.from("dose_logs").insert({
          user_id: uid,
          treatment_id: treat.id,
          date: hoje,
          dose: dose ?? null,
        });
        if (error) throw error;
        const freq = Number(treat.frequency_days) || 7;
        const proxima = addDaysISO(hoje, freq);
        await supabase
          .from("treatments")
          .update({ next_dose_date: proxima })
          .eq("id", treat.id);
        return {
          ok: true,
          resumo: `Dose${dose ? ` de ${dose}` : ""} registrada. Próxima aplicação prevista para ${proxima}.`,
        };
      }

      default:
        return { ok: false, resumo: "Ação desconhecida." };
    }
  } catch (err: any) {
    console.error("executeAction error:", name, err?.message ?? err);
    return {
      ok: false,
      resumo: "Não consegui salvar agora. Tente novamente em instantes.",
    };
  }
}
