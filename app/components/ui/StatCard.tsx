type BorderTone = "accent" | "accent2" | "accent3" | "muted";

const borderMap: Record<BorderTone, string> = {
  accent: "border-t-shred-accent",
  accent2: "border-t-shred-accent2",
  accent3: "border-t-shred-accent3",
  muted: "border-t-shred-muted",
};

export function StatCard({
  title,
  value,
  subtitle,
  border = "accent",
}: {
  title: string;
  value: string;
  subtitle?: string;
  border?: BorderTone;
}) {
  return (
    <div
      className={`rounded-shred border border-shred-border bg-shred-surface p-4 border-t-4 ${borderMap[border]} shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]`}
    >
      <p className="font-mono text-xs uppercase tracking-wider text-shred-muted">{title}</p>
      <p className="font-display text-3xl tracking-wide text-shred-text mt-1">{value}</p>
      {subtitle ? <p className="text-xs text-shred-muted mt-1 font-sans">{subtitle}</p> : null}
    </div>
  );
}
