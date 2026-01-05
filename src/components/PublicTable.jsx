import { suitLabel } from "../game/cards";
import { Panel, Badge } from "../ui/ui.jsx";
import PlayingCard from "../ui/PlayingCard.jsx";

export default function PublicTable({
  players,
  hands,
  turnSeat,
  roundStatus,
  pending,
  topDisplay,
  topCard,
  forcedSuit,
  direction,
  dealerSeat,
  myId,
}) {
  const hasPending = (pending?.count || 0) > 0;

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Table</div>

          <div className="mt-2 text-sm text-white/80">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-white/60">Top</span>{" "}
                <span className="font-semibold text-white">{topDisplay}</span>
              </div>

              {forcedSuit ? (
                <div>
                  <span className="text-white/60">Suit</span>{" "}
                  <span className="font-semibold text-white">{suitLabel(forcedSuit)}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-1">
              <span className="text-white/60">Direction</span>{" "}
              <span className="font-semibold text-white">{direction === 1 ? "→" : "←"}</span>
              <span className="mx-2 text-white/40">•</span>
              <span className="text-white/60">Dealer</span>{" "}
              <span className="font-semibold text-white">Seat {dealerSeat}</span>
            </div>
          </div>
        </div>

        <div
          className={[
            "rounded-2xl border px-4 py-3 text-sm font-semibold",
            hasPending
              ? "border-amber-300/40 bg-amber-400/10 text-amber-200"
              : "border-white/10 bg-white/5 text-white/70",
          ].join(" ")}
        >
          {hasPending ? (
            <>
              Pending pickup: <span className="font-extrabold">{pending.count}</span>{" "}
              {pending.type ? `(${pending.type})` : ""} — defend with 2 / Q♠
            </>
          ) : (
            "No pending pickup"
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        {topCard ? (
          <PlayingCard card={topCard} size="table" glow />
        ) : (
          <div className="text-sm text-white/60">(no top card)</div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge>Top: {topDisplay}</Badge>
          {forcedSuit ? <Badge>Forced: {suitLabel(forcedSuit)}</Badge> : null}
        </div>
      </div>

      <div className="mt-6 grid gap-2">
        {players
          .slice()
          .sort((a, b) => a.seat - b.seat)
          .map((p) => {
            const handCount = Array.isArray(hands?.[p.seat]) ? hands[p.seat].length : 0;
            const isTurn = turnSeat === p.seat && roundStatus === "playing";
            const isMe = p.id === myId;

            return (
              <div
                key={p.id}
                className={[
                  "flex items-center justify-between rounded-2xl border px-4 py-3 transition",
                  isTurn ? "border-emerald-300/40 bg-emerald-400/10" : "border-white/10 bg-white/5",
                ].join(" ")}
              >
                <div className="text-sm">
                  <span className="font-semibold text-white">
                    Seat {p.seat}: {p.name}
                  </span>
                  {isMe ? <Badge className="ml-2">YOU</Badge> : null}
                  {!p.alive ? <span className="ml-2 text-xs text-rose-300 font-semibold">OUT</span> : null}
                  {isTurn ? <span className="ml-2 text-xs font-extrabold text-emerald-300">(TURN)</span> : null}
                </div>

                <div className="text-sm text-white/80">
                  Cards: <span className="font-bold text-white">{handCount}</span>
                </div>
              </div>
            );
          })}
      </div>
    </Panel>
  );
}
