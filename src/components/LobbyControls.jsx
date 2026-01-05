import { Button, Panel, Badge } from "../ui/ui.jsx";

export default function LobbyControls({
  me,
  dealerSeat,
  allReady,
  readyCount,
  playerCount,
  onToggleReady,
  onStartRound,
}) {
  const isDealer = Boolean(me) && me.seat === dealerSeat;
  const canStart = Boolean(me) && isDealer && allReady;

  return (
    <Panel className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: status */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Lobby</Badge>
            <Badge>
              Ready: {readyCount}/{playerCount}
            </Badge>
            <Badge>Min 2 players</Badge>
            <Badge>All must be ready</Badge>
          </div>

          <div className="text-sm text-white/75">
            {isDealer ? (
              <span>
                You are the <span className="font-semibold text-white">dealer</span>. Start when everyone is ready.
              </span>
            ) : (
              <span>
                Waiting for the dealer (seat <span className="font-semibold text-white">{dealerSeat}</span>) to start.
              </span>
            )}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={onToggleReady} variant={me?.ready ? "secondary" : "primary"}>
            {me?.ready ? "Unready" : "Ready"}
          </Button>

          <Button onClick={onStartRound} disabled={!canStart} variant="primary">
            Deal / Start Round
          </Button>
        </div>
      </div>

      {/* Small hint row */}
      <div className="mt-4 text-xs text-white/55">
        {canStart ? "Everyone is ready — go for it." : "Tip: only the dealer can start, and all players must be ready."}
      </div>
    </Panel>
  );
}
