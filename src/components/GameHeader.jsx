import { suitLabel } from "../game/cards";

export default function GameHeader({
  codeShown,
  me,
  round,
  roundStatus,
  remainingSec,
  dealerSeat,
  turnSeat,
  isMyTurn,
  direction,
  pending,
  topDisplay,
  forcedSuit,
  deckCount,
  discardCount,
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div>
          <b>Room:</b> {codeShown}
        </div>
        <div>
          <b>You:</b> {me ? `${me.name} (seat ${me.seat})` : "Not joined"}
        </div>
        <div>
          <b>Round:</b> {round} &nbsp; <b>Status:</b> {roundStatus}
        </div>
        <div style={{ marginTop: 4 }}>
          <b>Turn timer:</b>{" "}
          {roundStatus === "playing" && remainingSec != null ? (
            <span style={{ fontWeight: 900, color: remainingSec <= 5 ? "crimson" : "inherit" }}>
              {remainingSec}s
            </span>
          ) : (
            "-"
          )}
        </div>
      </div>

      <div>
        <div>
          <b>Dealer seat:</b> {dealerSeat}
        </div>
        <div>
          <b>Turn seat:</b> {turnSeat ?? "-"} {isMyTurn ? "(YOU)" : ""}
        </div>
        <div>
          <b>Direction:</b> {direction === 1 ? "→" : "←"}
        </div>
        <div>
          <b>Pending draw:</b> {pending?.count || 0} {pending?.type ? `(${pending.type})` : ""}
        </div>
      </div>

      <div>
        <div>
          <b>Top:</b> {topDisplay}
        </div>
        <div>
          <b>Forced suit:</b> {forcedSuit ? suitLabel(forcedSuit) : "-"}
        </div>
        <div>
          <b>Deck:</b> {deckCount}
        </div>
        <div>
          <b>Discard:</b> {discardCount}
        </div>
      </div>
    </div>
  );
}
