export default function LobbyControls({
 me,
 dealerSeat,
 allReady,
 readyCount,
 playerCount,
 onToggleReady,
 onStartRound,
}) {
 return (
   <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
     <button onClick={onToggleReady} style={{ padding: 10 }}>
       {me?.ready ? "Unready" : "Ready"}
     </button>

     <div style={{ paddingTop: 2 }}>
       <b>Ready:</b> {readyCount}/{playerCount} (min 2, all must be ready)
     </div>

     <button
       onClick={onStartRound}
       style={{ padding: 10 }}
       disabled={!me || me.seat !== dealerSeat || !allReady}
     >
       Deal / Start Round (Dealer)
     </button>
   </div>
 );
}
