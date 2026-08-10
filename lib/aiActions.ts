// Ações que o assistente de IA pode executar no app do usuário.
//
// Cada "tool" é exposta ao modelo (Groq) no formato OpenAI. Quando o modelo
// decide usar uma, o servidor executa a escrita no Supabase usando o cliente
// autenticado do próprio usuário (a RLS garante que ele só escreve nos seus
// próprios dados). O user_id é sempre definido pelo servidor, nunca pelo modelo.

import { todayISO, addDaysISO } from "@/lib/date";
import { classifyExam, EXAM_STATUS_LABEL, type Sex } from "@/lib/examRanges";

// Idade em anos a partir da data de nascimento (AAAA-MM-DD).
function ageFromBirth(birth?: string | null): number | null {
  if (!birth) return null;
  const d = new Date(birth + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  const age = Math.floor(ms / (365.25 * 24 * 3600 * 1000));
  return age >= 0 && age < 130 ? age : null;
}

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
        "Ajusta a água de hoje na aba Hábitos. Use ml positivo quando o usuário bebeu água (ex.: 500) e ml NEGATIVO para corrigir/tirar (ex.: -500 se registrou errado).",
      parameters: {
        type: "object",
        properties: {
          ml: {
            type: "number",
            description:
              "Quantidade em mililitros a somar (positivo) ou subtrair (negativo) do total de hoje.",
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
        "Registra o resultado de um exame na aba Exames. Use quando o usuário informar um resultado de exame (ex.: colesterol, glicose, vitamina D) e quiser guardar. NÃO tente classificar se está normal/alterado: o app calcula isso automaticamente com base em faixas de referência ajustadas por sexo e idade. Apenas extraia nome, valor e unidade.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Nome do exame. Ex.: 'Colesterol total', 'Glicose', 'Vitamina D'.",
          },
          valor: {
            type: "string",
            description: "Valor numérico do resultado. Ex.: '190', '5.4'.",
          },
          unidade: {
            type: "string",
            description: "Unidade do resultado. Ex.: 'mg/dL', 'ng/mL'.",
          },
          referencia: {
            type: "string",
            description:
              "Faixa de referência informada pelo laudo, se o usuário disser (opcional). Ex.: '< 200', '70-99'.",
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
          sexo: {
            type: "string",
            description: "Sexo biológico, se informado no chat (para classificar).",
            enum: ["M", "F"],
          },
          idade: {
            type: "number",
            description: "Idade, se informada no chat (opcional).",
          },
        },
        required: ["titulo", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "avaliar_exame",
      description:
        "Classifica um resultado de exame (normal/atenção/alterado) SEM salvar nada. Use quando o usuário só quiser saber se um valor está bom (pergunta de curiosidade, ex.: 'colesterol 190 tá normal?'). Depois de avaliar, PERGUNTE se ele quer que você adicione na aba Exames — só aí use 'registrar_exame'. Se a resposta indicar que falta o sexo, peça o sexo (ou que ele preencha no perfil) e chame de novo passando 'sexo'.",
      parameters: {
        type: "object",
        properties: {
          titulo: {
            type: "string",
            description: "Nome do exame. Ex.: 'Colesterol total', 'Glicose'.",
          },
          valor: { type: "string", description: "Valor numérico do resultado." },
          unidade: { type: "string", description: "Unidade. Ex.: 'mg/dL'." },
          referencia: {
            type: "string",
            description: "Faixa de referência do laudo, se informada (opcional).",
          },
          sexo: {
            type: "string",
            description:
              "Sexo biológico do usuário, se ele informar no chat (usado quando não está no perfil).",
            enum: ["M", "F"],
          },
          idade: {
            type: "number",
            description: "Idade do usuário, se ele informar no chat (opcional).",
          },
        },
        required: ["titulo", "valor"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_perfil",
      description:
        "Salva dados de cadastro do usuário no perfil: sexo e altura. Use quando o usuário informar esses dados no chat (por exemplo, quando você precisar do sexo para avaliar um exame e ele responder). Isso deixa salvo para as próximas vezes. (Para a idade exata, oriente preencher a data de nascimento no Perfil.)",
      parameters: {
        type: "object",
        properties: {
          sexo: {
            type: "string",
            description: "Sexo biológico.",
            enum: ["M", "F"],
          },
          altura_cm: { type: "number", description: "Altura em centímetros." },
        },
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
  {
    type: "function",
    function: {
      name: "registrar_habito",
      description:
        "Registra hábitos do dia na aba Hábitos: sono, humor, energia, estresse e passos. Use quando o usuário contar como dormiu/se sente/passos. (Para água, use registrar_agua.)",
      parameters: {
        type: "object",
        properties: {
          sono_horas: { type: "number", description: "Horas de sono. Ex.: 7.5." },
          humor: {
            type: "string",
            description: "Humor do dia.",
            enum: ["otimo", "bem", "neutro", "cansado", "mal"],
          },
          energia: { type: "number", description: "Energia de 1 (baixa) a 5 (alta)." },
          estresse: { type: "number", description: "Estresse de 1 (baixo) a 5 (alto)." },
          passos: { type: "number", description: "Número de passos no dia." },
          data: { type: "string", description: "Data AAAA-MM-DD. Se omitido, hoje." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "definir_metas",
      description:
        "Define ou ajusta as metas do usuário no perfil: peso alvo, calorias/dia, proteína/dia e água/dia. Use quando o usuário pedir para mudar uma meta.",
      parameters: {
        type: "object",
        properties: {
          peso_alvo_kg: { type: "number", description: "Meta de peso, em kg." },
          calorias_dia: { type: "number", description: "Meta de calorias por dia (kcal)." },
          proteina_dia_g: { type: "number", description: "Meta de proteína por dia (g)." },
          agua_dia_ml: { type: "number", description: "Meta de água por dia (ml)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "concluir_treino_do_plano",
      description:
        "Marca o treino do PLANO DE HOJE como concluído (registra no histórico também). Use quando o usuário disser que fez o treino planejado de hoje.",
      parameters: {
        type: "object",
        properties: {
          esporte: {
            type: "string",
            description:
              "Modalidade a concluir, caso haja mais de um treino planejado hoje (opcional). Ex.: 'Musculação'.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "atualizar_peso",
      description:
        "Corrige/atualiza o peso atual do usuário na aba Medidas (atualiza o registro de hoje ou cria um). Use quando ele disser 'muda meu peso para X' ou corrigir um peso.",
      parameters: {
        type: "object",
        properties: {
          peso_kg: { type: "number", description: "Peso correto, em kg." },
        },
        required: ["peso_kg"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remover_ultimo",
      description:
        "Apaga o ÚLTIMO registro de um tipo. Use quando o usuário pedir para apagar/desfazer o que acabou de registrar (ex.: 'apaga a última refeição', 'desfaz o último treino').",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            description: "O que apagar.",
            enum: ["refeicao", "treino", "peso", "exame"],
          },
        },
        required: ["tipo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remover_do_plano",
      description:
        "Remove uma sessão do plano semanal de treinos. Use quando o usuário pedir para tirar um treino de um dia (ex.: 'tira a corrida de terça').",
      parameters: {
        type: "object",
        properties: {
          dia_semana: {
            type: "integer",
            description: "0=Segunda ... 6=Domingo.",
            minimum: 0,
            maximum: 6,
          },
          esporte: {
            type: "string",
            description: "Modalidade a remover naquele dia (opcional; se omitido, remove todas do dia).",
          },
        },
        required: ["dia_semana"],
      },
    },
  },
] as const;

// area: telas a recarregar (além do mapa estático), útil para ações dinâmicas.
type ActionResult = { ok: boolean; resumo: string; area?: string | string[] };

// Área do app afetada por cada ferramenta (usado para recarregar a tela certa).
export const TOOL_AREAS: Record<string, string> = {
  adicionar_ao_plano_semanal: "treinos",
  registrar_treino: "treinos",
  registrar_refeicao: "dieta",
  registrar_agua: "habitos",
  registrar_peso: "medidas",
  registrar_exame: "exames",
  registrar_dose: "tratamento",
  registrar_habito: "habitos",
  concluir_treino_do_plano: "treinos",
  atualizar_peso: "medidas",
  remover_do_plano: "treinos",
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
        if (ml == null || ml === 0) {
          return { ok: false, resumo: "Quantidade de água inválida." };
        }
        const hoje = todayISO();
        const { data: atual } = await supabase
          .from("daily_logs")
          .select("water_ml")
          .eq("user_id", uid)
          .eq("date", hoje)
          .maybeSingle();
        const total = Math.max(0, (toNum(atual?.water_ml) ?? 0) + ml);
        const { error } = await supabase
          .from("daily_logs")
          .upsert(
            { user_id: uid, date: hoje, water_ml: total },
            { onConflict: "user_id,date" }
          );
        if (error) throw error;
        const sinal = ml > 0 ? `+${ml}` : `${ml}`;
        return {
          ok: true,
          resumo: `${sinal} ml de água. Total de hoje: ${total} ml (${(total / 1000).toFixed(1)} L).`,
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
        const valor =
          typeof args.valor === "string" && args.valor.trim()
            ? args.valor.trim()
            : args.valor != null
              ? String(args.valor)
              : null;
        const unidade =
          typeof args.unidade === "string" && args.unidade.trim()
            ? args.unidade.trim()
            : null;
        const refInformada =
          typeof args.referencia === "string" && args.referencia.trim()
            ? args.referencia.trim()
            : null;
        const obs =
          typeof args.observacoes === "string" && args.observacoes.trim()
            ? args.observacoes.trim()
            : null;

        // Personaliza a classificação com sexo e idade (perfil + o que veio no chat).
        const { data: prof } = await supabase
          .from("profiles")
          .select("sex, birth_date")
          .eq("id", uid)
          .maybeSingle();
        const sexoArg = args.sexo === "M" || args.sexo === "F" ? args.sexo : null;
        const idadeArg = toNum(args.idade);
        const cls = classifyExam({
          name: titulo,
          value: valor,
          unit: unidade,
          reference: refInformada,
          ctx: {
            sex: (sexoArg ?? (prof?.sex as Sex) ?? null) as Sex,
            age: idadeArg != null ? idadeArg : ageFromBirth(prof?.birth_date),
          },
        });

        const status = cls.matched ? cls.status : "normal";
        const reference_range = cls.faixa || refInformada;
        const notes = [obs, cls.matched ? cls.explicacao : null].filter(Boolean).join(" — ") || null;

        const { error } = await supabase.from("exams").insert({
          user_id: uid,
          date: isValidDate(args.data) ? args.data : todayISO(),
          title: titulo,
          exam_type:
            typeof args.tipo === "string" && args.tipo.trim() ? args.tipo.trim() : null,
          result_value: valor,
          unit: unidade,
          reference_range: reference_range,
          status,
          notes,
        });
        if (error) throw error;

        const resumo = cls.matched
          ? `Exame "${titulo}" registrado como ${EXAM_STATUS_LABEL[status]} (${cls.explicacao}) na aba Exames.`
          : cls.needs?.includes("sexo")
            ? `Exame "${titulo}" registrado, mas NÃO classifiquei porque falta o sexo. Sugira ao usuário informar o sexo (no Perfil ou aqui no chat) para eu classificar.`
            : `Exame "${titulo}" registrado na aba Exames. Não consegui classificar automaticamente (fora da minha tabela); confirme com um profissional.`;
        return { ok: true, resumo };
      }

      case "avaliar_exame": {
        const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
        const valor =
          typeof args.valor === "string" && args.valor.trim()
            ? args.valor.trim()
            : args.valor != null
              ? String(args.valor)
              : null;
        if (!titulo || valor == null) {
          return { ok: false, resumo: "Preciso do nome e do valor do exame." };
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("sex, birth_date")
          .eq("id", uid)
          .maybeSingle();
        const sexoArg = args.sexo === "M" || args.sexo === "F" ? args.sexo : null;
        const idadeArg = toNum(args.idade);
        const cls = classifyExam({
          name: titulo,
          value: valor,
          unit: typeof args.unidade === "string" ? args.unidade : null,
          reference: typeof args.referencia === "string" ? args.referencia : null,
          ctx: {
            sex: (sexoArg ?? (prof?.sex as Sex) ?? null) as Sex,
            age: idadeArg != null ? idadeArg : ageFromBirth(prof?.birth_date),
          },
        });
        if (cls.needs?.includes("sexo")) {
          return {
            ok: true,
            resumo: `Para avaliar "${titulo}" eu preciso saber o SEXO do usuário (as faixas mudam muito entre homens e mulheres). PEÇA o sexo — ele pode preencher no Perfil ou te dizer agora aqui no chat. Quando ele disser, use atualizar_perfil para salvar e chame avaliar_exame de novo (ou passe o parâmetro 'sexo').`,
          };
        }
        if (!cls.matched) {
          return {
            ok: true,
            resumo: `Não tenho faixa de referência confiável para "${titulo}". NÃO foi salvo. Oriente a confirmar o valor de referência no laudo ou com um profissional. Pergunte se mesmo assim quer registrar na aba Exames.`,
          };
        }
        return {
          ok: true,
          resumo: `Avaliação (NÃO salva): ${titulo} = ${valor} → ${EXAM_STATUS_LABEL[cls.status]}. ${cls.explicacao} Agora PERGUNTE ao usuário se ele quer que você adicione este exame na aba Exames.`,
        };
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

      case "atualizar_perfil": {
        const patch: any = { id: uid, updated_at: new Date().toISOString() };
        const partes: string[] = [];
        if (args.sexo === "M" || args.sexo === "F") {
          patch.sex = args.sexo;
          partes.push(`sexo ${args.sexo === "F" ? "feminino" : "masculino"}`);
        }
        const alt = toNum(args.altura_cm);
        if (alt != null && alt > 0) {
          patch.height_cm = alt;
          partes.push(`${alt} cm`);
        }
        if (partes.length === 0) {
          return { ok: false, resumo: "Nada de perfil para atualizar." };
        }
        const { error } = await supabase.from("profiles").upsert(patch);
        if (error) throw error;
        return { ok: true, resumo: `Perfil atualizado: ${partes.join(", ")}.` };
      }

      case "registrar_habito": {
        const hoje = isValidDate(args.data) ? args.data : todayISO();
        const patch: any = { user_id: uid, date: hoje };
        const partes: string[] = [];
        const sono = toNum(args.sono_horas);
        if (sono != null) {
          patch.sleep_hours = sono;
          partes.push(`sono ${sono}h`);
        }
        if (typeof args.humor === "string" && args.humor.trim()) {
          const map: Record<string, string> = {
            otimo: "otimo", "ótimo": "otimo", feliz: "otimo", excelente: "otimo",
            bem: "bem", bom: "bem", tranquilo: "bem",
            neutro: "neutro", normal: "neutro", ok: "neutro",
            cansado: "cansado", cansada: "cansado", exausto: "cansado",
            mal: "mal", triste: "mal", ruim: "mal", pessimo: "mal", "péssimo": "mal",
          };
          const h = map[args.humor.trim().toLowerCase()];
          if (h) {
            patch.mood = h;
            partes.push(`humor ${h}`);
          }
        }
        const energia = toNum(args.energia);
        if (energia != null) {
          patch.energy = Math.max(1, Math.min(5, Math.round(energia)));
          partes.push(`energia ${patch.energy}/5`);
        }
        const estresse = toNum(args.estresse);
        if (estresse != null) {
          patch.stress = Math.max(1, Math.min(5, Math.round(estresse)));
          partes.push(`estresse ${patch.stress}/5`);
        }
        const passos = toNum(args.passos);
        if (passos != null) {
          patch.steps = Math.max(0, Math.round(passos));
          partes.push(`${patch.steps} passos`);
        }
        if (partes.length === 0) {
          return { ok: false, resumo: "Nada de hábito para registrar." };
        }
        const { error } = await supabase
          .from("daily_logs")
          .upsert(patch, { onConflict: "user_id,date" });
        if (error) throw error;
        return { ok: true, resumo: `Registrei ${partes.join(", ")} na aba Hábitos.` };
      }

      case "definir_metas": {
        const patch: any = { id: uid, updated_at: new Date().toISOString() };
        const partes: string[] = [];
        const peso = toNum(args.peso_alvo_kg);
        if (peso != null) {
          patch.weight_goal_kg = peso;
          partes.push(`peso alvo ${peso} kg`);
        }
        const cal = toNum(args.calorias_dia);
        if (cal != null) {
          patch.daily_calorie_goal = Math.round(cal);
          partes.push(`${Math.round(cal)} kcal/dia`);
        }
        const prot = toNum(args.proteina_dia_g);
        if (prot != null) {
          patch.protein_goal_g = Math.round(prot);
          partes.push(`${Math.round(prot)} g de proteína/dia`);
        }
        const agua = toNum(args.agua_dia_ml);
        if (agua != null) {
          patch.daily_water_goal_ml = Math.round(agua);
          partes.push(`${Math.round(agua)} ml de água/dia`);
        }
        if (partes.length === 0) {
          return { ok: false, resumo: "Nenhuma meta para ajustar." };
        }
        const { error } = await supabase.from("profiles").upsert(patch);
        if (error) throw error;
        return {
          ok: true,
          resumo: `Metas atualizadas: ${partes.join(", ")}.`,
          area: ["dieta", "medidas", "habitos"],
        };
      }

      case "concluir_treino_do_plano": {
        const hoje = todayISO();
        const dow = (new Date(hoje + "T12:00:00").getDay() + 6) % 7; // 0=Segunda
        const { data: sessoes } = await supabase
          .from("workout_plan")
          .select("id, sport, title")
          .eq("user_id", uid)
          .eq("day_of_week", dow);
        let lista = (sessoes ?? []) as any[];
        lista = lista.filter((s) => !String(s.sport).toLowerCase().includes("descanso"));
        if (lista.length === 0) {
          return { ok: true, resumo: "Não há treino planejado para hoje." };
        }
        if (typeof args.esporte === "string" && args.esporte.trim()) {
          const e = args.esporte.trim().toLowerCase();
          lista = lista.filter((s) => String(s.sport).toLowerCase().includes(e));
          if (lista.length === 0) {
            return { ok: true, resumo: `Não achei "${args.esporte}" no plano de hoje.` };
          }
        }
        if (lista.length > 1) {
          const nomes = lista.map((s) => s.sport).join(", ");
          return {
            ok: true,
            resumo: `Há mais de um treino hoje (${nomes}). Pergunte qual concluir.`,
          };
        }
        const s = lista[0];
        const { data: jaFeito } = await supabase
          .from("plan_completions")
          .select("id")
          .eq("user_id", uid)
          .eq("plan_id", s.id)
          .eq("date", hoje)
          .limit(1);
        if ((jaFeito ?? []).length > 0) {
          return { ok: true, resumo: `O treino de ${s.sport} já estava marcado como concluído hoje.` };
        }
        const { data: w } = await supabase
          .from("workouts")
          .insert({
            user_id: uid,
            date: hoje,
            name: s.title || s.sport,
            category: s.sport,
            notes: "Concluído pelo plano semanal",
          })
          .select()
          .single();
        const { error } = await supabase.from("plan_completions").insert({
          user_id: uid,
          plan_id: s.id,
          date: hoje,
          workout_id: w?.id ?? null,
        });
        if (error) throw error;
        return { ok: true, resumo: `Treino de ${s.sport} marcado como concluído hoje. 🌱` };
      }

      case "atualizar_peso": {
        const peso = toNum(args.peso_kg);
        if (peso == null || peso <= 0) return { ok: false, resumo: "Peso inválido." };
        const hoje = todayISO();
        const { data: hojeReg } = await supabase
          .from("body_measurements")
          .select("id")
          .eq("user_id", uid)
          .eq("date", hoje)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (hojeReg?.id) {
          const { error } = await supabase
            .from("body_measurements")
            .update({ weight_kg: peso })
            .eq("id", hojeReg.id);
          if (error) throw error;
          return { ok: true, resumo: `Peso de hoje atualizado para ${peso} kg.` };
        }
        const { error } = await supabase.from("body_measurements").insert({
          user_id: uid,
          date: hoje,
          weight_kg: peso,
        });
        if (error) throw error;
        return { ok: true, resumo: `Peso de ${peso} kg registrado (hoje).` };
      }

      case "remover_ultimo": {
        const tipo = String(args.tipo || "");
        const conf: Record<string, { table: string; area: string; label: string; order: string }> = {
          refeicao: { table: "meals", area: "dieta", label: "refeição", order: "created_at" },
          treino: { table: "workouts", area: "treinos", label: "treino", order: "created_at" },
          peso: { table: "body_measurements", area: "medidas", label: "registro de peso", order: "created_at" },
          exame: { table: "exams", area: "exames", label: "exame", order: "created_at" },
        };
        const c = conf[tipo];
        if (!c) return { ok: false, resumo: "Tipo inválido para remover." };
        const { data: last } = await supabase
          .from(c.table)
          .select("id")
          .eq("user_id", uid)
          .order(c.order, { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!last?.id) {
          return { ok: true, resumo: `Não há ${c.label} para apagar.` };
        }
        if (c.table === "workouts") {
          // Remove exercícios antes (evita órfãos) e a conclusão do plano ligada.
          await supabase.from("exercises").delete().eq("workout_id", last.id);
          await supabase.from("plan_completions").delete().eq("workout_id", last.id);
        }
        const { error } = await supabase.from(c.table).delete().eq("id", last.id);
        if (error) throw error;
        return { ok: true, resumo: `Última ${c.label} apagada.`, area: c.area };
      }

      case "remover_do_plano": {
        const dia = toNum(args.dia_semana);
        if (dia == null || dia < 0 || dia > 6) {
          return { ok: false, resumo: "Diga o dia da semana para remover do plano." };
        }
        let q = supabase
          .from("workout_plan")
          .delete()
          .eq("user_id", uid)
          .eq("day_of_week", dia);
        let alvo = DIAS[dia];
        if (typeof args.esporte === "string" && args.esporte.trim()) {
          q = q.ilike("sport", `%${args.esporte.trim()}%`);
          alvo = `${args.esporte.trim()} de ${DIAS[dia]}`;
        }
        const { error, count } = await q.select("id", { count: "exact" });
        if (error) throw error;
        if (!count) {
          return { ok: true, resumo: `Não achei nada no plano de ${DIAS[dia]} para remover.` };
        }
        return { ok: true, resumo: `Removi do plano: ${alvo}.` };
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
