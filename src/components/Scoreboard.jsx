export default function Scoreboard({ players = [], roundWins = {}, compact = true }) {
  const list = (Array.isArray(players) ? players : [])
    .slice()
    .sort((a, b) => (a?.seat ?? 0) - (b?.seat ?? 0));

  // Compact = single-line pills (best for mobile + keeps table visible without scrolling)
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-white/70 font-semibold">Score (first to 7)</div>

        <div className="flex items-center gap-2 flex-wrap">
          {list.map((p) => (
            <div
              key={p.id}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/85"
              title={`Seat ${p.seat}${p.alive ? "" : " (OUT)"}`}
            >
              <span className="font-semibold text-white">{p.name || `Seat ${p.seat}`}</span>
              <span className="text-white/60">:</span> {roundWins?.[p.id] || 0}
              {!p.alive ? <span className="ml-1 text-white/50">(OUT)</span> : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Non-compact (fallback / optional)
  return (
    <div className="grid gap-2">
      <div className="text-sm font-semibold">Score (first to 7 wins)</div>
      <div className="grid gap-2">
        {list.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0 truncate">
              Seat {p.seat}: {p.name} {p.alive ? "" : "(OUT)"} {p.ready ? "✅" : ""}
            </div>
            <div className="text-white/70 whitespace-nowrap">Wins: {roundWins?.[p.id] || 0}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
