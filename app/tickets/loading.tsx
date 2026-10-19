import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-4 w-56" />
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </section>
    </div>
  );
}
