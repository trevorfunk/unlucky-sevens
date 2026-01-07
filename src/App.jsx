// src/App.jsx
import { useEffect, useMemo, useState } from "react";

import PublicTable from "./components/PublicTable";
import PlayerHand from "./components/PlayerHand";
import LobbyControls from "./components/LobbyControls";
import PreplayPanel from "./components/PreplayPanel";
import Scoreboard from "./components/Scoreboard";
import SuitModal from "./components/SuitModal";
import SettingsPanel from "./components/SettingsPanel";

import { normalizePending, playableCards, normalizeState } from "./game/rules";

import { useGameActions } from "./hooks/useGameActions";
import { useGameRoom } from "./hooks/useGameRoom";
import { useRoundManager } from "./hooks/useRoundManager";

import { Button, Badge } from "./ui/ui.jsx";

export default function App() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const {
    gameRow,
    setGameRow,
    state,
    setStateLocal,
    statusMsg,
    setStatusMsg,
    errorMsg,
    clearError,
  } = useGameRoom({ roomCode, setRoomCode });

  const players = Array.isArray(state?.players) ? state.players : [];

  const myId = useMemo(() => {
    let id = localStorage.getItem("unlucky_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("unlucky_id", id);
    }
    return id;
  }, []);

  const me = useMemo(() => players.find((p) => p.id === myId) || null, [players, myId]);
  const mySeat = me?.seat ?? 0;

  const dealerSeat = state?.dealerSeat ?? 0;
  const direction = state?.direction ?? 1;
  const topCard = state?.topCard ?? null;
  const forcedSuit = state?.forcedSuit ?? null;
  const pending = normalizePending(state?.pending);

  // Hands are keyed by SEAT (0..6)
  const hands = normalizeState(state?.hands || {});
  const myHand = Array.isArray(hands[mySeat]) ? hands[mySeat] : [];

  const roundStatus = state?.roundStatus ?? "lobby";
  const turnSeat = state?.turnSeat ?? null;

  // Suit modal
  const [suitModalOpen, setSuitModalOpen] = useState(false);

  function openSuitModal() {
    setSuitModalOpen(true);
  }
  function closeSuitModal() {
    setSuitModalOpen(false);
  }

  const actions = useGameActions({
    name,
    roomCode,
    setRoomCode,
    gameRow,
    setGameRow,
    state,
    setStateLocal,
    me,
    myId,
    mySeat,
    players,
    dealerSeat,
    direction,
    topCard,
    forcedSuit,
    pending,
    myHand,
    setStatusMsg,
  });

  const { preplayResolveMySevens, continueToNextRound, startPlayingAfterPreplay } = useRoundManager({
    state,
    me,
    players,
    dealerSeat,
    actions,
    setStatusMsg,
  });

  const playable = useMemo(() => {
    if (!topCard) return [];
    return playableCards(myHand, topCard, forcedSuit, pending);
  }, [myHand, topCard, forcedSuit, pending]);

  const isMyTurn = !!me && turnSeat === me.seat;

  // Clear status when room changes
  useEffect(() => {
    setStatusMsg("");
  }, [roomCode, setStatusMsg]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold">Unlucky Sevens</div>
            {roomCode ? <Badge>Room {roomCode.toUpperCase()}</Badge> : null}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setSuitModalOpen(true)}>
              Menu
            </Button>
          </div>
        </header>

        {/* errors */}
        {errorMsg ? (
          <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {errorMsg}{" "}
            <button className="ml-2 underline underline-offset-2" onClick={clearError}>
              close
            </button>
          </div>
        ) : null}

        {/* lobby */}
        {roundStatus === "lobby" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-sm opacity-80">Your name</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 outline-none"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Trevor"
                  />
                </div>

                <div>
                  <div className="text-sm opacity-80">Room code</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 uppercase outline-none"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    placeholder="ABCD"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={actions.createRoom}>Create Room</Button>
                <Button variant="secondary" onClick={actions.joinRoom}>
                  Join Room
                </Button>
              </div>
            </div>

            <LobbyControls
              me={me}
              dealerSeat={dealerSeat}
              players={players}
              playerCount={players.length}
              readyCount={players.filter((p) => p.ready).length}
              allReady={players.length >= 2 && players.every((p) => p.ready)}
              onToggleReady={actions.toggleReady}
              onStartRound={actions.beginRound}
            />

            {statusMsg ? (
              <div className="mt-3 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {statusMsg}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* score */}
        <div className="mt-4">
          <Scoreboard players={players} dealerSeat={dealerSeat} turnSeat={turnSeat} />
        </div>

        {/* table */}
        <div className="mt-4">
          <PublicTable
            state={state}
            players={players}
            dealerSeat={dealerSeat}
            direction={direction}
            topCard={topCard}
            forcedSuit={forcedSuit}
            pending={pending}
            turnSeat={turnSeat}
          />
        </div>

        {/* preplay */}
        {roundStatus === "preplay" ? (
          <div className="mt-4">
            <PreplayPanel
              me={me}
              dealerSeat={dealerSeat}
              myHand={myHand}
              onResolveSevens={preplayResolveMySevens}
              onStartPlaying={startPlayingAfterPreplay}
            />
          </div>
        ) : null}

        {/* play */}
        {roundStatus === "playing" ? (
          <div className="mt-4">
            <PlayerHand
              me={me}
              myHand={myHand}
              playable={playable}
              isMyTurn={isMyTurn}
              topCard={topCard}
              forcedSuit={forcedSuit}
              pending={pending}
              onPlay={(card) => {
                if (card?.r === 8) {
                  openSuitModal();
                  setStateLocal((prev) => ({ ...(prev || {}), _pendingEight: card }));
                  return;
                }
                actions.playCard(card);
              }}
              onPickUp={actions.pickUp}
              onPass={actions.passTurn}
            />
          </div>
        ) : null}

        {/* finished round */}
        {roundStatus === "finished_round" ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm opacity-80">Round finished</div>
            <div className="mt-2 flex gap-2">
              <Button onClick={continueToNextRound}>Back to lobby</Button>
            </div>
          </div>
        ) : null}

        <SuitModal
          open={suitModalOpen}
          onClose={closeSuitModal}
          onChoose={(s) => {
            setSuitModalOpen(false);

            const pendingEight = state?._pendingEight;
            if (pendingEight) {
              setStateLocal((prev) => {
                const { _pendingEight, ...rest } = prev || {};
                return rest;
              });
              actions.playCard(pendingEight, s);
            }
          }}
        />

        <SettingsPanel open={false} onClose={() => {}} />
      </div>
    </div>
  );
}
