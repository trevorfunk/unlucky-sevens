import { Button, Panel } from "../ui/ui.jsx";

const SUITS = [
  { key: "S", label: "Spades", symbol: "♠", color: "#ffffff" },
  { key: "H", label: "Hearts", symbol: "♥", color: "#fb7185" },
  { key: "D", label: "Diamonds", symbol: "♦", color: "#fb7185" },
  { key: "C", label: "Clubs", symbol: "♣", color: "#ffffff" },
];

export default function SuitModal({ open, value, onChange, onClose, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <button
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-label="Close modal"
      />

      <Panel className="relative w-full max-w-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-semibold">Choose a suit</div>
            <div className="mt-1 text-sm text-white/70">
              Your 8 sets the forced suit for the next play.
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/80 hover:bg-white/10"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SUITS.map((s) => {
            const selected = value === s.key;
            return (
              <button
                key={s.key}
                onClick={() => onChange(s.key)}
                className={[
                  "rounded-3xl border px-4 py-6 text-center transition",
                  "bg-white/5 hover:bg-white/10",
                  selected ? "border-emerald-300/70 ring-4 ring-emerald-300/40" : "border-white/10",
                ].join(" ")}
                aria-label={s.label}
              >
                <div
                  className="text-5xl font-black"
                  style={{
                    color: s.color,
                    textShadow: "0 2px 10px rgba(0,0,0,0.45)",
                  }}
                >
                  {s.symbol}
                </div>
                <div className="mt-2 text-sm text-white/75">{s.label}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:items-center">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(value)}>
            Confirm {SUITS.find((s) => s.key === value)?.symbol ?? ""}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
