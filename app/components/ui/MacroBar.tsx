"use client";

export function MacroBar({
  label,
  current,
  target,
  unit,
  colorClass,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  colorClass: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const over = target > 0 && current > target;

  return (
    <div>
      <div className="flex justify-between items-baseline text-xs font-mono mb-1.5">
        <span className="text-shred-muted">{label}</span>
        <span>
          <span className={`font-medium ${over ? "text-shred-accent2" : "text-shred-text"}`}>{current}</span>
          <span className="text-shred-muted">
            {unit} / {target}
            {unit}
          </span>
          <span
            className={`ml-2 text-[10px] tabular-nums ${
              over ? "text-shred-accent2" : pct >= 90 ? "text-shred-accent3" : "text-shred-muted/60"
            }`}
          >
            {pct}%
          </span>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-shred-surface2 overflow-hidden border border-shred-border/40">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass} ${over ? "opacity-60" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
