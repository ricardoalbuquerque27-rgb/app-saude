// Blocos de esqueleto para as telas renderizadas no servidor. Enquanto a
// consulta ao banco não volta, o Next mostra o loading.tsx da rota — com
// isso a navegação tem resposta imediata em vez de uma tela parada.

export function Skel({ className = "" }: { className?: string }) {
  return <div className={`pf-skel ${className}`} />;
}

export function SkelCard({ className = "" }: { className?: string }) {
  return (
    <div className={`card ${className}`}>
      <Skel className="h-4 w-28" />
      <Skel className="mt-3 h-7 w-20" />
      <Skel className="mt-2 h-3 w-36" />
    </div>
  );
}

export function SkelRow() {
  return (
    <div className="card flex items-center gap-3 p-3">
      <Skel className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <Skel className="h-4 w-32" />
        <Skel className="mt-2 h-3 w-44" />
      </div>
    </div>
  );
}

export function SkelHeader() {
  return (
    <div className="mb-5">
      <Skel className="h-3 w-40" />
      <Skel className="mt-2 h-8 w-52" />
    </div>
  );
}
