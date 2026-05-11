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
  return (
    <div>
      <div className="flex justify-between text-sm font-mono text-shred-muted mb-1">
        <span>{label}</span>
        <span className="text-shred-text">
          {current}
          {unit} / {target}
          {unit}
        </span>
      </div>
      <div className="h-2 rounded-shred bg-shred-surface2 overflow-hidden border border-shred-border">
        <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
