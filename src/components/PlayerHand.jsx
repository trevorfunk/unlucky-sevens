// src/components/PlayerHand.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import PlayingCard from "../ui/PlayingCard.jsx";
import { Button, Panel, Badge } from "../ui/ui.jsx";

export default function PlayerHand({
  me,
  isMyTurn,
  myHand,
  myPlayable,
  pending,
  onPlayCard,
  onPlayEight,
  onDraw,
  reduceMotion,
  bigTap,
}) {
  const pendingCount = pending?.count || 0;

  const playableKeySet = useMemo(() => {
    const s = new Set();
    for (const c of myPlayable || []) s.add(`${c.r}${c.s}`);
    return s;
  }, [myPlayable]);

  const canInteract = Boolean(me?.alive) && isMyTurn;

  const [selectedKey, setSelectedKey] = useState(null); // e.g. "7H"
  const [hint, setHint] = useState("");
  const [shakeKey, setShakeKey] = useState("");

  const selectedCard = useMemo(() => {
    if (!selectedKey) return null;
    return myHand.find((c) => `${c.r}${c.s}` === selectedKey) || null;
  }, [selectedKey, myHand]);

  function explainNotPlayable() {
    setHint(
      pendingCount > 0
        ? "Only defense cards are playable right now (no 8 defense)."
        : "That card isn’t playable."
    );
  }

  function selectOrPlay(c) {
    if (!canInteract) return;

    const key = `${c.r}${c.s}`;
    const isPlayable = playableKeySet.has(key);

    if (!isPlayable) {
      setShakeKey(`${key}-${Date.now()}`);
      explainNotPlayable();
      return;
    }

    if (selectedKey !== key) {
      setSelectedKey(key);
      setHint("");
      return;
    }

    playSelected(c);
  }

  function playSelected(card) {
    if (!canInteract) return;
    if (!card) return;

    const key = `${card.r}${card.s}`;
    const isPlayable = playableKeySet.has(key);

    if (!isPlayable) {
      setShakeKey(`${key}-${Date.now()}`);
      explainNotPlayable();
      return;
    }

    // 8 suit chooser handled in App.jsx (only when not defending)
    if (card.r === 8 && pendingCount === 0) {
      onPlayEight(card);
      setSelectedKey(null);
      return;
    }

    onPlayCard(card);
    setSelectedKey(null);
  }

  // If your turn ends or you die, clear selection
  if ((!canInteract || !me?.alive) && selectedKey) {
    setTimeout(() => setSelectedKey(null), 0);
  }

  // ---------- MOBILE measured overlap/fan ----------
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

    // Your PlayingCard "hand" width is ~w-20 => 80px on mobile now.
    const cardW = 80;
    const trayH = 150;

    if (n <= 1) return { cardW, step: 0, trayH };

    // Fit: cardW + (n-1)*step <= trayW
    const ideal = Math.floor((trayW - cardW) / Math.max(1, n - 1));

    // Clamp so overlap is guaranteed and still readable
    const step = Math.max(16, Math.min(ideal, 34));

    return { cardW, step, trayH };
  }, [myHand.length, trayW]);

  // Height of the fixed action bar (your "Pick up / Play / X" bar)
const ACTION_BAR_H = 76;

