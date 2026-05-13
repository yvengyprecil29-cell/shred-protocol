"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { MACRO_REST, MACRO_TRAINING, USER } from "@/lib/constants";
import type { FoodItem } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type OFFNutriments = {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
};

type OFFProduct = {
  product_name?: string;
  brands?: string;
  nutriments?: OFFNutriments;
  image_front_small_url?: string;
};

// ─── Shopping list data ───────────────────────────────────────────────────────

const SHOPPING_TEMPLATE = [
  {
    cat: "🥩 Protéines",
    items: [
      "Œufs entiers (12)", "Blancs d'œufs", "Poulet filets 500g", "Thon naturel (3 boîtes)",
      "Dinde émincée 500g", "Saumon 400g", "Maquereau 400g", "Bœuf haché 5% MG 500g",
      "Skyr nature 500g", "Fromage blanc 0% 1kg",
    ],
  },
  {
    cat: "🌾 Glucides",
    items: [
      "Flocons d'avoine 500g", "Riz blanc 1kg", "Patates douces (4)", "Bananes (régime)",
      "Lentilles 500g",
    ],
  },
  {
    cat: "🥦 Légumes",
    items: ["Brocolis 500g", "Épinards 400g", "Haricots verts", "Courgettes", "Tomates cerises"],
  },
  {
    cat: "🫒 Lipides",
    items: ["Avocats (6)", "Huile d'olive vierge extra"],
  },
  {
    cat: "💊 Suppléments & Autre",
    items: ["Créatine monohydrate 500g", "Eau minérale (pack 6×1.5L)"],
  },
];

// ─── Meal config ──────────────────────────────────────────────────────────────

const MEALS = [
  { key: "meal1", label: "Repas 1 — Réveil", time: "7h–8h", border: "border-t-shred-accent3", desc: "4 œufs + avocat + fromage blanc" },
  { key: "meal2", label: "Repas 2 — Pré-entraînement", time: "~1h30 avant", border: "border-t-shred-accent", desc: "Poulet / thon + riz / patate douce" },
  { key: "meal3", label: "Repas 3 — Post-entraînement", time: "+30 min", border: "border-t-shred-accent2", desc: "Skyr + banane + créatine" },
  { key: "meal4", label: "Repas 4 — Dîner", time: "19h–20h", border: "border-t-shred-muted", desc: "Poisson / bœuf + légumes verts" },
] as const;

// ─── MacroBar ─────────────────────────────────────────────────────────────────

