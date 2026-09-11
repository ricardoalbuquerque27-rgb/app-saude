import { Skel, SkelHeader } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkelHeader />
      {/* Hoje */}
      <div className="card">
        <Skel className="h-4 w-16" />
        <Skel className="mt-3 h-16 w-full" />
        <div className="mt-4 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skel key={i} className="h-7 w-24 rounded-full" />
          ))}
        </div>
      </div>
      {/* Seu dia */}
      <div className="card">
        <Skel className="h-4 w-20" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <Skel key={i} className="mx-auto h-20 w-20 rounded-full" />
          ))}
        </div>
      </div>
      {/* Progresso */}
      <div className="card">
        <Skel className="h-4 w-24" />
        <Skel className="mt-4 h-40 w-full" />
      </div>
    </div>
  );
}
