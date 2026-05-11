"use client";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "diet", label: "Diet" },
  { id: "training", label: "Training" },
  { id: "tracking", label: "Daily" },
  { id: "whoop", label: "WHOOP" },
  { id: "progress", label: "Progress" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function TabBar({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (id: TabId) => void;
}) {
  return (
    <nav className="sticky top-0 z-20 border-b border-shred-border bg-shred-bg/95 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-3 sm:px-4">
        <div className="flex gap-1 overflow-x-auto py-2 no-scrollbar">
          {TABS.map((t) => {
            const isOn = t.id === active;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={`shrink-0 rounded-shred px-3 py-2 text-sm font-mono uppercase tracking-wide border transition-colors ${
                  isOn
                    ? "bg-shred-surface2 text-shred-accent border-shred-accent"
                    : "bg-shred-surface text-shred-muted border-shred-border hover:text-shred-text"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
