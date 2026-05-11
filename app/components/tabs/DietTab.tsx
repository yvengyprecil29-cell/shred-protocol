import { USER } from "@/lib/constants";

export function DietTab() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Diet plan</h1>
        <p className="text-shred-muted mt-2 max-w-3xl">
          Reference meals for {USER.name}. Numbers are targets, not tracked here — log intake in{" "}
          <span className="text-shred-accent3">Daily</span>.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-shred border border-t-4 border-t-shred-accent border-shred-border bg-shred-surface px-3 py-2 font-mono text-xs text-shred-text">
          Training day: 2,250 kcal · 150g carbs
        </span>
        <span className="rounded-shred border border-t-4 border-t-shred-accent3 border-shred-border bg-shred-surface px-3 py-2 font-mono text-xs text-shred-text">
          Rest day: 2,100 kcal · 100g carbs
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MealCard
          title="Meal 1 — Wake up (7–8am)"
          border="accent3"
          lines={[
            "4 whole eggs + 4 whites",
            "Avocado 80g",
            "Fromage blanc 0% 200g",
            "Oatmeal 50g — training days only",
            "~600–790 kcal · ~55g protein",
          ]}
        />
        <MealCard
          title="Pre-workout (~1h30 before, training only)"
          border="accent"
          lines={[
            "Chicken / tuna / turkey 180g",
            "White rice or sweet potato 150g cooked (~50g carbs)",
            "Green vegetables",
            "~435 kcal · ~45g protein · ~50g carbs",
          ]}
        />
        <MealCard
          title="Post-workout (+30min, training only)"
          border="accent2"
          lines={[
            "Skyr or fromage blanc 0% 300g",
            "Banana or rice (~30g carbs)",
            "Creatine 5g with water",
            "~275 kcal · ~35g protein · ~30g carbs",
          ]}
        />
        <MealCard
          title="Dinner (7–8pm, daily)"
          border="muted"
          lines={[
            "Salmon / mackerel / beef 5% fat 200g",
            "Green vegetables — unlimited",
            "Olive oil 15g",
            "Lentils 80g cooked — rest days only",
            "~500–590 kcal · ~50g protein · near-zero carbs",
          ]}
        />
      </div>

      <div className="rounded-shred border border-shred-border border-t-4 border-t-shred-accent bg-shred-surface2 p-5">
        <h2 className="font-display text-2xl tracking-wide text-shred-text">Creatine · Hydration · Refeed</h2>
        <ul className="mt-3 space-y-2 text-sm text-shred-muted list-disc pl-5">
          <li>
            <span className="text-shred-text">Creatine:</span> {USER.supplementNote}
          </li>
          <li>
            <span className="text-shred-text">Hydration:</span> track water in Daily; aim consistent intake
            especially training days.
          </li>
          <li>
            <span className="text-shred-text">Refeed:</span> if WHOOP recovery stays low multiple days, add ~50g
            carbs at dinner once — see WHOOP tab alert.
          </li>
        </ul>
      </div>
    </div>
  );
}

function MealCard({
  title,
  lines,
  border,
}: {
  title: string;
  lines: string[];
  border: "accent" | "accent2" | "accent3" | "muted";
}) {
  const map = {
    accent: "border-t-shred-accent",
    accent2: "border-t-shred-accent2",
    accent3: "border-t-shred-accent3",
    muted: "border-t-shred-muted",
  } as const;
  return (
    <div className={`rounded-shred border border-shred-border bg-shred-surface p-4 border-t-4 ${map[border]}`}>
      <h3 className="font-display text-xl tracking-wide text-shred-text">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-sm text-shred-muted">
        {lines.map((l) => (
          <li key={l} className="leading-relaxed">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
