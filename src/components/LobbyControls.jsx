// src/components/LobbyControls.jsx
import { Button } from "../ui/ui.jsx";

export default function LobbyControls({
  me,
  dealerSeat,
  players = [],
  playerCount = 0,
  readyCount = 0,
  allReady = false,
  onToggleReady,
  onStartRound,
}) {
  const isDealer = !!me && me.seat === dealerSeat;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm opacity-80">Lobby</div>
          <div className="text-sm">
            Players: <b>{playerCount}</b> • Ready: <b>{readyCount}</b>
          </div>
        </div>

        {me ? (
          <div className="text-sm opacity-80">
            You: <b>{me.name}</b> (seat {me.seat}) {me.ready ? "✅" : ""}
          </div>
        ) : (
          <div className="text-sm opacity-80">Not joined yet</div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            // ✅ IMPORTANT: actually call the handler
            onToggleReady?.();
          }}
          disabled={!me}
        >
          {me?.ready ? "Unready" : "Ready"}
        </Button>

        {isDealer ? (
          <Button
            variant="secondary"
            onClick={() => {
              // ✅ IMPORTANT: actually call the handler
              onStartRound?.();
            }}
            disabled={!allReady}
            title={!allReady ? "Need 2+ players and everyone ready" : "Deal & start preplay"}
          >
            Deal
          </Button>
        ) : (
          <div className="text-sm opacity-70 self-center">
            Dealer (seat {dealerSeat}) starts the round
          </div>
        )}
      </div>

      {players?.length ? (
        <div className="mt-4 space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              <div className="truncate">
                <b>{p.name || "Player"}</b> <span className="opacity-70">(seat {p.seat})</span>
                {p.seat === dealerSeat ? <span className="ml-2 opacity-70">🎲 dealer</span> : null}
              </div>
              <div className="opacity-80">{p.ready ? "READY ✅" : "…"}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
