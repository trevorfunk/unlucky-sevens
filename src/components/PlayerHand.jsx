import { cardToString } from "../game/cards";

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
  return (
    <div>
      <b>Your hand ({myHand.length})</b>
      {!me?.alive && <div style={{ color: "crimson", marginTop: 6 }}>You are OUT this round.</div>}

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {myHand.map((c, i) => {
          const isPlayable = myPlayable.some((p) => p.r === c.r && p.s === c.s);

          return (
            <button
              key={`${c.r}${c.s}${i}`}
              onClick={() => {
                // 8 suit chooser handled in App.jsx
                if (c.r === 8 && (pending?.count || 0) === 0) {
                  onPlayEight(c);
                  return;
                }
                onPlayCard(c);
              }}
              disabled={!isMyTurn || !me?.alive || !isPlayable}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: isPlayable ? "white" : "#f3f3f3",
                cursor: "pointer",
              }}
              title={
                isPlayable
                  ? "Playable"
                  : (pending?.count || 0) > 0
                  ? "Only defense cards playable (no 8 defense)"
                  : "Not playable"
              }
            >
              {cardToString(c)}
            </button>
          );
        })}
        {myHand.length === 0 && <div>(empty)</div>}
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={onDraw} style={{ padding: 10 }} disabled={!isMyTurn || !me?.alive}>
          {(pending?.count || 0) > 0 ? `Pick up ${pending.count} (penalty)` : "Pick up 1"}
        </button>

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Rule: If you have a playable/defense card, you MUST play. After you pick up, if you now can play, you may play
          one card.
        </div>
      </div>
    </div>
  );
}
