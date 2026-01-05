import { useEffect, useMemo, useRef, useState } from "react";
import { nextAliveSeat } from "./game/seat";

import PublicTable from "./components/PublicTable";
import PlayerHand from "./components/PlayerHand";
import LobbyControls from "./components/LobbyControls";
import PreplayPanel from "./components/PreplayPanel";
import Scoreboard from "./components/Scoreboard";
import GameHeader from "./components/GameHeader";

import { makeDeck, shuffle, cardToString, suitLabel } from "./game/cards";
import { countRank, canCoverSevens, resolveAllSevensManual, normalizePending, playableCards, normalizeState } from "./game/rules";

import { useGameActions } from "./hooks/useGameActions";
import { useGameRoom } from "./hooks/useGameRoom";

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

  /* =========================
     Remaining round logic (still in App for now)
     ========================= */

  const allReady = players.length >= 2 && players.every((p) => p.ready);

  function computeNextDealer(winnerSeatOrNull) {
    const seats = players.map((p) => p.seat).sort((a, b) => a - b);
    const dIdx = seats.indexOf(dealerSeat);
    let nextDealer = seats[(dIdx + 1) % seats.length];

    if (winnerSeatOrNull != null && nextDealer === winnerSeatOrNull) {
      nextDealer = seats[(dIdx + 2) % seats.length];
    }
    return nextDealer;
  }

  async function finishRoundWithWinner(winnerPlayer, reason) {
    const newWins = { ...roundWins };
    newWins[winnerPlayer.id] = (newWins[winnerPlayer.id] || 0) + 1;

    const matchWinner = Object.entries(newWins).find(([, w]) => w >= 7);
    const nextDealerSeat = computeNextDealer(winnerPlayer.seat);

    await actions.saveState({
      roundWins: newWins,
      roundStatus: matchWinner ? "finished_match" : "finished_round",
      turnSeat: null,
      firstTurnSeat: null,
      turnStartedAt: null,
      roundResult: { winnerId: winnerPlayer.id, reason, nextDealerSeat },
      lastEvent: matchWinner
        ? `${winnerPlayer.name} won the MATCH (7 rounds)!`
        : `${winnerPlayer.name} won the ROUND (${reason}).`,
    });
  }

  async function finishRoundDraw(reason) {
    const nextDealerSeat = computeNextDealer(null);
    await actions.saveState({
      roundStatus: "finished_round",
      turnSeat: null,
      firstTurnSeat: null,
      turnStartedAt: null,
      roundResult: { winnerId: null, reason, nextDealerSeat },
      lastEvent: `Round draw (${reason}).`,
    });
  }

  async function startRound() {
    setStatusMsg("");
    if (players.length < 2) return setStatusMsg("Need at least 2 players.");
    if (!allReady) return setStatusMsg("Everyone must be ready.");
    if (!me || me.seat !== dealerSeat) return setStatusMsg("Only the dealer can start the round.");

    let d = shuffle(makeDeck());
    const h = {};
    let disc = [];
    let top = null;

    const seatOrder = players.slice().sort((a, b) => a.seat - b.seat);
    for (const p of seatOrder) h[p.seat] = d.splice(0, 7);

    top = d.shift();
    disc = [top];

    let forced = null;
    let dir = 1;
    let pend = { count: 0, type: null };

    const nextPlayers = players.map((p) => ({ ...p, alive: true, ready: false }));
    for (const p of nextPlayers) {
      if (!canCoverSevens(h[p.seat])) p.alive = false;
    }

    const alive = nextPlayers.filter((p) => p.alive);

    if (alive.length === 0) {
      await actions.saveState({
        round: round + 1,
        roundStatus: "finished_round",
        players: nextPlayers,
        hands: h,
        deck: d,
        discard: disc,
        topCard: top,
        forcedSuit: forced,
        pending: pend,
        direction: dir,
        turnSeat: null,
        firstTurnSeat: null,
        turnStartedAt: null,
        turnSeconds: turnSeconds,
        roundResult: { winnerId: null, reason: "draw_all_eliminated_on_deal", nextDealerSeat: computeNextDealer(null) },
        lastEvent: "Round draw (everyone eliminated on deal). Dealer rotates.",
      });
      return;
    }

    if (alive.length === 1) {
      await actions.saveState({
        round: round + 1,
        players: nextPlayers,
        hands: h,
        deck: d,
        discard: disc,
        topCard: top,
        forcedSuit: forced,
        pending: pend,
        direction: dir,
        turnSeat: null,
        firstTurnSeat: null,
        turnStartedAt: null,
        turnSeconds: turnSeconds,
        roundStatus: "playing",
        roundResult: null,
        lastEvent: `Only ${alive[0].name} survived the deal.`,
      });
      await finishRoundWithWinner(alive[0], "last_alive_after_deal");
      return;
    }

    const aliveSeatList = alive.map((p) => p.seat).sort((a, b) => a - b);
    const dealerIdx = aliveSeatList.indexOf(dealerSeat);
    const afterDealer = dealerIdx === -1 ? aliveSeatList[0] : aliveSeatList[(dealerIdx + 1) % aliveSeatList.length];

    if (top.r === 4) {
      dir = -1;
      const newDealer = afterDealer;
      const idx2 = aliveSeatList.indexOf(newDealer);
      const computedFirst = idx2 === -1 ? aliveSeatList[0] : aliveSeatList[(idx2 + 1) % aliveSeatList.length];

      await actions.saveState({
        round: round + 1,
        roundStatus: "preplay",
        players: nextPlayers,
        hands: h,
        deck: d,
        discard: disc,
        topCard: top,
        forcedSuit: forced,
        pending: pend,
        direction: dir,
        dealerSeat: newDealer,
        turnSeat: null,
        firstTurnSeat: computedFirst,
        turnStartedAt: null,
        turnSeconds: turnSeconds,
        roundResult: null,
        lastEvent: `Round ${round + 1} setup. Face-up ${cardToString(top)} reversed. Pre-round phase.`,
      });
      return;
    }

    if (top.r === 12 && top.s === "S") {
      pend = { count: 4, type: "qs" };
    }

    await actions.saveState({
      round: round + 1,
      roundStatus: "preplay",
      players: nextPlayers,
      hands: h,
      deck: d,
      discard: disc,
      topCard: top,
      forcedSuit: forced,
      pending: pend,
      direction: dir,
      turnSeat: null,
      firstTurnSeat: afterDealer,
      turnStartedAt: null,
      turnSeconds: turnSeconds,
      roundResult: null,
      lastEvent: `Round ${round + 1} setup. Face-up ${cardToString(top)}. Pre-round phase.`,
    });
  }

  const allAliveSevensResolved = useMemo(() => {
    const alive = players.filter((p) => p.alive);
    if (alive.length === 0) return true;
    for (const p of alive) {
      const hand = Array.isArray(hands[p.seat]) ? hands[p.seat] : [];
      if (countRank(hand, 7) > 0) return false;
    }
    return true;
  }, [players, hands]);

  async function preplayResolveMySevens(suitOverride = null) {
    setStatusMsg("");
    if (roundStatus !== "preplay") return setStatusMsg("Not in pre-round phase.");
    if (!me?.alive) return setStatusMsg("You are OUT this round.");
    if (mySevens === 0) return setStatusMsg("You have no sevens to resolve.");

    const res = resolveAllSevensManual([...myHand]);
    if (!res.ok) return setStatusMsg(res.reason || "Cannot resolve sevens.");

    const suit = suitOverride || chooseSuit;

    let newDiscard = [...discard];
    for (let i = 0; i < res.sevensResolved; i++) {
      newDiscard.push({ r: 7, s: "S" });
      newDiscard.push({ r: 8, s: suit });
    }
    const newTop = newDiscard[newDiscard.length - 1];

    await actions.saveState({
      hands: { ...hands, [mySeat]: res.hand },
      discard: newDiscard,
      topCard: newTop,
      forcedSuit: suit,
      pending: { count: 0, type: null },
      lastEvent: `${me.name} resolved ${res.sevensResolved} seven(s) with 8(s). Suit is now ${suitLabel(suit)}.`,
    });
  }

  async function beginFirstTurn() {
    setStatusMsg("");
    if (roundStatus !== "preplay") return setStatusMsg("Not in pre-round phase.");
    if (!me || me.seat !== dealerSeat) return setStatusMsg("Only the dealer can begin the first turn.");
    if (!allAliveSevensResolved) return setStatusMsg("All alive players must resolve their sevens first.");

    let first = firstTurnSeat;

    if (topCard?.r === 11) {
      first = nextAliveSeat(first, direction, 0, aliveSeats);
    }

    await actions.saveState({
      roundStatus: "playing",
      turnSeat: first,
      turnStartedAt: new Date().toISOString(),
      lastEvent: `First turn begins. Seat ${first}'s turn.`,
    });
  }

  async function continueToNextRound() {
    setStatusMsg("");
    if (roundStatus !== "finished_round") return setStatusMsg("Round is not finished.");

    const nextDealerSeat = roundResult?.nextDealerSeat ?? computeNextDealer(null);

    const resetPlayers = players.map((p) => ({
      ...p,
      alive: true,
      ready: false,
    }));

    await actions.saveState({
      roundStatus: "lobby",
      players: resetPlayers,
      hands: Object.fromEntries(resetPlayers.map((p) => [p.seat, []])),
      deck: [],
      discard: [],
      topCard: null,
      forcedSuit: null,
      pending: { count: 0, type: null },
      direction: 1,
      turnSeat: null,
      firstTurnSeat: null,
      dealerSeat: nextDealerSeat,
      roundResult: null,
      turnStartedAt: null,
      turnSeconds: turnSeconds,
      lastEvent: `Back to lobby. Next dealer is seat ${nextDealerSeat}.`,
    });
  }

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
          {suitModalOpen && (
            <div
              onClick={closeSuitModal}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 9999,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(420px, 100%)",
                  background: "white",
                  borderRadius: 16,
                  border: "1px solid #eee",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 18 }}>Choose a suit</div>
                    <div style={{ opacity: 0.75, marginTop: 4, fontSize: 13 }}>
                      Your 8 sets the forced suit for the next play.
                    </div>
                  </div>
                  <button
                    onClick={closeSuitModal}
                    style={{ padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd" }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 14 }}>
                  {["S", "H", "D", "C"].map((s) => {
                    const active = suitModalValue === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setSuitModalValue(s)}
                        style={{
                          padding: "14px 10px",
                          borderRadius: 14,
                          border: active ? "2px solid #111" : "1px solid #ddd",
                          background: active ? "#f3f3f3" : "white",
                          fontWeight: 900,
                          fontSize: 20,
                          cursor: "pointer",
                        }}
                        title={s}
                      >
                        {suitLabel(s)}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
                  <button
                    onClick={closeSuitModal}
                    style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "white" }}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={async () => {
                      const suit = suitModalValue;
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
                        return;
                      }
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #111",
                      background: "#111",
                      color: "white",
                      fontWeight: 800,
                    }}
                  >
                    Confirm {suitLabel(suitModalValue)}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
