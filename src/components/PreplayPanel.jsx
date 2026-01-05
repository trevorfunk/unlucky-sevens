import PlayingCard from "../ui/PlayingCard.jsx";
import { Button, Panel, Badge } from "../ui/ui.jsx";

export default function PreplayPanel({
  me,
  myHand,
  mySeat,
  mySevens,
  allAliveSevensResolved,
  dealerSeat,
  onOpenSuitModalForSevens,
  onBeginFirstTurn,
}) {
  const isDealer = Boolean(me) && me.seat === dealerSeat;
  const canResolve = Boolean(me?.alive) && mySevens > 0;
  const canBegin = Boolean(me) && isDealer && allAliveSevensResolved;

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Pre-Round</Badge>
          <Badge>Seat {mySeat ?? "-"}</Badge>
          <Badge>Sevens: {mySevens}</Badge>
        </div>

        <div className="text-sm text-white/80">
          <span className="font-semibold text-white">Pre-Round Phase:</span>{" "}
          Resolve any 7s manually by playing{" "}
          <span className="font-semibold text-white">7 → 8</span> before the
          first turn begins.
        </div>

        {!me?.alive ? (
          <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-300/20 rounded-2xl px-4 py-3">
            You are <span className="font-semibold">OUT</span> this round.
          </div>
        ) : null}

        {/* Hand */}
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-white">Your hand</div>
            <Badge>{myHand.length} cards</Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            {myHand.map((c, i) => (
              <PlayingCard
                key={`${c.r}${c.s}${i}`}
                card={c}
                size="hand"
              />
            ))}

            {myHand.length === 0 ? (
              <div className="text-sm text-white/60">(empty)</div>
            ) : null}
          </div>
        </div>

        {/* Resolve sevens */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-white/75">
            You must end preplay with{" "}
            <span className="font-semibold text-white">0 sevens</span> in your
            hand.
          </div>

          <Button onClick={onOpenSuitModalForSevens} disabled={!canResolve}>
            Play 7 + 8 Save ({mySevens})
          </Button>
        </div>

        {/* Ready status */}
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white">
            Ready to begin?
          </div>
          {allAliveSevensResolved ? (
            <Badge>✅ All sevens resolved</Badge>
          ) : (
            <Badge>⏳ Waiting on players</Badge>
          )}
        </div>

        {/* Begin turn */}
        <div>
          <Button onClick={onBeginFirstTurn} disabled={!canBegin}>
            Begin First Turn (Dealer)
          </Button>

          {!isDealer ? (
            <div className="mt-2 text-xs text-white/55">
              Only the dealer (seat {dealerSeat}) can begin the first turn.
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}
