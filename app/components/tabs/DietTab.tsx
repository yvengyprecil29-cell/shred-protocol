import { USER } from "@/lib/constants";

export function DietTab() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Plan alimentaire</h1>
        <p className="text-shred-muted mt-2 max-w-3xl">
          Repères pour {USER.name}. Les chiffres sont des cibles, pas suivis ici — enregistre tes apports dans{" "}
          <span className="text-shred-accent3">Quotidien</span>.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-shred border border-t-4 border-t-shred-accent border-shred-border bg-shred-surface px-3 py-2 font-mono text-xs text-shred-text">
          Jour d&apos;entraînement : 2 250 kcal · 150 g glucides
        </span>
        <span className="rounded-shred border border-t-4 border-t-shred-accent3 border-shred-border bg-shred-surface px-3 py-2 font-mono text-xs text-shred-text">
          Jour de repos : 2 100 kcal · 100 g glucides
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MealCard
          title="Repas 1 — Réveil (7h–8h)"
          border="accent3"
          lines={[
            "4 œufs entiers + 4 blancs",
            "Avocat 80 g",
            "Fromage blanc 0 % 200 g",
            "Flocons d'avoine 50 g — jours d'entraînement uniquement",
            "~600–790 kcal · ~55 g protéines",
          ]}
        />
        <MealCard
          title="Pré-entraînement (~1h30 avant, entraînement uniquement)"
          border="accent"
          lines={[
            "Poulet / thon / dinde 180 g",
            "Riz blanc ou patate douce 150 g cuits (~50 g glucides)",
            "Légumes verts",
            "~435 kcal · ~45 g protéines · ~50 g glucides",
          ]}
        />
        <MealCard
          title="Post-entraînement (+30 min, entraînement uniquement)"
          border="accent2"
          lines={[
            "Skyr ou fromage blanc 0 % 300 g",
            "Banane ou riz (~30 g glucides)",
            "Créatine 5 g avec de l'eau",
            "~275 kcal · ~35 g protéines · ~30 g glucides",
          ]}
        />
        <MealCard
          title="Dîner (19h–20h, tous les jours)"
          border="muted"
          lines={[
            "Saumon / maquereau / bœuf 5 % MG 200 g",
            "Légumes verts — à volonté",
            "Huile d'olive 15 g",
            "Lentilles 80 g cuites — jours de repos uniquement",
            "~500–590 kcal · ~50 g protéines · quasi pas de glucides",
          ]}
        />
      </div>

      <div className="rounded-shred border border-shred-border border-t-4 border-t-shred-accent bg-shred-surface2 p-5">
        <h2 className="font-display text-2xl tracking-wide text-shred-text">Créatine · Hydratation · Refeed</h2>
        <ul className="mt-3 space-y-2 text-sm text-shred-muted list-disc pl-5">
          <li>
            <span className="text-shred-text">Créatine :</span> {USER.supplementNote}
          </li>
          <li>
            <span className="text-shred-text">Hydratation :</span> note l&apos;eau dans Quotidien ; viser une prise
            régulière, surtout les jours d&apos;entraînement.
          </li>
          <li>
            <span className="text-shred-text">Refeed :</span> si la récupération WHOOP reste basse plusieurs jours,
            ajoute ~50 g de glucides au dîner une fois — voir l&apos;alerte dans l&apos;onglet WHOOP.
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
