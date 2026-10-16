"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  BarChart,
} from "recharts";

type Point = { label: string; value: number | null };

// Cor só por variável da paleta do app (--app-*, definidas em :root e .dark):
// o par claro/escuro está na variável, então os gráficos acompanham o tema sem
// `dark:` e sem hex aqui. Antes a linha era um verde fixo, os eixos um cinza
// slate-400 (quase sem contraste no escuro) e a grade o mesmo cinza com
// transparência. Os eixos usam `texto-2` (4,5:1 sobre o cartão) e a grade
// `linha`; a dica fica com o fundo do cartão, porque a branca de antes
// ofuscava no escuro.
const COR_PADRAO = "var(--app-primaria)";
const GRADE = "var(--app-linha)";
const EIXO = { fontSize: 11, fill: "var(--app-texto-2)" };
const DICA = {
  borderRadius: 12,
  border: "1px solid var(--app-linha)",
  background: "var(--app-cartao)",
  color: "var(--app-texto)",
  fontSize: 12,
};

export function TrendChart({
  data,
  color = COR_PADRAO,
  unit = "",
}: {
  data: Point[];
  color?: string;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} />
        <XAxis
          dataKey="label"
          tick={EIXO}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={EIXO}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={DICA}
          formatter={(v: any) => [`${v}${unit}`, "Valor"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({
  data,
  color = COR_PADRAO,
  unit = "",
}: {
  data: Point[];
  color?: string;
  unit?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRADE} vertical={false} />
        <XAxis
          dataKey="label"
          tick={EIXO}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={EIXO}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--app-primaria-fundo)" }}
          contentStyle={DICA}
          formatter={(v: any) => [`${v}${unit}`, "Total"]}
        />
        <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
