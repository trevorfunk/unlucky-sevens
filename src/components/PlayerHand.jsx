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
}) {
  const pendingCount = pending?.count || 0;

  // quick lookup for playable cards
  const playableKeySet = useMemo(() => {
    const s = new Set();
    for (const c of myPlayable || []) s.add(`${c.r}${c.s}`);
    return s;
  }, [myPlayable]);

  const canInteract = Boolean(me?.alive) && isMyTurn;

  const [shakeKey, setShakeKey] = useState(""); // which card shakes
  const [hint, setHint] = useState("");

  function tryPlay(c) {
    if (!canInteract) return;

    const isPlayable = playableKeySet.has(`${c.r}${c.s}`);

    if (!isPlayable) {
      setShakeKey(`${c.r}${c.s}-${Date.now()}`);
      setHint(
        pendingCount > 0
          ? "Only defense cards are playable right now (no 8 defense)."
          : "That card isn’t playable."
      );
      return;
    }

    // 8 suit chooser handled in App.jsx (only when not defending)
    if (c.r === 8 && pendingCount === 0) {
      onPlayEight(c);
      return;
    }

    onPlayCard(c);
  }

  return (
    <Panel className="p-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="text-lg font-semibold">Your hand</div>
          <Badge>{myHand.length} cards</Badge>
          {isMyTurn ? <Badge>Your turn</Badge> : <Badge>Waiting</Badge>}
          {!me?.alive ? <Badge>OUT</Badge> : null}
        </div>

        {!me?.alive ? (
          <div className="text-sm text-rose-200 bg-rose-500/10 border border-rose-300/20 rounded-2xl px-3 py-2">
            You are <span className="font-semibold">OUT</span> this round.
          </div>
        ) : null}
      </div>

      {/* Hint row */}
      {hint ? (
        <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          {hint}
        </div>
      ) : null}

      {/* Cards */}
      <div className="mt-4 flex flex-wrap gap-3">
        {myHand.map((c, i) => {
          const isPlayable = playableKeySet.has(`${c.r}${c.s}`);
          const disabled = !canInteract || !isPlayable;

          const title = isPlayable
            ? "Playable"
            : pendingCount > 0
            ? "Only defense cards playable (no 8 defense)"
            : "Not playable";

          const shouldShake = shakeKey.startsWith(`${c.r}${c.s}-`);

          return (
            <motion.div
              key={`${c.r}${c.s}${i}`}
              animate={shouldShake ? { x: [0, -6, 6, -5, 5, -3, 3, 0] } : { x: 0 }}
              transition={shouldShake ? { duration: 0.35 } : { duration: 0.15 }}
              className={!disabled ? "hover:-translate-y-0.5 transition" : ""}
              title={title}
            >
              <PlayingCard
                card={c}
                size="hand"
                glow={isPlayable && canInteract}
                disabled={!canInteract || !me?.alive} // disables all interaction when not your turn / out
                onClick={() => tryPlay(c)}
              />
            </motion.div>
          );
        })}

        {myHand.length === 0 ? (
          <div className="text-sm text-white/60">(empty)</div>
        ) : null}
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onDraw} disabled={!canInteract}>
            {pendingCount > 0 ? `Pick up ${pendingCount} (penalty)` : "Pick up 1"}
          </Button>

          {pendingCount > 0 ? <Badge>Defense window</Badge> : <Badge>No penalty</Badge>}
        </div>

        <div className="text-xs text-white/60 leading-relaxed max-w-xl">
          Rule: If you have a playable/defense card, you MUST play. After you pick up, if you now can play, you may play
          one card.
        </div>
      </div>
    </Panel>
  );
}
