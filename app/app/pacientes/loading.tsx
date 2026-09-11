import { Skel, SkelRow } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-5">
        <Skel className="h-8 w-40" />
        <Skel className="mt-2 h-3 w-64" />
      </div>
      <div className="mb-3 flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <Skel key={i} className="h-8 w-24 rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <SkelRow key={i} />
        ))}
      </div>
    </div>
  );
}
