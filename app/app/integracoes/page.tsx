import { Watch, Activity, HeartPulse, Footprints, Moon, Bike, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui";

const DEVICES = [
  {
    name: "Apple Watch",
    icon: Watch,
    desc: "Passos, frequência cardíaca, sono e treinos via Apple Saúde.",
    note: "Requer app iOS (Apple Saúde não é acessível por site).",
  },
  {
    name: "Garmin",
    icon: Activity,
    desc: "Atividades, frequência cardíaca, sono e VO₂ do Garmin Connect.",
  },
  {
    name: "Whoop",
    icon: HeartPulse,
    desc: "Recuperação, esforço (strain) e sono do Whoop.",
  },
  {
    name: "Fitbit",
    icon: Footprints,
    desc: "Passos, sono e frequência cardíaca.",
  },
  {
    name: "Oura",
    icon: Moon,
    desc: "Sono, prontidão e atividade do anel Oura.",
  },
  {
    name: "Strava",
    icon: Bike,
    desc: "Corridas, pedaladas e outras atividades.",
  },
  {
    name: "Google Fit / Health Connect",
    icon: Smartphone,
    desc: "Passos e atividades no Android.",
  },
];

export default function IntegracoesPage() {
  return (
    <div>
      <PageHeader
        title="Integrações"
        subtitle="Conecte seus dispositivos e apps de saúde."
      />

      <div className="card mb-6">
        <p className="text-sm text-app-texto">
          Em breve você poderá conectar seus wearables para importar automaticamente
          <span className="font-medium"> passos, frequência cardíaca, sono, treinos e recuperação</span> —
          sem precisar digitar nada. Estamos preparando as conexões abaixo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DEVICES.map((d) => (
          <div key={d.name} className="card flex items-start gap-3">
            <div className="icon-badge">
              <d.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-app-texto">{d.name}</p>
                <span className="shrink-0 rounded-full bg-app-pagina px-2 py-0.5 text-[11px] font-medium text-app-texto-2">
                  Em breve
                </span>
              </div>
              <p className="mt-0.5 text-sm text-app-texto-2">{d.desc}</p>
              {d.note && (
                <p className="mt-1 text-xs text-app-texto-2">{d.note}</p>
              )}
              <button
                disabled
                className="btn-ghost mt-3 cursor-not-allowed py-1.5 text-sm opacity-60"
              >
                Conectar
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-app-texto-2">
        As conexões usam login seguro (OAuth) — o Pace Fit nunca vê sua senha do dispositivo.
      </p>
    </div>
  );
}
