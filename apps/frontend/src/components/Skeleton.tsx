export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-line-soft ${className}`} />;
}

export function SkeletonCardLista() {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-raised p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <Skeleton className="h-3.5 w-3/5 rounded-md" />
          <Skeleton className="h-3 w-1/4 rounded-md" />
        </div>
        <Skeleton className="h-6 w-20 shrink-0 rounded-pill" />
      </div>
      <Skeleton className="h-16 w-full rounded-field" />
      <Skeleton className="h-3 w-2/5 rounded-md" />
    </div>
  );
}
