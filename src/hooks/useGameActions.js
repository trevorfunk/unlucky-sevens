// src/hooks/useGameActions.js
import { supabase } from "../supabase";
import { nextAliveSeat } from "../game/seat";
import { makeDeck, shuffle, cardToString, suitLabel } from "../game/cards";
import {
  normalizeState,
  normalizePending,
  countRank,
  playableCards,
  resolveAllSevensManual,
  canCoverSevens,
} from "../game/rules";
import { makeId } from "../game/makeId";


function reshuffleIfNeeded(currDeck, currDiscard, currTop) {
  if (currDeck.length > 0) return { deck: currDeck, discard: currDiscard, topCard: currTop };
  const reshuffle = currDiscard.filter((c) => !(c.r === currTop.r && c.s === currTop.s));
  if (reshuffle.length === 0) return { deck: [], discard: currDiscard, topCard: currTop };
  const newDeck = shuffle([...reshuffle]);
  const newDiscard = currTop ? [currTop] : [];
  return { deck: newDeck, discard: newDiscard, topCard: currTop };
}

export function useGameActions({
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
}) {
  const code = roomCode?.trim()?.toUpperCase?.() || "";

  async function refreshRow() {
    const { data, error } = await supabase.from("games").select("*").eq("code", code).single();
    if (error) return null;
    return data;
  }

  async function saveState(nextState) {
    const { data, error } = await supabase
      .from("games")
      .update({ state: nextState })
      .eq("code", code)
      .select("*")
      .single();
  
    if (error) {
      setStatusMsg?.(error.message || "Failed to save game state.");
      return null;
    }
  
    setGameRow?.(data);
    return data;
  }
  

  function requireMe() {
    if (!me) {
      setStatusMsg?.("Join first.");
      return false;
    }
    return true;
  }

  async function toggleReady() {
    setStatusMsg("");
    if (!code) return setStatusMsg("No room code.");
    if (!requireMe()) return;

    const nextPlayers = players.map((p) =>
      p.id === me.id ? { ...p, ready: !p.ready } : p
    );

    const next = { ...state, players: nextPlayers, lastEvent: `${me.name} is ${!me.ready ? "READY" : "not ready"}.` };
    await saveState(next);
  }

  async function createRoom() {
    setStatusMsg("");
    const playerName = name.trim();
    if (!playerName) return setStatusMsg("Enter a name.");

    // Generate 4-letter code
    const gen = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let s = "";
      for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };

    let tries = 0;
    while (tries++ < 5) {
      const newCode = gen();
      const initialState = {
        round: 0,
        roundStatus: "lobby",
        players: [
          {
            id: myId,
            name: playerName,
            seat: 0,
            ready: false,
            alive: true,
            roundsWon: 0,
          },
        ],
        hands: {},
        deck: [],
        discard: [],
        topCard: null,
        forcedSuit: null,
        direction: 1,
        dealerSeat: 0,
        pending: { count: 0, type: null },
        turnSeat: null,
        firstTurnSeat: null,
        turnStartedAt: null,
        roundResult: null,
        lastEvent: "Room created.",
      };

      const { data, error } = await supabase
        .from("games")
        .insert({ code: newCode, state: initialState })
        .select("*")
        .single();

      if (!error && data) {
        setRoomCode(newCode);
        setGameRow(data);
        return;
      }
    }

    setStatusMsg("Could not create a room. Try again.");
  }

  async function joinRoom() {
    setStatusMsg("");
    const playerName = name.trim();
    if (!playerName || !code) return setStatusMsg("Enter name + room code.");

    const { data: existing, error } = await supabase.from("games").select("*").eq("code", code).single();
    if (error || !existing) return setStatusMsg("Room not found.");

    const st = normalizeState(existing.state);
    const pls = Array.isArray(st.players) ? st.players : [];

    if (pls.some((p) => p.id === myId)) {
      setGameRow(existing);
      return;
    }

    if (pls.length >= 7) return setStatusMsg("Room full (max 7).");

    const used = new Set(pls.map((p) => p.seat));
    let seat = 0;
    while (used.has(seat) && seat < 7) seat++;

    const newPlayer = {
      id: myId,
      name: playerName,
      seat,
      ready: false,
      alive: true,
      roundsWon: 0,
    };

    const next = { ...st, players: [...pls, newPlayer], lastEvent: `${playerName} joined.` };

    const { data, error: upErr } = await supabase
      .from("games")
      .update({ state: next })
      .eq("code", code)
      .select("*")
      .single();

    if (upErr) return setStatusMsg(upErr.message || "Join failed.");
    setGameRow(data);
  }

  async function finishRoundWithWinner(winnerPlayer, reason, patch = {}) {
    const nextDealerSeat = nextAliveSeat(dealerSeat, direction, 0, players.filter((p) => p.alive).map((p) => p.seat));

    const nextPlayers = players.map((p) => {
      if (p.id === winnerPlayer.id) return { ...p, roundsWon: (p.roundsWon || 0) + 1 };
      return p;
    });

    const matchWinner = nextPlayers.find((p) => (p.roundsWon || 0) >= 7);

    await saveState({
      ...state,
      ...patch,
      players: nextPlayers,
      roundStatus: matchWinner ? "finished_match" : "finished_round",
      turnSeat: null,
      firstTurnSeat: null,
      turnStartedAt: null,
      pending: { count: 0, type: null },
      roundResult: { winnerId: winnerPlayer.id, reason, nextDealerSeat },
      lastEvent: matchWinner
        ? `${winnerPlayer.name} won the MATCH (7 rounds)!`
        : `${winnerPlayer.name} won the ROUND (${reason}).`,
    });
  }

  // ✅ FIXED: beginRound now SAVES hands into state
