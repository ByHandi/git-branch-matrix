import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-3 p-6">
      <Skeleton className="h-4 w-16" />
      <section className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
