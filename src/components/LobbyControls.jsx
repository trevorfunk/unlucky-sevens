import { Button, Panel, Badge } from "../ui/ui.jsx";

export default function LobbyControls({
  me,
  dealerSeat,
  allReady,
  readyCount,
  playerCount,
  onToggleReady,
  onStartRound,
  players, // OPTIONAL: if you pass it, we’ll show the list
}) {
  const isDealer = Boolean(me) && me.seat === dealerSeat;
  const canStart = Boolean(me) && isDealer && allReady;

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Lobby</Badge>
          <Badge>Ready: {readyCount}/{playerCount}</Badge>
          <Badge>Min 2</Badge>
          {isDealer ? <Badge>Dealer</Badge> : <Badge>Player</Badge>}
        </div>

        <div className="text-sm text-white/80">
          {isDealer ? (
            <>
              You are the <span className="font-semibold text-white">dealer</span>. Start the round once everyone is ready.
            </>
          ) : (
            <>
              Waiting for the dealer (seat <span className="font-semibold text-white">{dealerSeat}</span>) to start.
            </>
          )}
        </div>

        {/* Ready list (only if players is provided) */}
        {Array.isArray(players) && players.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold text-white">Players</div>
            <div className="mt-3 grid gap-2">
              {players
                .slice()
                .sort((a, b) => a.seat - b.seat)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div className="text-sm text-white/85">
                      Seat {p.seat}: <span className="font-semibold text-white">{p.name}</span>{" "}
                      {p.id === me?.id ? <span className="text-white/60">(you)</span> : null}
                    </div>
                    <div className="text-sm font-semibold">
                      {p.ready ? (
                        <span className="text-emerald-200">● Ready</span>
                      ) : (
                        <span className="text-rose-200">● Not ready</span>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={onToggleReady} variant={me?.ready ? "secondary" : "primary"}>
            {me?.ready ? "Unready" : "Ready"}
          </Button>

          <Button onClick={onStartRound} disabled={!canStart} variant="primary">
            Deal / Start Round
          </Button>
        </div>

        <div className="text-xs text-white/55">
          Tip: only the dealer can start, and all players must be ready.
        </div>
      </div>
    </Panel>
  );
}