function MacroBar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const pct = Math.min((value / target) * 100, 100);
  const over = value > target;
  return (
    <div className="space-y-1">
      <div className="flex justify-between font-mono text-xs">
        <span className="text-shred-muted">{label}</span>
        <span className={over ? "text-shred-accent2" : "text-shred-text"}>
          {Math.round(value)}/{target}{unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-shred-surface overflow-hidden">
        <div className={`h-full rounded-full ${over ? "bg-shred-accent2" : color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Add Food Modal ───────────────────────────────────────────────────────────

function AddFoodModal({
  meal, date, onAdd, onClose,
}: {
  meal: string; date: string; onAdd: (item: FoodItem) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"search" | "barcode" | "manual">("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [barcode, setBarcode] = useState("");
  const [loadingBarcode, setLoadingBarcode] = useState(false);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");
  const [kcalPer100, setKcalPer100] = useState("");
  const [protPer100, setProtPer100] = useState("");
  const [carbPer100, setCarbPer100] = useState("");
  const [fatPer100, setFatPer100] = useState("");
  const [saving, setSaving] = useState(false);

  function fillFromProduct(p: OFFProduct) {
    const n = p.nutriments ?? {};
    setName(p.product_name ?? "");
    setKcalPer100(n["energy-kcal_100g"] != null ? String(Math.round(n["energy-kcal_100g"])) : "");
    setProtPer100(n.proteins_100g != null ? String(Math.round(n.proteins_100g * 10) / 10) : "");
    setCarbPer100(n.carbohydrates_100g != null ? String(Math.round(n.carbohydrates_100g * 10) / 10) : "");
    setFatPer100(n.fat_100g != null ? String(Math.round(n.fat_100g * 10) / 10) : "");
    setUnit("g");
    setMode("manual");
  }

  async function searchOFF() {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,brands,nutriments,image_front_small_url`,
      );
      const j = await res.json() as { products?: OFFProduct[] };
      setResults((j.products ?? []).filter((p) => p.product_name));
    } catch { setResults([]); }
    setSearching(false);
  }

  async function fetchBarcode(code: string) {
    setLoadingBarcode(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const j = await res.json() as { status: number; product?: OFFProduct };
      if (j.status === 1 && j.product) fillFromProduct(j.product);
      else setName(`Produit ${code}`);
    } catch { setName(`Produit ${code}`); }
    setLoadingBarcode(false);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;

      // Attach stream BEFORE setScanning so the element is in the DOM
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setScanning(true);

      // Start BarcodeDetector after a short delay to let the video start
      if ("BarcodeDetector" in window) {
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detector = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "qr_code"] });
          const scanLoop = async () => {
            if (!videoRef.current || !streamRef.current) return;
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const barcodes = await detector.detect(videoRef.current) as any[];
              if (barcodes.length > 0) {
                const code = String(barcodes[0].rawValue);
                stopCamera();
                setBarcode(code);
                await fetchBarcode(code);
                return;
              }
            } catch { /* continue */ }
            requestAnimationFrame(scanLoop);
          };
          requestAnimationFrame(scanLoop);
        }, 600);
      }
    } catch {
      alert("Impossible d'accéder à la caméra. Autorise l'accès dans les réglages, ou entre le code manuellement.");
    }
  }

  useEffect(() => () => { stopCamera(); }, []);

  const qty = Number(quantity) || 100;
  const factor = qty / 100;
  const adjKcal = kcalPer100 ? Math.round(Number(kcalPer100) * factor) : null;
  const adjProt = protPer100 ? Math.round(Number(protPer100) * factor * 10) / 10 : null;
  const adjCarb = carbPer100 ? Math.round(Number(carbPer100) * factor * 10) / 10 : null;
  const adjFat = fatPer100 ? Math.round(Number(fatPer100) * factor * 10) / 10 : null;

  async function handleAdd() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/food-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date, meal, name: name.trim(),
          quantity: quantity ? Number(quantity) : null,
          unit: unit || null,
          calories: adjKcal, protein: adjProt, carbs: adjCarb, fat: adjFat,
        }),
      });
      const j = await res.json() as { ok: boolean; data?: FoodItem };
      if (j.ok && j.data) {
        window.dispatchEvent(new Event("foodUpdated"));
        onAdd(j.data);
      } else onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-2" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-shred border border-shred-border bg-shred-bg p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl tracking-wide">Ajouter un aliment</h3>
          <button type="button" onClick={onClose} className="font-mono text-shred-muted text-xl leading-none">✕</button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2">
          {(["search", "barcode", "manual"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); stopCamera(); }}
              className={`rounded-shred border px-3 py-1.5 font-mono text-xs ${mode === m ? "border-shred-accent bg-shred-accent text-shred-bg" : "border-shred-border text-shred-muted"}`}>
              {m === "search" ? "🔍 Chercher" : m === "barcode" ? "📷 Code-barre" : "✏️ Manuel"}
            </button>
          ))}
        </div>

        {/* Search mode */}
        {mode === "search" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void searchOFF()}
                placeholder="Nom du produit…"
                className="flex-1 rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm" />
              <button type="button" onClick={() => void searchOFF()}
                className="rounded-shred border border-shred-accent bg-shred-accent px-3 py-2 font-mono text-xs text-shred-bg">
                {searching ? "…" : "OK"}
              </button>
            </div>
            {results.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {results.map((p, i) => (
                  <button key={i} type="button" onClick={() => fillFromProduct(p)}
                    className="w-full text-left rounded-shred border border-shred-border bg-shred-surface p-2 hover:border-shred-accent transition-colors">
                    <p className="font-mono text-sm text-shred-text">{p.product_name}</p>
                    <p className="text-xs text-shred-muted">
                      {p.nutriments?.["energy-kcal_100g"] ? `${Math.round(p.nutriments["energy-kcal_100g"])} kcal/100g` : ""}
                      {p.nutriments?.proteins_100g ? ` · P${Math.round(p.nutriments.proteins_100g)}g` : ""}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {!searching && query && results.length === 0 && (
              <p className="text-xs text-shred-muted font-mono">Aucun résultat — essaie en anglais ou entre manuellement.</p>
            )}
          </div>
        )}

        {/* Barcode mode */}
        {mode === "barcode" && (
          <div className="space-y-3">
            {/* Video always in DOM when in barcode mode so videoRef is available before startCamera */}
            <div className={`relative ${scanning ? "" : "hidden"}`}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full rounded-shred border border-shred-border bg-black"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-shred-accent3 rounded-shred w-3/4 h-24 opacity-60" />
              </div>
              <button type="button" onClick={stopCamera}
                className="absolute top-2 right-2 bg-shred-bg rounded-shred px-2 py-1 font-mono text-xs border border-shred-border">
                ✕ Stop
              </button>
            </div>
            {!scanning && (
              <button type="button" onClick={() => void startCamera()}
                className="w-full rounded-shred border border-shred-accent3 bg-shred-accent3/10 px-4 py-3 font-mono text-sm text-shred-accent3">
                📷 Démarrer la caméra
              </button>
            )}
            <div>
              <p className="text-xs text-shred-muted font-mono mb-1">
                {scanning ? "Pointe la caméra vers le code-barre…" : "Ou entre le code EAN manuellement :"}
              </p>
              <div className="flex gap-2">
                <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Ex : 3017620425035"
                  className="flex-1 rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm font-mono" />
                <button type="button" onClick={() => void fetchBarcode(barcode)} disabled={loadingBarcode || !barcode}
                  className="rounded-shred border border-shred-accent3 px-3 py-2 font-mono text-xs text-shred-accent3 disabled:opacity-50">
                  {loadingBarcode ? "…" : "Chercher"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual / form (also used after search/barcode fills data) */}
        {mode === "manual" && (
          <div className="space-y-3">
            <label className="text-xs font-mono text-shred-muted block">
              Nom du produit *
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-mono text-shred-muted block">
                Quantité
                <input type="number" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-mono text-shred-muted block">
                Unité
                <select value={unit} onChange={(e) => setUnit(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm">
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="unité">unité</option>
                  <option value="portion">portion</option>
                </select>
              </label>
            </div>
            <p className="text-xs text-shred-muted font-mono">Valeurs pour 100 {unit} (le calcul est automatique) :</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "kcal/100g", val: kcalPer100, set: setKcalPer100 },
                { label: "Prot. g", val: protPer100, set: setProtPer100 },
                { label: "Gluc. g", val: carbPer100, set: setCarbPer100 },
                { label: "Lip. g", val: fatPer100, set: setFatPer100 },
              ].map(({ label, val, set }) => (
                <label key={label} className="text-xs font-mono text-shred-muted block">
                  {label}
                  <input type="number" step="0.1" value={val} onChange={(e) => set(e.target.value)}
                    className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-2 py-1.5 text-sm text-center" />
                </label>
              ))}
            </div>
            {(adjKcal || adjProt) && (
              <div className="rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 font-mono text-xs text-shred-muted">
                Pour {quantity}{unit} → {adjKcal ?? "?"}kcal · P{adjProt ?? "?"}g · G{adjCarb ?? "?"}g · L{adjFat ?? "?"}g
              </div>
            )}
          </div>
        )}

        {/* If search/barcode filled the name, show form below */}
        {mode !== "manual" && name && (
          <div className="rounded-shred border border-shred-accent3/50 bg-shred-accent3/5 p-3 space-y-3">
            <p className="font-mono text-sm text-shred-text">{name}</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-mono text-shred-muted block">
                Quantité
                <input type="number" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-mono text-shred-muted block">
                Unité
                <select value={unit} onChange={(e) => setUnit(e.target.value)}
                  className="mt-1 w-full rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm">
                  <option value="g">g</option><option value="ml">ml</option>
                  <option value="unité">unité</option><option value="portion">portion</option>
                </select>
              </label>
            </div>
            {(adjKcal || adjProt) && (
              <p className="font-mono text-xs text-shred-muted">
                → {adjKcal ?? "?"}kcal · P{adjProt ?? "?"}g · G{adjCarb ?? "?"}g · L{adjFat ?? "?"}g
              </p>
            )}
          </div>
        )}

        <button type="button" onClick={() => void handleAdd()} disabled={!name.trim() || saving}
          className="w-full rounded-shred border border-shred-accent bg-shred-accent px-4 py-3 font-mono text-sm text-shred-bg font-bold disabled:opacity-50">
          {saving ? "Enregistrement…" : `Ajouter au ${MEALS.find((m) => m.key === meal)?.label ?? meal}`}
        </button>
      </div>
    </div>
  );
}

// ─── Meal Journal ─────────────────────────────────────────────────────────────

function MealJournal() {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addMeal, setAddMeal] = useState("meal1");
  const [dayType, setDayType] = useState<"training" | "rest">("training");

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/food-items?date=${date}`);
      const j = await res.json() as { ok: boolean; data?: FoodItem[] };
      setItems(j.ok ? (j.data ?? []) : []);
    } catch { setItems([]); }
    setLoading(false);
  }, [date]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  async function deleteItem(id: number) {
    setItems((prev) => prev.filter((f) => f.id !== id));
    await fetch(`/api/food-items?id=${id}`, { method: "DELETE" });
    window.dispatchEvent(new Event("foodUpdated"));
  }

  const target = dayType === "training" ? MACRO_TRAINING : MACRO_REST;
  const totals = items.reduce(
    (acc, f) => ({
      kcal: acc.kcal + (f.calories ?? 0),
      prot: acc.prot + (f.protein ?? 0),
      carbs: acc.carbs + (f.carbs ?? 0),
      fat: acc.fat + (f.fat ?? 0),
    }),
    { kcal: 0, prot: 0, carbs: 0, fat: 0 },
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-xs font-mono text-shred-muted block">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="mt-1 rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2 items-end pb-0.5">
          {(["training", "rest"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setDayType(t)}
              className={`rounded-shred border px-3 py-2 font-mono text-xs ${dayType === t ? "border-shred-accent bg-shred-accent text-shred-bg" : "border-shred-border text-shred-muted"}`}>
              {t === "training" ? "Entraînement" : "Repos"}
            </button>
          ))}
        </div>
      </div>

      {/* Daily progress */}
      <div className="rounded-shred border border-shred-border bg-shred-surface p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg">Bilan du jour</h3>
          <span className={`font-mono text-xs px-2 py-1 rounded-shred border ${totals.prot >= 200 && totals.kcal <= target.calories ? "border-shred-accent3 text-shred-accent3" : "border-shred-accent2 text-shred-accent2"}`}>
            {totals.prot >= 200 ? "✓ Protéines OK" : `⚠ P: ${Math.round(totals.prot)}g / 200g`}
          </span>
        </div>
        <MacroBar label="Calories" value={totals.kcal} target={target.calories} unit=" kcal" color="bg-shred-accent" />
        <MacroBar label="Protéines" value={totals.prot} target={target.protein} unit="g" color="bg-shred-accent3" />
        <MacroBar label="Glucides" value={totals.carbs} target={target.carbs} unit="g" color="bg-blue-400" />
        <MacroBar label="Lipides" value={totals.fat} target={target.fat} unit="g" color="bg-orange-400" />
      </div>

      {loading && <p className="text-sm text-shred-muted font-mono animate-pulse">Chargement…</p>}

      {/* Meal cards */}
      {MEALS.map((meal) => {
        const mealItems = items.filter((f) => (f.meal ?? "meal1") === meal.key);
        const mealKcal = mealItems.reduce((s, f) => s + (f.calories ?? 0), 0);
        const mealProt = mealItems.reduce((s, f) => s + (f.protein ?? 0), 0);
        return (
          <div key={meal.key} className={`rounded-shred border border-shred-border bg-shred-surface p-4 border-t-4 ${meal.border}`}>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="font-display text-xl">{meal.label}</h3>
                <p className="text-xs text-shred-muted font-mono">{meal.time} · {meal.desc}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm text-shred-text">{Math.round(mealKcal)} kcal</p>
                {mealProt > 0 && <p className="font-mono text-xs text-shred-muted">P {Math.round(mealProt)}g</p>}
              </div>
            </div>

            <div className="space-y-1 mb-3">
              {mealItems.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-sm py-1 border-b border-shred-border/20 gap-2">
                  <span className="font-mono text-shred-text truncate">
                    {f.name}{f.quantity ? ` — ${f.quantity}${f.unit ?? "g"}` : ""}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-shred-muted">
                      {f.calories ? `${Math.round(f.calories)}kcal` : ""}
                      {f.protein ? ` · P${Math.round(f.protein)}g` : ""}
                    </span>
                    <button type="button" onClick={() => void deleteItem(f.id)}
                      className="text-shred-muted/40 hover:text-shred-accent2 text-xs leading-none px-1">✕</button>
                  </div>
                </div>
              ))}
              {mealItems.length === 0 && (
                <p className="text-xs text-shred-muted/40 font-mono py-1">Aucun aliment enregistré</p>
              )}
            </div>

            <button type="button" onClick={() => { setAddMeal(meal.key); setShowAdd(true); }}
              className="rounded-shred border border-dashed border-shred-border px-3 py-1.5 font-mono text-xs text-shred-muted hover:text-shred-text hover:border-shred-accent transition-colors">
              + Ajouter un aliment
            </button>
          </div>
        );
      })}

      {showAdd && (
        <AddFoodModal
          meal={addMeal}
          date={date}
          onAdd={(item) => { setItems((prev) => [...prev, item]); setShowAdd(false); }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ─── Shopping List ────────────────────────────────────────────────────────────

const LS_KEY = "shred_shopping_v1";

type ShoppingState = Record<string, boolean>;

function loadShopping(): ShoppingState {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}") as ShoppingState; } catch { return {}; }
}

function saveShopping(s: ShoppingState) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function ShoppingList() {
  const [checked, setChecked] = useState<ShoppingState>({});
  const [custom, setCustom] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    setChecked(loadShopping());
    try {
      const c = JSON.parse(localStorage.getItem("shred_shopping_custom_v1") ?? "[]") as string[];
      setCustom(c);
    } catch { /* empty */ }
  }, []);

  function toggle(key: string) {
    const next = { ...checked, [key]: !checked[key] };
    setChecked(next);
    saveShopping(next);
  }

  function addCustom() {
    if (!newItem.trim()) return;
    const next = [newItem.trim(), ...custom];
    setCustom(next);
    localStorage.setItem("shred_shopping_custom_v1", JSON.stringify(next));
    setNewItem("");
  }

  function removeCustom(item: string) {
    const next = custom.filter((c) => c !== item);
    setCustom(next);
    localStorage.setItem("shred_shopping_custom_v1", JSON.stringify(next));
  }

  function resetAll() {
    const empty: ShoppingState = {};
    setChecked(empty);
    saveShopping(empty);
  }

  const totalItems = SHOPPING_TEMPLATE.flatMap((c) => c.items).length + custom.length;
  const doneItems = Object.values(checked).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-2xl tracking-wide">Liste de courses</h2>
          <p className="text-xs text-shred-muted font-mono mt-1">
            {doneItems}/{totalItems} articles cochés · basée sur le plan alimentaire
          </p>
        </div>
        <button type="button" onClick={resetAll}
          className="rounded-shred border border-shred-border px-3 py-1.5 font-mono text-xs text-shred-muted">
          Tout décocher
        </button>
      </div>

      {/* Progress */}
      <div className="h-1.5 rounded-full bg-shred-surface overflow-hidden">
        <div className="h-full bg-shred-accent3 rounded-full transition-all" style={{ width: `${totalItems ? (doneItems / totalItems) * 100 : 0}%` }} />
      </div>

      {/* Add custom */}
      <div className="flex gap-2">
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Ajouter un article personnalisé…"
          className="flex-1 rounded-shred border border-shred-border bg-shred-surface2 px-3 py-2 text-sm font-mono" />
        <button type="button" onClick={addCustom}
          className="rounded-shred border border-shred-accent bg-shred-accent px-3 py-2 font-mono text-xs text-shred-bg">
          +
        </button>
      </div>

      {/* Custom items */}
      {custom.length > 0 && (
        <div className="rounded-shred border border-shred-border bg-shred-surface p-3 space-y-2">
          <p className="font-mono text-xs text-shred-accent uppercase tracking-wider mb-2">Personnalisés</p>
          {custom.map((item) => {
            const key = `custom::${item}`;
            return (
              <div key={key} className="flex items-center gap-3">
                <button type="button" onClick={() => toggle(key)}
                  className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${checked[key] ? "bg-shred-accent3 border-shred-accent3" : "border-shred-border"}`}>
                  {checked[key] && <span className="text-shred-bg text-xs font-bold">✓</span>}
                </button>
                <span className={`flex-1 text-sm font-mono ${checked[key] ? "line-through text-shred-muted/50" : "text-shred-text"}`}>{item}</span>
                <button type="button" onClick={() => removeCustom(item)} className="text-shred-muted/40 hover:text-shred-accent2 text-xs">✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Template categories */}
      {SHOPPING_TEMPLATE.map(({ cat, items }) => (
        <div key={cat} className="rounded-shred border border-shred-border bg-shred-surface p-3 space-y-2">
          <p className="font-mono text-xs text-shred-accent3 uppercase tracking-wider mb-2">{cat}</p>
          {items.map((item) => {
            const key = `${cat}::${item}`;
            return (
              <div key={key} className="flex items-center gap-3">
                <button type="button" onClick={() => toggle(key)}
                  className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${checked[key] ? "bg-shred-accent3 border-shred-accent3" : "border-shred-border"}`}>
                  {checked[key] && <span className="text-shred-bg text-xs font-bold">✓</span>}
                </button>
                <span className={`text-sm font-mono ${checked[key] ? "line-through text-shred-muted/50" : "text-shred-text"}`}>{item}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Static meal plan ─────────────────────────────────────────────────────────

function MealCard({ title, lines, border }: { title: string; lines: string[]; border: "accent" | "accent2" | "accent3" | "muted" }) {
  const map = { accent: "border-t-shred-accent", accent2: "border-t-shred-accent2", accent3: "border-t-shred-accent3", muted: "border-t-shred-muted" } as const;
  return (
    <div className={`rounded-shred border border-shred-border bg-shred-surface p-4 border-t-4 ${map[border]}`}>
      <h3 className="font-display text-xl tracking-wide text-shred-text">{title}</h3>
      <ul className="mt-3 space-y-1.5 text-sm text-shred-muted">
        {lines.map((l) => <li key={l} className="leading-relaxed">{l}</li>)}
      </ul>
    </div>
  );
}

function MealPlan() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-shred border border-t-4 border-t-shred-accent border-shred-border bg-shred-surface px-3 py-2 font-mono text-xs">
          Entraînement : 2 250 kcal · 150g glucides
        </span>
        <span className="rounded-shred border border-t-4 border-t-shred-accent3 border-shred-border bg-shred-surface px-3 py-2 font-mono text-xs">
          Repos : 2 100 kcal · 100g glucides
        </span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MealCard title="Repas 1 — Réveil (7h–8h)" border="accent3"
          lines={["4 œufs entiers + 4 blancs", "Avocat 80 g", "Fromage blanc 0 % 200 g", "Flocons d'avoine 50 g — jours d'entraînement uniquement", "~600–790 kcal · ~55 g protéines"]} />
        <MealCard title="Pré-entraînement (~1h30 avant)" border="accent"
          lines={["Poulet / thon / dinde 180 g", "Riz blanc ou patate douce 150 g cuits (~50 g glucides)", "Légumes verts", "~435 kcal · ~45 g protéines · ~50 g glucides"]} />
        <MealCard title="Post-entraînement (+30 min)" border="accent2"
          lines={["Skyr ou fromage blanc 0 % 300 g", "Banane ou riz (~30 g glucides)", "Créatine 5 g avec de l'eau", "~275 kcal · ~35 g protéines · ~30 g glucides"]} />
        <MealCard title="Dîner (19h–20h)" border="muted"
          lines={["Saumon / maquereau / bœuf 5 % MG 200 g", "Légumes verts — à volonté", "Huile d'olive 15 g", "Lentilles 80 g cuites — jours de repos uniquement", "~500–590 kcal · ~50 g protéines"]} />
      </div>
      <div className="rounded-shred border border-t-4 border-t-shred-accent border-shred-border bg-shred-surface2 p-5">
        <h2 className="font-display text-2xl tracking-wide">Créatine · Hydratation · Refeed</h2>
        <ul className="mt-3 space-y-2 text-sm text-shred-muted list-disc pl-5">
          <li><span className="text-shred-text">Créatine :</span> {USER.supplementNote}</li>
          <li><span className="text-shred-text">Hydratation :</span> viser 2.5–3L/jour, note l&apos;eau dans Quotidien.</li>
          <li><span className="text-shred-text">Refeed :</span> si récup. WHOOP basse plusieurs jours → +50g de glucides au dîner.</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type InnerTab = "journal" | "plan" | "courses";

const INNER_TABS: { id: InnerTab; label: string }[] = [
  { id: "journal", label: "📋 Journal" },
  { id: "plan", label: "🥗 Plan alimentaire" },
  { id: "courses", label: "🛒 Courses" },
];

export function DietTab() {
  const [innerTab, setInnerTab] = useState<InnerTab>("journal");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-4xl tracking-[0.08em]">Alimentation</h1>
        <p className="text-shred-muted mt-2 text-sm">
          {USER.name} · Cible : {MACRO_TRAINING.protein}g protéines · {MACRO_TRAINING.calories} kcal entraînement
        </p>
      </header>

      {/* Inner tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {INNER_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setInnerTab(t.id)}
            className={`shrink-0 rounded-shred border px-4 py-2 font-mono text-sm transition-colors ${
              innerTab === t.id
                ? "border-shred-accent bg-shred-surface2 text-shred-accent"
                : "border-shred-border bg-shred-surface text-shred-muted hover:text-shred-text"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {innerTab === "journal" && <MealJournal />}
      {innerTab === "plan" && <MealPlan />}
      {innerTab === "courses" && <ShoppingList />}
    </div>
  );
}
