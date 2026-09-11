import { Skel } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="max-w-3xl">
      <Skel className="mb-4 h-4 w-24" />
      <div className="mb-4 flex items-center gap-3">
        <Skel className="h-14 w-14 shrink-0 rounded-2xl" />
        <div>
          <Skel className="h-7 w-44" />
          <Skel className="mt-2 h-3 w-52" />
        </div>
      </div>
      <div className="mb-5 flex gap-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skel key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card">
            <Skel className="h-4 w-4" />
            <Skel className="mt-3 h-6 w-16" />
            <Skel className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="card">
        <Skel className="h-4 w-32" />
        <Skel className="mt-4 h-28 w-full" />
      </div>
    </div>
  );
}