// Height of the fixed hand dock (cards area)
const HAND_DOCK_H = overlap.trayH + 28; // tray + padding

  return (
    <Panel className="p-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
        <div className="text-lg font-semibold sm:block hidden">Your hand</div>
          <Badge>{myHand.length} cards</Badge>
          {isMyTurn ? <Badge>Your turn</Badge> : <Badge>Waiting</Badge>}
          {!me?.alive ? <Badge>OUT</Badge> : null}
        </div>

        {selectedCard ? (
          <div className="text-sm text-white/75">
            Selected:{" "}
            <span className="font-semibold text-white">
              {selectedCard.r}
              {selectedCard.s}
            </span>{" "}
            <span className="text-white/50">(tap again to play)</span>
          </div>
        ) : (
          <div className="text-xs text-white/55">
            Tap a playable card once to select, again to play.
          </div>
        )}
      </div>

      {/* Hint */}
      {hint ? (
        <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {hint}
        </div>
      ) : null}

      {/* =========================
          CARDS
          Desktop: old row
          Mobile: measured overlap fan (no scroll)
         ========================= */}

      {/* Desktop / tablet */}
      <div className={["mt-4 hidden sm:flex items-stretch", bigTap ? "gap-4" : "gap-3"].join(" ")}>
        {myHand.map((c, i) => {
          const key = `${c.r}${c.s}`;
          const isPlayable = playableKeySet.has(key);

          const shouldShake = shakeKey.startsWith(`${key}-`);
          const isSelected = selectedKey === key;

          return (
            <motion.div
              key={`${key}-${i}`}
              animate={
                reduceMotion
                  ? { x: 0 }
                  : shouldShake
                  ? { x: [0, -6, 6, -5, 5, -3, 3, 0] }
                  : { x: 0 }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : shouldShake
                  ? { duration: 0.35 }
                  : { duration: 0.15 }
              }
              className="transition shrink-0"
            >
              <PlayingCard
                card={c}
                size="hand"
                glow={isPlayable && canInteract}
                selected={isSelected}
                disabled={!canInteract || !me?.alive}
                onClick={() => selectOrPlay(c)}
              />
            </motion.div>
          );
        })}

        {myHand.length === 0 ? <div className="text-sm text-white/60">(empty)</div> : null}
      </div>

      {/* Mobile overlap fan (no scroll) */}
      {/* Mobile fixed hand dock (always pinned above the action bar) */}
<div className="sm:hidden">
  {/* Spacer so page content doesn't get covered by the fixed dock */}
  <div style={{ height: HAND_DOCK_H + ACTION_BAR_H + 18 }} />

  {/* Fixed dock */}
  <div
    ref={trayRef}
    className="fixed left-0 right-0 z-[9997] border-t border-white/10 bg-zinc-950/92 backdrop-blur"
    style={{
      bottom: `calc(${ACTION_BAR_H}px + env(safe-area-inset-bottom))`,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}
  >
    <div className="mx-auto w-full max-w-5xl px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold">Your hand</div>
          <Badge>{myHand.length}</Badge>
        </div>
        {isMyTurn ? <Badge>Your turn</Badge> : <Badge>Waiting</Badge>}
      </div>

      <div
        className="relative mx-auto mt-3"
        style={{
          height: overlap.trayH,
          width: overlap.cardW + Math.max(0, myHand.length - 1) * overlap.step,
          maxWidth: "100%",
        }}
      >
        {myHand.map((c, i) => {
          const key = `${c.r}${c.s}`;
          const isPlayable = playableKeySet.has(key);
          const shouldShake = shakeKey.startsWith(`${key}-`);
          const isSelected = selectedKey === key;

          const n = myHand.length || 1;
          const mid = (n - 1) / 2;
          const rot = (i - mid) * 2.0;         // slightly tighter than before
          const lift = Math.abs(i - mid) * 0.4;

          return (
            <motion.div
              key={`${key}-${i}`}
              animate={
                reduceMotion
                  ? { x: 0 }
                  : shouldShake
                  ? { x: [0, -6, 6, -5, 5, -3, 3, 0] }
                  : { x: 0 }
              }
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : shouldShake
                  ? { duration: 0.35 }
                  : { duration: 0.15 }
              }
              className="absolute origin-bottom"
              style={{
                left: i * overlap.step,
                top: 6 + lift,
                transform: `rotate(${rot}deg)`,
                zIndex: i,
              }}
            >
              <PlayingCard
                card={c}
                size="hand"
                glow={isPlayable && canInteract}
                selected={isSelected}
                disabled={!canInteract || !me?.alive}
                onClick={() => selectOrPlay(c)}
              />
            </motion.div>
          );
        })}

        {myHand.length === 0 ? (
          <div className="text-sm text-white/60">(empty)</div>
        ) : null}
      </div>
    </div>
  </div>
</div>


      {/* Actions */}
      <div className="mt-5">
        {/* Desktop actions */}
        <div className="hidden sm:flex flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onDraw} disabled={!canInteract}>
              {pendingCount > 0 ? `Pick up ${pendingCount} (penalty)` : "Pick up 1"}
            </Button>

            {selectedCard ? (
              <Button onClick={() => playSelected(selectedCard)} disabled={!canInteract}>
                Play selected
              </Button>
            ) : null}

            <Button
              variant="secondary"
              onClick={() => {
                setSelectedKey(null);
                setHint("");
              }}
              disabled={!selectedCard}
            >
              Clear selection
            </Button>

            {pendingCount > 0 ? <Badge>Defense window</Badge> : <Badge>No penalty</Badge>}
          </div>

          <div className="text-xs text-white/60 leading-relaxed max-w-xl">
            Rule: If you have a playable/defense card, you MUST play. After you pick up, if you now can play, you may play
            one card.
          </div>
        </div>

        {/* Mobile sticky bar */}
        <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9998] border-t border-white/10 bg-zinc-950/92 backdrop-blur px-3 py-3">
          <div className="mx-auto w-full max-w-5xl flex items-center gap-2">
            <Button onClick={onDraw} disabled={!canInteract} className="flex-1">
              {pendingCount > 0 ? `Pick up ${pendingCount}` : "Pick up"}
            </Button>

            {selectedCard ? (
              <Button onClick={() => playSelected(selectedCard)} disabled={!canInteract} className="flex-1">
                Play
              </Button>
            ) : (
              <Button variant="secondary" disabled className="flex-1">
                Select card
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={() => {
                setSelectedKey(null);
                setHint("");
              }}
              disabled={!selectedCard}
            >
              ✕
            </Button>
          </div>

          <div className="mx-auto w-full max-w-5xl mt-2 flex flex-wrap gap-2 text-xs">
            {pendingCount > 0 ? <Badge>Defense window</Badge> : <Badge>No penalty</Badge>}
            {isMyTurn ? <Badge>Your turn</Badge> : <Badge>Waiting</Badge>}
            {selectedCard ? <Badge>Selected</Badge> : null}
          </div>
        </div>
      </div>
    </Panel>
  );
}