// ✅ FIXED: beginRound uses latest row state, safe room code, and string seat keys
async function beginRound() {
  setStatusMsg("");

  if (!code) return setStatusMsg("No room code.");
  if (!me) return setStatusMsg("Join first.");

  // Always refresh before dealing (prevents stale state issues)
  const latest = await refreshRow();
  if (!latest) return setStatusMsg("Could not refresh room state.");

  const latestState = normalizeState(latest.state);
  const latestPlayers = Array.isArray(latestState.players) ? latestState.players : [];
  const latestDealerSeat = latestState?.dealerSeat ?? dealerSeat;

  const latestMe = latestPlayers.find((p) => p.id === myId) || me;

  const isDealer = latestMe.seat === latestDealerSeat;
  if (!isDealer) return setStatusMsg("Only the dealer can start the round.");

  if (latestPlayers.length < 2) return setStatusMsg("Need at least 2 players.");
  if (!latestPlayers.every((p) => p.ready)) return setStatusMsg("All players must be ready.");

  // Determine dealer for this round (use roundResult.nextDealerSeat if present)
  const nextDealerSeat = latestState?.roundResult?.nextDealerSeat ?? latestDealerSeat;

  // Reset players for the new round
  const nextPlayers = latestPlayers.map((p) => ({
    ...p,
    alive: true,
    ready: false,
  }));

  // Fresh deck
  let d = shuffle(makeDeck());

  // Deal cards: 7 cards for 2 players, otherwise 5
  const handSize = nextPlayers.length === 2 ? 7 : 5;
  const nextHands = {};
  for (const p of nextPlayers) {
    nextHands[String(p.seat)] = d.splice(0, handSize);
  }

  // Flip a starting top card
  const top = d.shift() || null;
  const nextDiscard = top ? [top] : [];

  // If any player cannot cover their sevens, they are out for the round
  const adjustedPlayers = nextPlayers.map((p) => {
    const h = nextHands[String(p.seat)] || [];
    if (!canCoverSevens(h)) return { ...p, alive: false };
    return p;
  });

  // Clear hands for players who are OUT this round
  const adjustedHands = {};
  for (const p of adjustedPlayers) {
    adjustedHands[String(p.seat)] = p.alive ? (nextHands[String(p.seat)] || []) : [];
  }

  const nextRound = (latestState?.round ?? 0) + 1;

  await saveState({
    ...latestState,
    round: nextRound,
    roundStatus: "preplay",
    players: adjustedPlayers,
    hands: adjustedHands,
    dealerSeat: nextDealerSeat,
    direction: 1,
    deck: d,
    discard: nextDiscard,
    topCard: top,
    forcedSuit: null,
    pending: { count: 0, type: null },
    turnSeat: null,
    firstTurnSeat: null,
    turnStartedAt: null,
    roundResult: null,
    lastEvent: `Round ${nextRound} dealt. Resolve sevens, then dealer starts.`,
  });
}


  async function preplayResolveMySevens() {
    setStatusMsg("");
    if (!code) return setStatusMsg("No room code.");
    if (!requireMe()) return;

    if (state?.roundStatus !== "preplay") return setStatusMsg("Not in preplay.");

    const sevens = countRank(myHand, 7);
    if (sevens === 0) return setStatusMsg("You have no 7s to resolve.");

    const res = resolveAllSevensManual(myHand);
    if (!res.ok) return setStatusMsg(res.reason);

    const nextHands = { ...(state?.hands || {}) };
    nextHands[mySeat] = res.hand;

    const next = {
      ...state,
      hands: nextHands,
      lastEvent: `${me.name} resolved ${res.sevensResolved} seven(s).`,
    };

    await saveState(next);
  }

  async function continueToNextRound() {
    setStatusMsg("");
    if (!code) return setStatusMsg("No room code.");
    if (!requireMe()) return;

    if (state?.roundStatus !== "finished_round") return setStatusMsg("Round not finished.");

    await saveState({
      ...state,
      roundStatus: "lobby",
      pending: { count: 0, type: null },
      forcedSuit: null,
      turnSeat: null,
      firstTurnSeat: null,
      turnStartedAt: null,
      deck: [],
      discard: [],
      topCard: null,
      hands: {},
      lastEvent: "Back to lobby. Ready up for next round.",
    });
  }

  async function playCard(card, suitOverride = null) {
    setStatusMsg("");
    if (!code) return setStatusMsg("No room code.");
    if (!requireMe()) return;

    if (state?.roundStatus !== "playing" && state?.roundStatus !== "preplay") {
      return setStatusMsg("Round not active.");
    }

    if (state?.roundStatus === "preplay") {
      return setStatusMsg("Resolve sevens first.");
    }

    const pending = normalizePending(state?.pending);
    if ((pending?.count || 0) > 0 && card.r === 8) {
      return setStatusMsg(`You cannot play an 8 to defend. Defend with 2/Q♠ or pick up ${pending.count}.`);
    }

    const hand = [...myHand];
    const idx = hand.findIndex((c) => c.r === card.r && c.s === card.s);
    if (idx === -1) return setStatusMsg("That card is not in your hand.");

    const plays = playableCards(hand, topCard, forcedSuit, pending);
    const ok = plays.some((c) => c.r === card.r && c.s === card.s);
    if (!ok) return setStatusMsg("That card is not playable.");

    hand.splice(idx, 1);

    // discard
    const newDiscard = [...(state?.discard || [])];
    newDiscard.push(card);

    // pending logic
    let newPending = pending;
    let newForced = forcedSuit;
    let newDir = direction;
    let skipNext = 0;
    let extraTurn = false;

    const aliveSeats = players.filter((p) => p.alive).map((p) => p.seat);

    if (pending?.count > 0) {
      if (card.r === 2) newPending = { count: pending.count + 2, type: "two" };
      else if (card.r === 12 && card.s === "S") newPending = { count: pending.count + 4, type: "qs" };
      else return setStatusMsg("You must defend with 2/Q♠ or pick up.");
    } else {
      newPending = { count: 0, type: null };
      newForced = null;

      if (card.r === 2) newPending = { count: 2, type: "two" };
      if (card.r === 11) {
        newDir = direction === 1 ? -1 : 1;
      }
      if (card.r === 1) {
        // Ace: skip one, unless only 2 alive -> extra turn
        const aliveCount = aliveSeats.length;
        if (aliveCount === 2) extraTurn = true;
        else skipNext = 1;
      }

      if (card.r === 12 && card.s === "S") newPending = { count: 4, type: "qs" };
      if (card.r === 8) newForced = suitOverride;
    }

    let nextTurn = state?.turnSeat;
    if (!extraTurn) nextTurn = nextAliveSeat(state?.turnSeat, newDir, skipNext, aliveSeats);

    const hands = normalizeState(state?.hands || {});
    const nextHands = { ...hands, [mySeat]: hand };

    // win?
    if (hand.length === 0) {
      const winnerPlayer = me;
      await finishRoundWithWinner(winnerPlayer, "emptied hand", {
        hands: nextHands,
        discard: newDiscard,
        topCard: card,
        forcedSuit: newForced,
        pending: newPending,
        direction: newDir,
      });
      return;
    }

    await saveState({
      ...state,
      hands: nextHands,
      discard: newDiscard,
      topCard: card,
      forcedSuit: newForced,
      pending: newPending,
      direction: newDir,
      turnSeat: nextTurn,
      lastEvent: `${me.name} played ${cardToString(card)}${card.r === 8 ? ` (${suitLabel(suitOverride)})` : ""}.`,
    });
  }

  async function pickUp() {
    setStatusMsg("");
    if (!code) return setStatusMsg("No room code.");
    if (!requireMe()) return;

    if (state?.roundStatus !== "playing") return setStatusMsg("Not playing.");

    const pending = normalizePending(state?.pending);
    const pickCount = pending?.count > 0 ? pending.count : 1;

    let deck = [...(state?.deck || [])];
    let discard = [...(state?.discard || [])];
    const top = state?.topCard;

    const fixed = reshuffleIfNeeded(deck, discard, top);
    deck = fixed.deck;
    discard = fixed.discard;

    const drawn = [];
    for (let i = 0; i < pickCount; i++) {
      if (deck.length === 0) break;
      drawn.push(deck.shift());
    }

    const hands = normalizeState(state?.hands || {});
    const nextHands = { ...hands };
    nextHands[mySeat] = [...myHand, ...drawn];

    const aliveSeats = players.filter((p) => p.alive).map((p) => p.seat);
    const nextTurn = nextAliveSeat(state?.turnSeat, direction, 0, aliveSeats);

    await saveState({
      ...state,
      deck,
      discard,
      hands: nextHands,
      pending: { count: 0, type: null },
      forcedSuit: null,
      turnSeat: nextTurn,
      lastEvent: `${me.name} picked up ${drawn.length}${pending?.count > 0 ? ` (penalty cleared)` : ""}.`,
    });
  }

  async function passTurn() {
    setStatusMsg("");
    if (!code) return setStatusMsg("No room code.");
    if (!requireMe()) return;

    if (state?.roundStatus !== "playing") return setStatusMsg("Not playing.");

    const pending = normalizePending(state?.pending);
    if (pending?.count > 0) return setStatusMsg(`You must defend or pick up ${pending.count}.`);

    const aliveSeats = players.filter((p) => p.alive).map((p) => p.seat);
    const nextTurn = nextAliveSeat(state?.turnSeat, direction, 0, aliveSeats);

    await saveState({
      ...state,
      forcedSuit: null,
      turnSeat: nextTurn,
      lastEvent: `${me.name} passed.`,
    });
  }

  async function startPlayingAfterPreplay() {
    setStatusMsg("");
    if (!code) return setStatusMsg("No room code.");
    if (!requireMe()) return;
  
    // Refresh first to avoid stale players/alive flags
    const latest = await refreshRow();
    if (!latest) return setStatusMsg("Could not refresh room state.");
  
    const latestState = normalizeState(latest.state);
    if (latestState?.roundStatus !== "preplay") return setStatusMsg("Not in preplay.");
  
    const latestPlayers = Array.isArray(latestState.players) ? latestState.players : [];
    const latestDealerSeat = latestState?.dealerSeat ?? dealerSeat;
  
    // Only dealer can start after preplay
    const latestMe = latestPlayers.find((p) => p.id === myId) || me;
    if (latestMe.seat !== latestDealerSeat) return setStatusMsg("Only dealer can start after preplay.");
  
    const aliveSeats = latestPlayers.filter((p) => p.alive).map((p) => p.seat);
    if (aliveSeats.length < 2) return setStatusMsg("Not enough alive players to start.");
  
    const firstTurnSeat = nextAliveSeat(latestDealerSeat, 1, 0, aliveSeats);
  
    await saveState({
      ...latestState,
      roundStatus: "playing",
      direction: 1,
      pending: { count: 0, type: null },
      forcedSuit: null,
      turnSeat: firstTurnSeat,
      firstTurnSeat,
      turnStartedAt: Date.now(),
      lastEvent: `Dealer started play. First turn: seat ${firstTurnSeat}.`,
    });
  }
  

  return {
    createRoom,
    joinRoom,
    toggleReady,
    beginRound,
    preplayResolveMySevens,
    startPlayingAfterPreplay,
    playCard,
    pickUp,
    passTurn,
    continueToNextRound,
    refreshRow,
  };
}
