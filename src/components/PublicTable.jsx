import { suitLabel } from "../game/cards";
import { Panel, Badge } from "../ui/ui.jsx";
import PlayingCard from "../ui/PlayingCard.jsx";

/**
 * PublicTable
 * - Desktop (sm+): keeps your existing "PlayerChip + grid" style.
 * - Mobile (<sm): compact table:
 *    - Opponents shown as small face-down stacks + tiny label/count
 *    - Center shows deck + top card clearly
 *    - NO big seat panels (this was killing your mobile layout)
 */

function seatClass(isTurn) {
  return [
    "rounded-3xl border px-4 py-3 bg-white/5 transition",
    isTurn ? "border-emerald-300/50 bg-emerald-400/10 ring-4 ring-emerald-300/25" : "border-white/10",
  ].join(" ");
}

function PlayerChip({ p, handCount, isTurn, isMe }) {
  return (
    <div className={seatClass(isTurn)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            Seat {p.seat}: {p.name}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {isMe ? <Badge>YOU</Badge> : null}
            {isTurn ? <Badge>TURN</Badge> : null}
            {!p.alive ? <Badge>OUT</Badge> : null}
          </div>
        </div>

        <div className="text-sm text-white/80 whitespace-nowrap">
          Cards: <span className="font-bold text-white">{handCount}</span>
        </div>
      </div>
    </div>
  );
}

function OpponentStack({ p, count, isTurn }) {
  // small stacked look (uses same card back repeated)
  const stack = Math.min(5, Math.max(1, count || 1));

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={[
          "relative",
          isTurn ? "drop-shadow-[0_0_12px_rgba(52,211,153,0.45)]" : "",
        ].join(" ")}
        style={{ width: 54, height: 72 }}
      >
        {Array.from({ length: stack }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: i * 4,
              top: -i * 3,
            }}
          >
            <PlayingCard card={{ r: 1, s: "S" }} faceDown size="mini" />
          </div>
        ))}
      </div>

      <div className="text-[11px] text-white/80 max-w-[92px] truncate">
        {p.name}{isTurn ? " • turn" : ""}
      </div>
      <div className="text-[10px] text-white/55">({count})</div>
    </div>
  );
}

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
  const isPlaying = roundStatus === "playing";

  const sorted = players.slice().sort((a, b) => a.seat - b.seat);
  const me = sorted.find((p) => p.id === myId) || null;
  const others = me ? sorted.filter((p) => p.id !== myId) : sorted;

  // split others into 3 “sides” for mobile arrangement
  const left = [];
  const top = [];
  const right = [];

  others.forEach((p, idx) => {
    if (idx % 3 === 0) left.push(p);
    else if (idx % 3 === 1) top.push(p);
    else right.push(p);
  });

  // helper to count cards in a seat
  const seatCount = (seat) => (Array.isArray(hands?.[seat]) ? hands[seat].length : 0);

  return (
    <Panel className="p-5">
    <div className="mb-2 text-xs">
  <span className="sm:hidden">MOBILE VIEW ✅</span>
  <span className="hidden sm:inline">DESKTOP VIEW ❌</span>
</div>
      {/* ===== Header ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Table</div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge>Direction: {direction === 1 ? "→" : "←"}</Badge>
            <Badge>Dealer: Seat {dealerSeat}</Badge>
            <Badge>Top: {topDisplay}</Badge>
            {forcedSuit ? <Badge>Forced: {suitLabel(forcedSuit)}</Badge> : <Badge>Forced: —</Badge>}
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

      {/* ==========================================================
         MOBILE TABLE (default): compact opponents + center piles
         Desktop layout below will override on sm+
         ========================================================== */}
      <div className="mt-6 sm:hidden">
        {/* Top opponents */}
        {top.length > 0 ? (
          <div className="flex justify-center gap-3 flex-wrap">
            {top.map((p) => (
              <OpponentStack
                key={p.id}
                p={p}
                count={seatCount(p.seat)}
                isTurn={isPlaying && turnSeat === p.seat}
              />
            ))}
          </div>
        ) : null}

        {/* Middle row: left stacks, center deck/top, right stacks */}
        <div className="mt-4 grid grid-cols-[1fr,auto,1fr] gap-3 items-start">
          <div className="flex flex-col items-start gap-3">
            {left.map((p) => (
              <OpponentStack
                key={p.id}
                p={p}
                count={seatCount(p.seat)}
                isTurn={isPlaying && turnSeat === p.seat}
              />
            ))}
          </div>

          {/* Center piles (always visible on mobile) */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Badge>Deck</Badge>
              <Badge>Top</Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 items-center justify-items-center">
              <div className="flex flex-col items-center gap-2">
                <div className="text-[11px] text-white/60">Deck</div>
                <PlayingCard card={{ r: 1, s: "S" }} faceDown size="table" />
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="text-[11px] text-white/60">Top</div>
                {topCard ? (
                  <PlayingCard card={topCard} size="table" glow />
                ) : (
                  <div className="text-sm text-white/60">(no top)</div>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge>Top: {topDisplay}</Badge>
              {forcedSuit ? <Badge>Forced: {suitLabel(forcedSuit)}</Badge> : null}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {right.map((p) => (
              <OpponentStack
                key={p.id}
                p={p}
                count={seatCount(p.seat)}
                isTurn={isPlaying && turnSeat === p.seat}
              />
            ))}
          </div>
        </div>

        {/* We do NOT render "me" here on mobile.
            Your hand is handled by PlayerHand fixed at the bottom. */}
      </div>

      {/* ==========================================================
         DESKTOP TABLE (sm+): your original PlayerChip layout
         ========================================================== */}
      <div className="mt-6 hidden sm:grid gap-4">
        {/* Top row */}
        {top.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {top.map((p) => {
              const handCount = seatCount(p.seat);
              const isTurn = turnSeat === p.seat && roundStatus === "playing";
              return <PlayerChip key={p.id} p={p} handCount={handCount} isTurn={isTurn} isMe={false} />;
            })}
          </div>
        ) : null}

        {/* Middle row */}
        <div className="grid gap-4 lg:grid-cols-[1fr,auto,1fr] items-start">
          <div className="grid gap-2">
            {left.map((p) => {
              const handCount = seatCount(p.seat);
              const isTurn = turnSeat === p.seat && roundStatus === "playing";
              return <PlayerChip key={p.id} p={p} handCount={handCount} isTurn={isTurn} isMe={false} />;
            })}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge>Deck</Badge>
              <Badge>Discard / Top</Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 items-center justify-items-center">
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs text-white/60">Deck</div>
                <PlayingCard card={{ r: 1, s: "S" }} faceDown size="table" />
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="text-xs text-white/60">Top</div>
                {topCard ? (
                  <PlayingCard card={topCard} size="table" glow />
                ) : (
                  <div className="text-sm text-white/60">(no top card)</div>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <Badge>Top: {topDisplay}</Badge>
              {forcedSuit ? <Badge>Forced: {suitLabel(forcedSuit)}</Badge> : null}
            </div>
          </div>

          <div className="grid gap-2">
            {right.map((p) => {
              const handCount = seatCount(p.seat);
              const isTurn = turnSeat === p.seat && roundStatus === "playing";
              return <PlayerChip key={p.id} p={p} handCount={handCount} isTurn={isTurn} isMe={false} />;
            })}
          </div>
        </div>

        {/* Bottom row: Me (desktop only) */}
        {me ? (
          <div className="mt-1">
            <PlayerChip
              p={me}
              handCount={seatCount(me.seat)}
              isTurn={turnSeat === me.seat && roundStatus === "playing"}
              isMe={true}
            />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
