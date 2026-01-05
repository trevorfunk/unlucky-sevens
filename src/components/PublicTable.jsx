import { suitLabel } from "../game/cards";

export default function PublicTable({
  players,
  hands,
  turnSeat,
  roundStatus,
  pending,
  topDisplay,
  forcedSuit,
  direction,
  dealerSeat,
  myId,
}) {
  return (
    <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <b>Table</b>
          <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
            <div>
              <b>Top:</b> {topDisplay}{" "}
              {forcedSuit ? (
                <span style={{ marginLeft: 8 }}>
                  <b>Suit:</b> {suitLabel(forcedSuit)}
                </span>
              ) : null}
            </div>
            <div style={{ marginTop: 4 }}>
              <b>Direction:</b> {direction === 1 ? "→" : "←"} &nbsp;&nbsp;
              <b>Dealer:</b> seat {dealerSeat}
            </div>
          </div>
        </div>

        <div>
          {(pending?.count || 0) > 0 ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "#fff3cd",
                border: "1px solid #ffe69c",
                fontWeight: 700,
              }}
            >
              Pending pickup: {pending.count} {pending.type ? `(${pending.type})` : ""} — defend with 2 / Q♠
            </div>
          ) : (
            <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f6f6f6", border: "1px solid #eee" }}>
              No pending pickup
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
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
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #eee",
                  background: isTurn ? "#e9f5ff" : "white",
                }}
              >
                <div>
                  <b>Seat {p.seat}:</b> {p.name} {isMe ? "(YOU)" : ""} {!p.alive ? " — OUT" : ""}
                  {isTurn ? <span style={{ marginLeft: 8, fontWeight: 800 }}>(TURN)</span> : null}
                </div>
                <div style={{ opacity: 0.9 }}>
                  Cards: <b>{handCount}</b>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
