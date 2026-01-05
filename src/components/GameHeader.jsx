import { suitLabel } from "../game/cards";

export default function GameHeader({
  codeShown,
  me,
  round,
  roundStatus,
  remainingSec,
  dealerSeat,
  turnSeat,
  isMyTurn,
  direction,
  pending,
  topDisplay,
  forcedSuit,
  deckCount,
  discardCount,
}) {
  const timerDanger = roundStatus === "playing" && remainingSec != null && remainingSec <= 5;
  const timerText =
    roundStatus === "playing" && remainingSec != null ? `${remainingSec}s` : "-";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      {/* Left: room + you + round */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-white/60">Room</span>
          <span className="rounded-full bg-black/30 border border-white/10 px-3 py-1 text-sm font-semibold tracking-[0.18em] uppercase">
            {codeShown}
          </span>
        </div>

        <div className="text-sm text-white/80">
          <span className="text-white/60">You</span>{" "}
          <span className="font-semibold text-white">
            {me ? `${me.name} (seat ${me.seat})` : "Not joined"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
          <div>
            <span className="text-white/60">Round</span>{" "}
            <span className="font-semibold text-white">{round}</span>
          </div>
          <div>
            <span className="text-white/60">Status</span>{" "}
            <span className="font-semibold text-white">{roundStatus}</span>
          </div>
        </div>

        <div className="text-sm">
          <span className="text-white/60">Turn timer</span>{" "}
          <span
            className={[
              "font-extrabold tabular-nums",
              timerDanger ? "text-rose-300" : "text-white",
            ].join(" ")}
          >
            {timerText}
          </span>
        </div>
      </div>

      {/* Middle: dealer/turn/direction/pending */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="text-white/80">
          <span className="text-white/60">Dealer seat</span>{" "}
          <span className="font-semibold text-white">{dealerSeat}</span>
        </div>

        <div className="text-white/80">
          <span className="text-white/60">Direction</span>{" "}
          <span className="font-semibold text-white">{direction === 1 ? "→" : "←"}</span>
        </div>

        <div className="text-white/80">
          <span className="text-white/60">Turn seat</span>{" "}
          <span className="font-semibold text-white">
            {turnSeat ?? "-"} {isMyTurn ? " (YOU)" : ""}
          </span>
        </div>

        <div className="text-white/80">
          <span className="text-white/60">Pending draw</span>{" "}
          <span className="font-semibold text-white">
            {pending?.count || 0} {pending?.type ? `(${pending.type})` : ""}
          </span>
        </div>
      </div>

      {/* Right: top/forced/deck/discard */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="text-white/80">
          <span className="text-white/60">Top</span>{" "}
          <span className="font-semibold text-white">{topDisplay}</span>
        </div>

        <div className="text-white/80">
          <span className="text-white/60">Forced suit</span>{" "}
          <span className="font-semibold text-white">{forcedSuit ? suitLabel(forcedSuit) : "-"}</span>
        </div>

        <div className="text-white/80">
          <span className="text-white/60">Deck</span>{" "}
          <span className="font-semibold text-white">{deckCount}</span>
        </div>

        <div className="text-white/80">
          <span className="text-white/60">Discard</span>{" "}
          <span className="font-semibold text-white">{discardCount}</span>
        </div>
      </div>
    </div>
  );
}
