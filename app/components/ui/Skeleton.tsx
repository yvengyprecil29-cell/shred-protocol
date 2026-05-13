export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative overflow-hidden bg-shred-surface2 rounded-shred skeleton-shimmer ${className}`}
      style={style}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  );
}

export function SkeletonRing({ size = 88 }: { size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-full bg-shred-surface2 skeleton-shimmer relative overflow-hidden"
        style={{ width: size, height: size }}
      />
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-2 w-12" />
    </div>
  );
}
