import { useEffect, useMemo, useRef, useState } from "react";

import PublicTable from "./components/PublicTable";
import PlayerHand from "./components/PlayerHand";
import LobbyControls from "./components/LobbyControls";
import PreplayPanel from "./components/PreplayPanel";
import Scoreboard from "./components/Scoreboard";
import GameHeader from "./components/GameHeader";
import SuitModal from "./components/SuitModal";
import SettingsPanel from "./components/SettingsPanel";

import { cardToString } from "./game/cards";
import { countRank, normalizePending, playableCards, normalizeState } from "./game/rules";

import { useGameActions } from "./hooks/useGameActions";
import { useGameRoom } from "./hooks/useGameRoom";
import { useRoundManager } from "./hooks/useRoundManager";

import { Button, Panel, Badge } from "./ui/ui.jsx";
import Toast from "./ui/Toast";

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

  const { setGameRow, state: roomState } = useGameRoom(roomCode);
  const state = normalizeState(roomState);

  const [chooseSuit, setChooseSuit] = useState("S");

  // --- 8 suit chooser modal ---
  const [suitModalOpen, setSuitModalOpen] = useState(false);
  const [suitModalValue, setSuitModalValue] = useState("S");
  const [pendingSuitAction, setPendingSuitAction] = useState(null);

  // --- turn timer tick ---
  const [nowMs, setNowMs] = useState(Date.now());
  const timeoutHandledRef = useRef(null);

  // --- toast ---
  const [toast, setToast] = useState("");
  const lastToastRef = useRef("");

  // --- settings ---
  const [reduceMotion, setReduceMotion] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [bigTap, setBigTap] = useState(false);

  // --- splash (persistent) ---
  const [started, setStarted] = useState(() => {
    return localStorage.getItem("unlucky_sevens_started") === "true";
  });

  // --- mobile dropdown menu ---
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Treat preplay + playing as "in game" for layout purposes
  const inGame = roundStatus === "playing" || roundStatus === "preplay";

  // 🔔 Toast notifications
  useEffect(() => {
    if (!roomCode) return;

    let msg = "";

    if (roundStatus === "playing" && isMyTurn) {
      msg = "✅ Your turn";
    } else if ((pending?.count || 0) > 0) {
      msg = `⚠️ Pending pickup: ${pending.count}${pending.type ? ` (${pending.type})` : ""}`;
    } else if (forcedSuit) {
      msg = `🎴 Forced suit: ${forcedSuit}`;
    }

    if (!msg) return;
    if (lastToastRef.current === msg) return;
    lastToastRef.current = msg;

    setToast(msg);
  }, [roomCode, roundStatus, isMyTurn, pending, forcedSuit]);

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

  const {
    allReady,
    allAliveSevensResolved,
    startRound,
    preplayResolveMySevens,
    beginFirstTurn,
    continueToNextRound,
  } = useRoundManager({
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

  const codeShown = roomCode.toUpperCase();
  const topDisplay = topCard ? cardToString(topCard) : "-";
  const readyCount = players.filter((p) => p.ready).length;

  const winnerName =
    roundResult?.winnerId ? players.find((p) => p.id === roundResult.winnerId)?.name || "Winner" : null;

  const showRoomUI = Boolean(roomCode);

  if (!started) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-3xl">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-8 sm:p-12 shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="text-center">
              <div className="text-5xl sm:text-7xl font-extrabold tracking-tight">Unlucky 7&apos;s</div>
              <div className="mt-3 text-sm sm:text-base text-white/70">Created by the Hulsmans Bros</div>

              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => {
                    localStorage.setItem("unlucky_sevens_started", "true");
                    setStarted(true);
                  }}
                  className="rounded-2xl px-6 py-3 text-base font-semibold border border-emerald-300/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15 transition"
                >
                  Play
                </button>
              </div>

              <div className="mt-6 text-xs text-white/50">
                Tip: Create a room, share the code, and join from another device.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Mobile-only extra bottom padding while in-game (preplay/playing) */}
      <div className={`mx-auto w-full max-w-5xl px-3 sm:px-6 py-4 sm:py-6 ${inGame ? "pb-44 sm:pb-10" : "pb-10"}`}>
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Unlucky Sevens</div>
            <div className="mt-1 text-sm text-white/70">{showRoomUI ? "In room" : "Create or join a room to start"}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge>Players: {players.length}</Badge>
            <Badge>Round: {round}</Badge>
            <Badge>Status: {roundStatus}</Badge>

            <Button variant="secondary" onClick={() => setMenuOpen((v) => !v)} className="sm:ml-2">
              {menuOpen ? "Close Menu" : "Menu"}
            </Button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {menuOpen ? (
          <Panel className="mt-4 p-5">
            <div className="grid gap-4">
              <label className="grid gap-1">
                <span className="text-xs text-white/70">Your name</span>
                <input
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/35 outline-none focus:ring-2 focus:ring-emerald-300/50"
                  placeholder="Trevor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs text-white/70">Room code</span>
                <input
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/35 tracking-[0.25em] uppercase outline-none focus:ring-2 focus:ring-emerald-300/50"
                  placeholder="AB12"
                  value={codeShown}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    actions.createRoom();
                    setMenuOpen(false);
                  }}
                >
                  Create Room
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    actions.joinRoom();
                    setMenuOpen(false);
                  }}
                >
                  Join Room
                </Button>
              </div>

              {statusMsg ? (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {statusMsg}
                </div>
              ) : (
                <div className="text-xs text-white/55">Tip: Create a room, share the code, and your friends join with it.</div>
              )}

              <SettingsPanel
                reduceMotion={reduceMotion}
                setReduceMotion={setReduceMotion}
                soundOn={soundOn}
                setSoundOn={setSoundOn}
                bigTap={bigTap}
                setBigTap={setBigTap}
              />
            </div>
          </Panel>
        ) : null}

        {/* Room UI */}
        {roomCode ? (
          <div className="mt-6 grid gap-4">
            {/* Hide these panels on small screens while in-game */}
            {!inGame ? (
              <Panel className="p-5">
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

                {state.lastEvent ? (
                  <div className="mt-3 text-sm text-white/80">
                    <span className="text-white/60">Event:</span> <span className="font-medium">{state.lastEvent}</span>
                  </div>
                ) : null}
              </Panel>
            ) : (
              <div className="hidden sm:block">
                <Panel className="p-5">
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
                  {state.lastEvent ? (
                    <div className="mt-3 text-sm text-white/80">
                      <span className="text-white/60">Event:</span> <span className="font-medium">{state.lastEvent}</span>
                    </div>
                  ) : null}
                </Panel>
              </div>
            )}

            {!inGame ? (
              <Panel className="p-5">
                <Scoreboard players={players} roundWins={roundWins} />
              </Panel>
            ) : (
              <div className="hidden sm:block">
                <Panel className="p-5">
                  <Scoreboard players={players} roundWins={roundWins} />
                </Panel>
              </div>
            )}

            <PublicTable
              players={players}
              hands={hands}
              turnSeat={turnSeat}
              roundStatus={roundStatus}
              pending={pending}
              topDisplay={topDisplay}
              topCard={topCard}
              forcedSuit={forcedSuit}
              direction={direction}
              dealerSeat={dealerSeat}
              myId={myId}
            />

            {roundStatus === "finished_round" ? (
              <Panel className="p-5">
                <div className="text-sm text-white/80">
                  <span className="font-semibold">Round finished.</span> {winnerName ? `Winner: ${winnerName}` : "It was a draw."}
                </div>
                <div className="mt-3">
                  <Button onClick={continueToNextRound}>Continue / Next Round</Button>
                </div>
              </Panel>
            ) : null}

            {roundStatus === "lobby" ? (
              <LobbyControls
                me={me}
                dealerSeat={dealerSeat}
                allReady={allReady}
                readyCount={readyCount}
                playerCount={players.length}
                onToggleReady={actions.toggleReady}
                onStartRound={startRound}
                players={players}
              />
            ) : null}

            {roundStatus === "preplay" ? (
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
            ) : null}

            {roundStatus === "playing" ? (
              <PlayerHand
                me={me}
                isMyTurn={isMyTurn}
                myHand={myHand}
                myPlayable={myPlayable}
                pending={pending}
                onPlayCard={(c) => actions.playCard(c)}
                onPlayEight={(c) => openSuitModal({ kind: "play8", card: c })}
                onDraw={() => actions.drawCards()}
                reduceMotion={reduceMotion}
                bigTap={bigTap}
              />
            ) : null}

            {roundStatus === "finished_match" ? (
              <Panel className="p-5">
                <div className="text-sm text-white/80">
                  <span className="font-semibold">Match finished!</span> Refresh / create a new room to start a new match.
                </div>
              </Panel>
            ) : null}

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
        ) : null}

        <Toast message={toast} onClose={() => setToast("")} />
      </div>
    </div>
  );
}
