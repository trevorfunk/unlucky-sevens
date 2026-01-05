import { useEffect, useMemo, useRef, useState } from "react";
import PublicTable from "./components/PublicTable";
import PlayerHand from "./components/PlayerHand";
import LobbyControls from "./components/LobbyControls";
import PreplayPanel from "./components/PreplayPanel";
import Scoreboard from "./components/Scoreboard";
import GameHeader from "./components/GameHeader";
import SuitModal from "./components/SuitModal";

import { cardToString } from "./game/cards";
import { countRank, normalizePending, playableCards, normalizeState } from "./game/rules";

import { useGameActions } from "./hooks/useGameActions";
import { useGameRoom } from "./hooks/useGameRoom";
import { useRoundManager } from "./hooks/useRoundManager";

/* =========================
   App
   ========================= */

export default function App() {
  const TURN_SECONDS = 20;

  const myId = useMemo(() => {
    const k = "unlucky_sevens_pid";
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  }, []);

  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const { gameRow, setGameRow, state: roomState } = useGameRoom(roomCode);
  const state = normalizeState(roomState);

  const [chooseSuit, setChooseSuit] = useState("S");

  // --- 8 suit chooser modal ---
  const [suitModalOpen, setSuitModalOpen] = useState(false);
  const [suitModalValue, setSuitModalValue] = useState("S");
  const [pendingSuitAction, setPendingSuitAction] = useState(null);

  // --- turn timer tick ---
  const [nowMs, setNowMs] = useState(Date.now());
  const timeoutHandledRef = useRef(null);

  // Derived values
  const players = Array.isArray(state.players) ? state.players : [];
  const me = players.find((p) => p.id === myId) || null;
  const mySeat = me?.seat ?? null;

  const hands = state.hands || {};
  const myHand = Array.isArray(hands[mySeat]) ? hands[mySeat] : [];

  const roundWins = state.roundWins || {};
  const round = state.round ?? 0;

  const roundStatus = state.roundStatus ?? "lobby";

  const dealerSeat = state.dealerSeat ?? 0;
  const turnSeat = state.turnSeat ?? null;
  const direction = state.direction ?? 1;

  const topCard = state.topCard ?? null;
  const forcedSuit = state.forcedSuit ?? null;

  const deck = Array.isArray(state.deck) ? state.deck : [];
  const discard = Array.isArray(state.discard) ? state.discard : [];

  const pending = normalizePending(state.pending);

  const roundResult = state.roundResult ?? null;
  const firstTurnSeat = state.firstTurnSeat ?? null;

  const aliveSeats = players
    .filter((p) => p.alive)
    .map((p) => p.seat)
    .sort((a, b) => a - b);

  const isMyTurn = mySeat !== null && turnSeat === mySeat && me?.alive;

  const myPlayable = useMemo(() => {
    return playableCards(myHand, topCard, forcedSuit, pending);
  }, [myHand, topCard, forcedSuit, pending]);

  const mySevens = countRank(myHand, 7);

  // Timer values from state (with defaults)
  const turnSeconds = Number(state.turnSeconds || TURN_SECONDS);
  const turnStartedAtMs = state.turnStartedAt ? Date.parse(state.turnStartedAt) : null;

  useEffect(() => {
    if (roundStatus !== "playing") return;
    const t = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [roundStatus]);

  const remainingSec = useMemo(() => {
    if (roundStatus !== "playing") return null;
    if (!turnStartedAtMs) return null;
    const elapsed = (nowMs - turnStartedAtMs) / 1000;
    return Math.max(0, Math.ceil(turnSeconds - elapsed));
  }, [roundStatus, turnStartedAtMs, nowMs, turnSeconds]);

  // ✅ NOW we can build actions (after derived values exist)
  const actions = useGameActions({
    roomCode,
    myId,
    name,
    state,
    setStatusMsg,
    setRoomCode,
    setGameRow,
    TURN_SECONDS,

    players,
    me,
    mySeat,
    myHand,
    myPlayable,
    hands,
    deck,
    discard,
    topCard,
    forcedSuit,
    pending,
    roundStatus,
    dealerSeat,
    turnSeat,
    direction,
    aliveSeats,
    round,
    roundWins,
    turnSeconds,
    chooseSuit,
  });

  function openSuitModal(action) {
    setPendingSuitAction(action);
    setSuitModalValue(chooseSuit || "S");
    setSuitModalOpen(true);
  }

  function closeSuitModal() {
    setSuitModalOpen(false);
    setPendingSuitAction(null);
  }

  const { allReady, allAliveSevensResolved, startRound, preplayResolveMySevens, beginFirstTurn, continueToNextRound } =
    useRoundManager({
      players,
      me,
      mySeat,
      myHand,
      mySevens,
      hands,
      roundWins,
      round,
      roundStatus,
      dealerSeat,
      turnSeconds,
      firstTurnSeat,
      topCard,
      discard,
      chooseSuit,
      direction,
      aliveSeats,
      roundResult,
      actions,
      setStatusMsg,
    });

  // Trigger timeout when it hits 0
  useEffect(() => {
    if (roundStatus !== "playing") return;
    if (!isMyTurn) return;
    if (!state.turnStartedAt) return;
    if (remainingSec === null) return;

    if (remainingSec <= 0) {
      if (timeoutHandledRef.current === state.turnStartedAt) return;
      timeoutHandledRef.current = state.turnStartedAt;
      actions.timeoutPickupAndPass();
    }
  }, [roundStatus, isMyTurn, remainingSec, state.turnStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* =========================
     UI
     ========================= */

  const codeShown = roomCode.toUpperCase();
  const topDisplay = topCard ? cardToString(topCard) : "-";
  const readyCount = players.filter((p) => p.ready).length;

  const winnerName =
    roundResult?.winnerId ? players.find((p) => p.id === roundResult.winnerId)?.name || "Winner" : null;

  return (
    <div style={{ maxWidth: 900, margin: "24px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Unlucky Sevens</h1>

      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 10 }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={actions.createRoom} style={{ padding: 10 }}>
            Create Room
          </button>

          <input
            placeholder="Room code"
            value={codeShown}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            style={{ padding: 10, letterSpacing: 2 }}
          />

          <button onClick={actions.joinRoom} style={{ padding: 10 }}>
            Join Room
          </button>
        </div>

        {statusMsg && <div style={{ color: "crimson" }}>{statusMsg}</div>}
      </div>

      {roomCode && (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <GameHeader
            codeShown={codeShown}
            me={me}
            round={round}
            roundStatus={roundStatus}
            remainingSec={remainingSec}
            dealerSeat={dealerSeat}
            turnSeat={turnSeat}
            isMyTurn={isMyTurn}
            direction={direction}
            pending={pending}
            topDisplay={topDisplay}
            forcedSuit={forcedSuit}
            deckCount={deck.length}
            discardCount={discard.length}
          />

          {state.lastEvent && (
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              <b>Event:</b> {state.lastEvent}
            </div>
          )}

          <Scoreboard players={players} roundWins={roundWins} />

          <PublicTable
            players={players}
            hands={hands}
            turnSeat={turnSeat}
            roundStatus={roundStatus}
            pending={pending}
            topDisplay={topDisplay}
            forcedSuit={forcedSuit}
            direction={direction}
            dealerSeat={dealerSeat}
            myId={myId}
          />

          <hr style={{ margin: "14px 0" }} />

          {roundStatus === "finished_round" && (
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <b>Round finished.</b> {winnerName ? `Winner: ${winnerName}` : "It was a draw."}
              </div>
              <button onClick={continueToNextRound} style={{ padding: 10 }}>
                Continue / Next Round
              </button>
            </div>
          )}

          {roundStatus === "lobby" && (
            <LobbyControls
              me={me}
              dealerSeat={dealerSeat}
              allReady={allReady}
              readyCount={readyCount}
              playerCount={players.length}
              onToggleReady={actions.toggleReady}
              onStartRound={startRound}
            />
          )}

          {roundStatus === "preplay" && (
            <PreplayPanel
              me={me}
              myHand={myHand}
              mySeat={mySeat}
              mySevens={mySevens}
              allAliveSevensResolved={allAliveSevensResolved}
              dealerSeat={dealerSeat}
              onOpenSuitModalForSevens={() => openSuitModal({ kind: "preplaySevens" })}
              onBeginFirstTurn={beginFirstTurn}
            />
          )}

          {roundStatus === "playing" && (
            <div>
              <hr style={{ margin: "14px 0" }} />
              <PlayerHand
                me={me}
                isMyTurn={isMyTurn}
                myHand={myHand}
                myPlayable={myPlayable}
                pending={pending}
                onPlayCard={(c) => actions.playCard(c)}
                onPlayEight={(c) => openSuitModal({ kind: "play8", card: c })}
                onDraw={() => actions.drawCards()}
              />
            </div>
          )}

          {roundStatus === "finished_match" && (
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
              <b>Match finished!</b> Refresh / create a new room to start a new match.
            </div>
          )}

          {/* --- Suit chooser modal --- */}
          <SuitModal
            open={suitModalOpen}
            value={suitModalValue}
            onChange={setSuitModalValue}
            onClose={closeSuitModal}
            onConfirm={async (suit) => {
              setChooseSuit(suit);

              const action = pendingSuitAction;
              closeSuitModal();

              if (!action) return;

              if (action.kind === "play8") {
                await actions.playCard(action.card, suit);
                return;
              }

              if (action.kind === "preplaySevens") {
                await preplayResolveMySevens(suit);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
