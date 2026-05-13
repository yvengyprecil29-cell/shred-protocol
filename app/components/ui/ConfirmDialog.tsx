"use client";

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmer",
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-shred border border-shred-border bg-shred-bg p-5 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl">{title}</h3>
        <p className="text-sm text-shred-muted leading-relaxed">{message}</p>
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-shred border border-shred-border px-4 py-2 font-mono text-sm text-shred-muted hover:text-shred-text transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-shred border px-4 py-2 font-mono text-sm transition-colors ${
              danger
                ? "border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border-shred-accent bg-shred-accent text-shred-bg hover:bg-shred-accent/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
