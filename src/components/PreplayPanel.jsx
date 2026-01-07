import { useEffect, useMemo, useRef, useState } from "react";
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

  let bannerText = "⏳ Waiting on players to resolve sevens…";
  let bannerClass = "border-white/10 bg-white/5 text-white/80";

  if (!me?.alive) {
    bannerText = "You are OUT this round.";
    bannerClass = "border-rose-300/20 bg-rose-500/10 text-rose-200";
  } else if (mySevens > 0) {
    bannerText = "⚠️ You have sevens — resolve them before the round starts.";
    bannerClass = "border-amber-300/30 bg-amber-400/10 text-amber-200";
  } else if (allAliveSevensResolved && isDealer) {
    bannerText = "✅ Everyone is ready — you can begin the first turn (Dealer).";
    bannerClass = "border-emerald-300/30 bg-emerald-400/10 text-emerald-200";
  } else if (allAliveSevensResolved) {
    bannerText = "✅ You’re ready. Waiting for the dealer to begin the first turn…";
    bannerClass = "border-emerald-300/20 bg-emerald-400/10 text-emerald-200";
  }

  // ---- MOBILE measured overlap ----
  const trayRef = useRef(null);
  const [trayW, setTrayW] = useState(320);

  useEffect(() => {
    const el = trayRef.current;
    if (!el) return;

    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width || 320);
      setTrayW(w);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);

    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const overlap = useMemo(() => {
    const n = myHand.length || 0;

    // We want it to look like "cards in hand", so make them a bit smaller on mobile.
    // If your PlayingCard has no smaller size, this still helps via overlap.
    const cardW = 76; // smaller feel
    const trayH = 136;

    if (n <= 1) return { cardW, step: 0, trayH };

    // Fit width: cardW + (n-1)*step <= trayW
    const ideal = Math.floor((trayW - cardW) / Math.max(1, n - 1));

    // clamp so there is ALWAYS overlap (step smaller than cardW)
    // and still visible strip of each card
    const step = Math.max(16, Math.min(ideal, 34));

    return { cardW, step, trayH };
  }, [myHand.length, trayW]);

  return (
    <>
      <Panel className="p-5">
        {/* Pad bottom on mobile so content isn't hidden behind fixed tray */}
        <div className="flex flex-col gap-4 pb-56 sm:pb-0">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Pre-Round</Badge>
            <Badge>Seat {mySeat ?? "-"}</Badge>
            <Badge>Sevens: {mySevens}</Badge>
            {isDealer ? <Badge>Dealer</Badge> : null}
          </div>

          {/* Banner */}
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${bannerClass}`}>
            {bannerText}
          </div>

          {/* Explanation */}
          <div className="text-sm text-white/80 leading-relaxed">
            <span className="font-semibold text-white">Goal:</span> Before the first turn begins, any player holding 7s must
            “save” them by pairing each 7 with an 8. Your 8 sets a suit using the suit picker.
          </div>

          {/* Hand (DESKTOP ONLY) */}
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-white">Your hand</div>
              <Badge>{myHand.length} cards</Badge>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              {myHand.map((c, i) => (
                <PlayingCard key={`${c.r}${c.s}${i}`} card={c} size="hand" />
              ))}
              {myHand.length === 0 ? <div className="text-sm text-white/60">(empty)</div> : null}
            </div>
          </div>

          {/* Resolve + begin */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Panel className="p-4">
              <div className="text-sm font-semibold">Resolve your sevens</div>
              <div className="mt-1 text-xs text-white/60">
                You must end preplay with <span className="font-semibold text-white">0 sevens</span>.
              </div>
              <div className="mt-3">
                <Button onClick={onOpenSuitModalForSevens} disabled={!canResolve}>
                  Play 7 + 8 Save ({mySevens})
                </Button>
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="text-sm font-semibold">Begin the round</div>
              <div className="mt-1 text-xs text-white/60">
                Only the dealer (seat {dealerSeat}) can begin the first turn once everyone is ready.
              </div>
              <div className="mt-3">
                <Button onClick={onBeginFirstTurn} disabled={!canBegin}>
                  Begin First Turn (Dealer)
                </Button>
              </div>
            </Panel>
          </div>

          {/* Status */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-white">Table status</div>
            {allAliveSevensResolved ? <Badge>✅ All sevens resolved</Badge> : <Badge>⏳ Waiting on players</Badge>}
          </div>
        </div>
      </Panel>

      {/* MOBILE fixed hand tray */}
      <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9997] border-t border-white/10 bg-zinc-950/92 backdrop-blur">
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Your hand</div>
              <Badge>{myHand.length}</Badge>
            </div>
            <Badge>Pre-Round</Badge>
          </div>
        </div>

        {/* measured width container */}
        <div ref={trayRef} className="px-3 pt-3" style={{ height: overlap.trayH }}>
          <div
            className="relative mx-auto"
            style={{
              height: overlap.trayH,
              width: overlap.cardW + Math.max(0, myHand.length - 1) * overlap.step,
              maxWidth: "100%",
            }}
          >
            {myHand.map((c, i) => {
              const n = myHand.length || 1;
              const mid = (n - 1) / 2;
              const rot = (i - mid) * 2.2; // small fan curve
              const lift = Math.abs(i - mid) * 0.5; // subtle arc

              return (
                <div
                  key={`${c.r}${c.s}${i}`}
                  className="absolute origin-bottom"
                  style={{
                    left: i * overlap.step,
                    top: 6 + lift,
                    transform: `rotate(${rot}deg)`,
                    zIndex: i,
                  }}
                >
                  {/* NOTE: still size="hand" because PlayingCard controls its own rendering.
                      The overlap math forces the fan look regardless. */}
                  <PlayingCard card={c} size="hand" />
                </div>
              );
            })}

            {myHand.length === 0 ? <div className="text-sm text-white/60">(empty)</div> : null}
          </div>
        </div>

        {/* buttons */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2">
            <Button onClick={onOpenSuitModalForSevens} disabled={!canResolve} className="flex-1">
              Save 7s ({mySevens})
            </Button>
            <Button onClick={onBeginFirstTurn} disabled={!canBegin} className="flex-1">
              Begin (Dealer)
            </Button>
          </div>
          <div className="mt-2 text-[11px] text-white/55">
            Tip: Save each 7 by pairing it with an 8 (your 8 chooses suit).
          </div>
        </div>
      </div>
    </>
  );
}
