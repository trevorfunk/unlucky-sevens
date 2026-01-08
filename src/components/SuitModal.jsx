// src/components/SuitModal.jsx
import { useEffect } from "react";
import { Button } from "../ui/ui.jsx";

const SUITS = [
  { key: "S", label: "Spades ♠" },
  { key: "H", label: "Hearts ♥" },
  { key: "D", label: "Diamonds ♦" },
  { key: "C", label: "Clubs ♣" },
];

export default function SuitModal({ open, onClose, onChoose }) {
  // Escape to close
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      style={{
        // Helps ensure the overlay respects iOS safe areas a bit better
        paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
      }}
      onMouseDown={(e) => {
        // click outside closes
        if (e.target === e.currentTarget) onClose?.();
      }}
      onTouchStart={(e) => {
        // tap outside closes (mobile)
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl"
        style={{
          // Critical: pushes modal content above your docked hand area on iPhone
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        }}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="text-base font-semibold">Choose a suit</div>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-sm opacity-90"
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {SUITS.map((s) => (
              <Button
                key={s.key}
                onClick={() => onChoose?.(s.key)}
                className="h-12 rounded-2xl"
              >
                {s.label}
              </Button>
            ))}
          </div>

          <div className="mt-4">
            <Button variant="secondary" onClick={() => onClose?.()} className="w-full">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
