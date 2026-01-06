// src/components/PlayerHand.jsx
import { useMemo, useState } from "react";
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

  // ---- MOBILE hand sizing / overlap ----
  // We compute a per-card horizontal offset so ALL cards fit without scrolling.
  // Card width assumption: "hand" size is ~96px (varies). We choose an overlap offset that
  // fits within viewport width while keeping at least a small visible strip of each card.
  const overlapStyle = useMemo(() => {
    const n = myHand.length || 0;

    // Mobile safe fallback
    if (n <= 1) return { cardW: 92, step: 0, trayH: 150 };

    // We approximate card width for the "hand" size.
    // If your PlayingCard size differs, tweak cardW a bit.
    const cardW = bigTap ? 104 : 92;

    // Available width: viewport minus padding. Use 360 as a safe baseline (small iPhone).
    // We’ll clamp the step so there’s always at least 22px visible per card.
    const baseViewport = 360;
    const padding = 24; // left+right padding
    const available = baseViewport - padding;

    // Solve: totalWidth = cardW + (n-1)*step <= available
    const idealStep = Math.floor((available - cardW) / Math.max(1, n - 1));

    // Clamp step so overlap isn’t too extreme or too loose
    const step = Math.max(22, Math.min(idealStep, 46));

    // Tray height: enough for a slight lift when selected + action bar above
    const trayH = 168;

    return { cardW, step, trayH };
  }, [myHand.length, bigTap]);

  return (
    <>
      {/* ============================
          DESKTOP: keep as panel
          ============================ */}
      <div className="hidden sm:block">
        <Panel className="p-5">
          {/* Header */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold">Your hand</div>
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

          {/* Desktop row (no change): still scrollable if needed */}
          <div className={["mt-4 flex items-stretch overflow-x-auto pb-2", bigTap ? "gap-4" : "gap-3"].join(" ")}>
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

          {/* Desktop actions */}
          <div className="mt-5 flex flex-row items-center justify-between gap-3">
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
              Rule: If you have a playable/defense card, you MUST play. After you pick up, if you now can play, you may play one card.
            </div>
          </div>
        </Panel>
      </div>

      {/* ============================
          MOBILE: fixed overlapped hand
          ============================ */}
      <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9998] border-t border-white/10 bg-zinc-950/92 backdrop-blur">
        {/* Mobile status/header (compact) */}
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-sm font-semibold">Your hand</div>
              <Badge>{myHand.length}</Badge>
              {isMyTurn ? <Badge>Your turn</Badge> : <Badge>Waiting</Badge>}
            </div>
            {pendingCount > 0 ? <Badge>Defense</Badge> : <Badge>No penalty</Badge>}
          </div>

          {hint ? (
            <div className="mt-2 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              {hint}
            </div>
          ) : null}
        </div>

        {/* Overlapped hand tray (NO scroll) */}
        <div
          className="px-3 pt-3"
          style={{
            height: overlapStyle.trayH,
          }}
        >
          <div
            className="relative"
            style={{
              height: overlapStyle.trayH,
              // total width of stacked cards so they don't overflow container visually
              width: overlapStyle.cardW + Math.max(0, myHand.length - 1) * overlapStyle.step,
              maxWidth: "100%",
              margin: "0 auto",
            }}
          >
            {myHand.map((c, i) => {
              const key = `${c.r}${c.s}`;
              const isPlayable = playableKeySet.has(key);
              const shouldShake = shakeKey.startsWith(`${key}-`);
              const isSelected = selectedKey === key;

              // Selected card lifts up slightly
              const lift = isSelected ? -14 : 0;

              return (
                <motion.div
                  key={`${key}-${i}`}
                  className="absolute"
                  style={{
                    left: i * overlapStyle.step,
                    top: 14 + lift,
                    zIndex: isSelected ? 50 : i,
                  }}
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
        </div>

        {/* Mobile action bar */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2">
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

          {selectedCard ? (
            <div className="mt-2 text-[11px] text-white/70">
              Selected:{" "}
              <span className="font-semibold text-white">
                {selectedCard.r}
                {selectedCard.s}
              </span>{" "}
              <span className="text-white/45">(tap again to play)</span>
            </div>
          ) : (
            <div className="mt-2 text-[11px] text-white/55">
              Tap a playable card once to select, again to play.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
