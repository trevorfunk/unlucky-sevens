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
    "rounded-2xl border px-3 py-2",
    isTurn ? "border-emerald-300/25 bg-emerald-400/10" : "border-white/10 bg-white/5",
  ].join(" ");
}

function SmallStack({ count }) {
  const n = Math.min(6, Math.max(0, count || 0));
  return (
    <div className="relative h-10 w-12">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-xl border border-white/10 bg-white/5"
          style={{ transform: `translate(${i * 2}px, ${-i * 1}px)` }}
        />
      ))}
      <div className="absolute -bottom-5 left-0 text-[11px] text-white/70">{count} cards</div>
    </div>
  );
}

export default function PublicTable({
  players = [],
  me,
  myId,
  roundStatus,

  dealerSeat,
  turnSeat,
  isMyTurn,
  direction,

  pending,
  topCard,
  topDisplay,
  forcedSuit,

  deck = [],
  discard = [],
  remainingSec,

  reduceMotion,
  onPassTurn,
  onPickupPending,
  onTimeoutPickupAndPass,
}) {
  const hasPending = (pending?.count || 0) > 0;

  const others = players
    .filter((p) => p.id !== myId)
    .slice()
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));

  const mySeat = me?.seat ?? null;

  // --- MOBILE VIEW (<sm) ---
  const Mobile = (
    <Panel className="p-4">
      {/* ===== Header ===== */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Table</div>
          <div className="mt-1 text-xs text-white/60">
            Top: {topDisplay}
            {forcedSuit ? ` · Forced: ${suitLabel(forcedSuit)}` : ""}
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
              Pending pickup: <span className="font-extrabold">{pending.count}</span> {pending.type ? `(${pending.type})` : ""}
            </>
          ) : (
            "No pending pickup"
          )}
        </div>
      </div>

      {/* ===== Mobile table layout ===== */}
      <div className="mt-4 grid gap-4">
        {/* Opponents row */}
        <div className="flex items-start justify-between gap-3">
          {others.length ? (
            others.map((p) => (
              <div key={p.id} className="flex flex-col items-center gap-2">
                <div className="text-xs text-white/70">
                  Seat {p.seat} · {p.name} {p.alive === false ? "(OUT)" : ""}
                </div>
                <SmallStack count={p.handCount ?? 0} />
              </div>
            ))
          ) : (
            <div className="text-sm text-white/60">Waiting for another player…</div>
          )}
        </div>

        {/* Center: deck + top */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/60">Deck</div>
            <div className="mt-2 text-2xl font-semibold">{deck.length}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs text-white/60">Top</div>
            <div className="mt-2 flex items-center gap-3">
              {topCard ? <PlayingCard card={topCard} /> : <div className="text-white/60">—</div>}
              {forcedSuit ? (
                <div className="text-xs text-white/70">
                  Forced: <span className="font-semibold text-white">{suitLabel(forcedSuit)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {roundStatus === "playing" ? (
            <>
              <button
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85"
                onClick={onPassTurn}
                disabled={!isMyTurn || hasPending}
              >
                Pass
              </button>

              <button
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85"
                onClick={onPickupPending}
                disabled={!isMyTurn || !hasPending}
              >
                Pick up
              </button>
            </>
          ) : null}

          {remainingSec != null ? (
            <div className="ml-auto rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              Turn timer: <span className="font-semibold text-white">{remainingSec}s</span>
            </div>
          ) : null}

          {/* if you have auto-timeout pickup */}
          {typeof onTimeoutPickupAndPass === "function" && false ? (
            <button className="hidden" onClick={onTimeoutPickupAndPass} />
          ) : null}
        </div>
      </div>
    </Panel>
  );

  // --- DESKTOP VIEW (sm+) ---
  const Desktop = (
    <Panel className="hidden sm:block p-5">
      {/* ===== Header ===== */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Table</div>
          <div className="mt-1 text-xs text-white/60">
            Top: {topDisplay}
            {forcedSuit ? ` · Forced: ${suitLabel(forcedSuit)}` : ""}
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
              Pending pickup: <span className="font-extrabold">{pending.count}</span> {pending.type ? `(${pending.type})` : ""}
            </>
          ) : (
            "No pending pickup"
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        {/* Players */}
        <div className="grid gap-3">
          {players
            .slice()
            .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
            .map((p) => {
              const isTurn = p.seat === turnSeat;
              return (
                <div key={p.id} className={seatClass(isTurn)}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      Seat {p.seat}: {p.name} {p.id === myId ? "(you)" : ""} {p.alive === false ? "(OUT)" : ""}
                    </div>
                    {isTurn ? <Badge>TURN</Badge> : null}
                  </div>
                  <div className="mt-1 text-xs text-white/70">
                    Cards: <span className="font-semibold text-white">{p.handCount ?? (p.id === myId ? mySeat : 0)}</span>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Center */}
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Deck</div>
            <div className="mt-1 text-3xl font-semibold">{deck.length}</div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Top</div>
            <div className="mt-2 flex items-center gap-3">
              {topCard ? <PlayingCard card={topCard} /> : <div className="text-white/60">—</div>}
              {forcedSuit ? (
                <div className="text-xs text-white/70">
                  Forced: <span className="font-semibold text-white">{suitLabel(forcedSuit)}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-xs text-white/60">Discard</div>
            <div className="mt-1 text-3xl font-semibold">{discard.length}</div>
          </div>

          {roundStatus === "playing" ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Actions</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85"
                  onClick={onPassTurn}
                  disabled={!isMyTurn || hasPending}
                >
                  Pass
                </button>

                <button
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/85"
                  onClick={onPickupPending}
                  disabled={!isMyTurn || !hasPending}
                >
                  Pick up
                </button>

                {remainingSec != null ? (
                  <div className="ml-auto rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                    Turn timer: <span className="font-semibold text-white">{remainingSec}s</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Panel>
  );

  return (
    <div>
      <div className="sm:hidden">{Mobile}</div>
      {Desktop}
    </div>
  );
}
