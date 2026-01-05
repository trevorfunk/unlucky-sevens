import { cn } from "./ui.jsx";

const SUIT = {
  S: { name: "Spades", symbol: "♠", color: "#0a0a0a" },
  C: { name: "Clubs", symbol: "♣", color: "#0a0a0a" },
  H: { name: "Hearts", symbol: "♥", color: "#b91c1c" },
  D: { name: "Diamonds", symbol: "♦", color: "#b91c1c" },
};

function rankLabel(r) {
  if (r === 1) return "A";
  if (r === 11) return "J";
  if (r === 12) return "Q";
  if (r === 13) return "K";
  return String(r);
}

export default function PlayingCard({
  card,              // { r: number, s: "S"|"H"|"D"|"C" }
  size = "hand",     // "hand" | "table"
  faceDown = false,
  selected = false,
  glow = false,
  disabled = false,
  onClick,
}) {
  const s = SUIT[card?.s] ?? { name: "Unknown", symbol: "?", color: "#0a0a0a" };
  const r = rankLabel(card?.r);

  const dims =
    size === "table"
      ? "h-56 w-40 sm:h-60 sm:w-44"
      : "h-36 w-26 sm:h-40 sm:w-28";

  // Strong readability on all suit/rank text
  const pipStyle = {
    color: s.color,
    textShadow: "0 1px 0 rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.20)",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative rounded-[22px] border transition select-none",
        dims,
        disabled ? "cursor-not-allowed opacity-90" : "cursor-pointer",
        faceDown
          ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(0,0,0,0.35))] border-white/15 shadow-[0_18px_55px_rgba(0,0,0,0.60)]"
          : "bg-white border-black/15 shadow-[0_18px_55px_rgba(0,0,0,0.60)]",
        !disabled && "hover:-translate-y-1 active:translate-y-0",
        // Strong selection
        selected && "ring-4 ring-emerald-300 ring-offset-2 ring-offset-zinc-950 -translate-y-1",
        // Strong playable glow
        glow &&
          "ring-4 ring-emerald-300/90 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_0_12px_rgba(16,185,129,0.22),0_18px_55px_rgba(0,0,0,0.60)]"
      )}
      aria-label={faceDown ? "Face down card" : `${r} of ${s.name}`}
      title={faceDown ? "Face down" : `${r}${s.symbol}`}
    >
      {!faceDown ? (
        <>
          {/* Top-left */}
          <div
            className="absolute left-3 top-3 text-base font-extrabold"
            style={pipStyle}
          >
            {r}
          </div>
          <div
            className="absolute left-3 top-8 text-2xl leading-none"
            style={pipStyle}
          >
            {s.symbol}
          </div>

          {/* Bottom-right (rotated) */}
          <div
            className="absolute right-3 bottom-3 text-base font-extrabold rotate-180"
            style={pipStyle}
          >
            {r}
          </div>
          <div
            className="absolute right-3 bottom-8 text-2xl leading-none rotate-180"
            style={pipStyle}
          >
            {s.symbol}
          </div>

          {/* Center suit */}
          <div
            className="absolute inset-0 flex items-center justify-center text-6xl"
            style={{ ...pipStyle, opacity: 0.95 }}
          >
            {s.symbol}
          </div>
        </>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[72%] w-[72%] rounded-2xl border border-white/15 bg-white/5" />
        </div>
      )}
    </button>
  );
}
