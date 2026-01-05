export default function Scoreboard({ players, roundWins }) {
 return (
   <div style={{ marginTop: 12 }}>
     <b>Score (first to 7 wins)</b>

     <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
       {players
         .slice()
         .sort((a, b) => a.seat - b.seat)
         .map((p) => (
           <div key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
             <div>
               Seat {p.seat}: {p.name} {p.alive ? "" : "(OUT)"} {p.ready ? "✅" : ""}
             </div>
             <div style={{ opacity: 0.85 }}>Wins: {roundWins[p.id] || 0}</div>
           </div>
         ))}
     </div>
   </div>
 );
}
