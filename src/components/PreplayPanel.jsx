import { cardToString } from "../game/cards";

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
  return (
    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <b>Pre-Round Phase:</b> Resolve any 7s manually by playing 7→8 before the first turn begins.
      </div>

      <div style={{ marginTop: 10 }}>
        <b>Your hand ({myHand.length})</b>
        {!me?.alive && <div style={{ color: "crimson", marginTop: 6 }}>You are OUT this round.</div>}

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {myHand.map((c, i) => (
            <div
              key={`${c.r}${c.s}${i}`}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "white",
              }}
            >
              {cardToString(c)}
            </div>
          ))}
          {myHand.length === 0 && <div>(empty)</div>}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button
          onClick={onOpenSuitModalForSevens}
          style={{ padding: 10 }}
          disabled={!me?.alive || mySevens === 0}
        >
          Play 7+8 Save ({mySevens} seven{mySevens === 1 ? "" : "s"})
        </button>

        <div style={{ fontSize: 13, opacity: 0.85 }}>
          You must end preplay with <b>0 sevens</b> in your hand.
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <b>Ready to begin?</b> {allAliveSevensResolved ? "✅ All sevens resolved" : "⏳ Waiting on players"}
      </div>

      <div style={{ marginTop: 10 }}>
        <button
          onClick={onBeginFirstTurn}
          style={{ padding: 10 }}
          disabled={!me || me.seat !== dealerSeat || !allAliveSevensResolved}
        >
          Begin First Turn (Dealer)
        </button>
      </div>
    </div>
  );
}
