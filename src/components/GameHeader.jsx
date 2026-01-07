import { suitLabel } from "../game/cards";
import { Badge, Panel } from "../ui/ui.jsx";

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
  const playing = roundStatus === "playing";
  const timerDanger = playing && remainingSec != null && remainingSec <= 5;

  const pendingCount = pending?.count || 0;
  const hasPending = pendingCount > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: room + key status */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-white/60">Room</span>
            <span className="rounded-full bg-black/30 border border-white/10 px-3 py-1 text-sm font-semibold tracking-[0.18em] uppercase">
              {codeShown}
            </span>
            <Badge>Round {round}</Badge>
            <Badge>Status: {roundStatus}</Badge>
          </div>

          <div className="text-sm text-white/80">
            <span className="text-white/60">You</span>{" "}
            <span className="font-semibold text-white">
              {me ? `${me.name} (seat ${me.seat})` : "Not joined"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge>Dealer: seat {dealerSeat}</Badge>
            <Badge>
              Direction: {direction === 1 ? "→" : "←"}
            </Badge>
            <Badge>
              Turn: {turnSeat ?? "-"} {isMyTurn ? "(YOU)" : ""}
            </Badge>
          </div>
        </div>

        {/* Right side: timer + counts */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge>
            Deck: {deckCount}
          </Badge>
          <Badge>
            Discard: {discardCount}
          </Badge>
          <Badge>
            Top: {topDisplay}
          </Badge>

          <span
            className={[
              "rounded-full border px-3 py-1 text-sm font-extrabold tabular-nums",
              "bg-black/30",
              timerDanger ? "border-rose-300/40 text-rose-200" : "border-white/10 text-white",
            ].join(" ")}
            title="Turn timer"
          >
            {playing && remainingSec != null ? `${remainingSec}s` : "—"}
          </span>
        </div>
      </div>

      {/* Big turn banner */}
      {playing ? (
        <Panel
          className={[
            "p-4",
            isMyTurn
              ? "border-emerald-300/30 bg-emerald-400/10"
              : "border-white/10 bg-white/5",
          ].join(" ")}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-base font-semibold">
              {isMyTurn ? (
                <span className="text-emerald-200">✅ Your turn — play a card or pick up</span>
              ) : (
                <span className="text-white/80">⏳ Waiting for other player…</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {forcedSuit ? (
                <Badge>Forced suit: {suitLabel(forcedSuit)}</Badge>
              ) : (
                <Badge>Forced suit: —</Badge>
              )}

              {hasPending ? (
                <Badge>
                  Pending pickup: {pendingCount} {pending?.type ? `(${pending.type})` : ""}
                </Badge>
              ) : (
                <Badge>No pending pickup</Badge>
              )}
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
