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

function reshuffleIfNeeded(currDeck, currDiscard, currTop) {
  if (currDeck.length > 0) return { deck: currDeck, discard: currDiscard, topCard: currTop };
  const reshuffle = currDiscard.filter((c) => !(c.r === currTop.r && c.s === currTop.s));
  const newDeck = shuffle(reshuffle);
  return { deck: newDeck, discard: [currTop], topCard: currTop };
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function useGameActions(ctx) {
  const {
    roomCode,
    myId,
    name,
    state: rawState,
    setStatusMsg,
    setRoomCode,
    setGameRow,
    TURN_SECONDS,
    chooseSuit,
  } = ctx;

  // ✅ derive everything inside the hook
  const state = normalizeState(rawState);

  const players = Array.isArray(state.players) ? state.players : [];
  const me = players.find((p) => p.id === myId) || null;
  const mySeat = me?.seat ?? null;

  const hands = state.hands || {};
  const myHand = mySeat != null && Array.isArray(hands[mySeat]) ? hands[mySeat] : [];

  const deck = Array.isArray(state.deck) ? state.deck : [];
  const discard = Array.isArray(state.discard) ? state.discard : [];

  const topCard = state.topCard ?? null;
  const forcedSuit = state.forcedSuit ?? null;

  const pending = normalizePending(state.pending);

  const roundStatus = state.roundStatus ?? "lobby";
  const dealerSeat = state.dealerSeat ?? 0;
  const turnSeat = state.turnSeat ?? null;
  const direction = state.direction ?? 1;

  const aliveSeats = players
    .filter((p) => p.alive)
    .map((p) => p.seat)
    .sort((a, b) => a - b);

  const isMyTurn = mySeat !== null && turnSeat === mySeat && me?.alive;

  const myPlayable = playableCards(myHand, topCard, forcedSuit, pending);

  async function saveState(patch) {
    setStatusMsg("");
    const code = roomCode.trim().toUpperCase();
    const { data, error } = await supabase
      .from("games")
      .update({
        state: { ...state, ...patch, updatedAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq("code", code)
      .select("*")
      .single();

    if (error) {
      console.error(error);
      setStatusMsg(error.message);
      return null;
    }
    setGameRow(data);
    return data;
  }

  async function createRoom() {
    setStatusMsg("");
    const playerName = name.trim();
    if (!playerName) return setStatusMsg("Enter your name first.");

    const code = genCode();

    const initial = {
      version: 8,
      round: 0,
      roundStatus: "lobby",
      players: [{ id: myId, name: playerName, seat: 0, alive: true, ready: false }],
      dealerSeat: 0,
      turnSeat: null,
      direction: 1,
      deck: [],
      discard: [],
      topCard: null,
      forcedSuit: null,
      pending: { count: 0, type: null },
      hands: { 0: [] },
      roundWins: {},
      roundResult: null,
      lastEvent: null,
      firstTurnSeat: null,
      turnStartedAt: null,
      turnSeconds: TURN_SECONDS,
    };

    const { data, error } = await supabase
      .from("games")
      .insert([{ code, status: "waiting", state: initial, updated_at: new Date().toISOString() }])
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return setStatusMsg(error.message);
    }

    setRoomCode(code);
    setGameRow(data);
  }

  async function joinRoom() {
    setStatusMsg("");
    const playerName = name.trim();
    const code = roomCode.trim().toUpperCase();
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
    while (used.has(seat)) seat++;

    const nextPlayers = [...pls, { id: myId, name: playerName, seat, alive: true, ready: false }];
    const nextHands = { ...(st.hands || {}) };
    nextHands[seat] = [];

    const { data: updated, error: updErr } = await supabase
      .from("games")
      .update({ state: { ...st, players: nextPlayers, hands: nextHands }, updated_at: new Date().toISOString() })
      .eq("code", code)
      .select("*")
      .single();

    if (updErr) return setStatusMsg(updErr.message);
    setGameRow(updated);
  }

  async function toggleReady() {
    if (!me) return setStatusMsg("Join first.");
    const nextPlayers = players.map((p) => (p.id === myId ? { ...p, ready: !p.ready } : p));
    await saveState({ players: nextPlayers, lastEvent: `${me.name} is ${!me.ready ? "READY" : "NOT ready"}` });
  }

  async function playCard(card, suitOverride = null) {
    setStatusMsg("");
    if (roundStatus !== "playing") return setStatusMsg("Round not active.");
    if (!me?.alive) return setStatusMsg("You are OUT this round.");
    if (!isMyTurn) return setStatusMsg("Not your turn.");

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

    const newDiscard = [...discard, card];
    const newTop = card;

    let newForced = null;
    let newPending = { ...pending };
    let newDir = direction;

    let extraTurn = false;
    let skipNext = 0;

    const aliveCount = aliveSeats.length;

    if ((pending?.count || 0) > 0) {
      if (card.r === 2) newPending = { count: pending.count + 2, type: "two" };
      else if (card.r === 12 && card.s === "S") newPending = { count: pending.count + 4, type: "qs" };
      else return setStatusMsg(`You must defend with a 2 or Q♠/2♠, or pick up ${pending.count}.`);
    } else {
      if (card.r === 2) newPending = { count: 2, type: "two" };

      if (card.r === 4) {
        if (aliveCount === 2) extraTurn = true;
        else newDir = direction * -1;
      }

      if (card.r === 11) {
        if (aliveCount === 2) extraTurn = true;
        else skipNext = 1;
      }

      if (card.r === 12 && card.s === "S") newPending = { count: 4, type: "qs" };
      if (card.r === 8) newForced = suitOverride || chooseSuit;
    }

    let nextTurn = turnSeat;
    if (!extraTurn) nextTurn = nextAliveSeat(turnSeat, newDir, skipNext, aliveSeats);

    // NOTE: finishRoundWithWinner still lives in App for now.
    // We still save the "emptied hand" state, then App can detect it if needed.
    if (hand.length === 0) {
      await saveState({
        hands: { ...hands, [mySeat]: hand },
        discard: newDiscard,
        topCard: newTop,
        forcedSuit: newForced,
        pending: { count: 0, type: null },
        direction: newDir,
        turnSeat: null,
        firstTurnSeat: null,
        turnStartedAt: null,
        lastEvent: `${me.name} emptied their hand!`,
      });
      return { emptiedHand: true };
    }

    await saveState({
      hands: { ...hands, [mySeat]: hand },
      discard: newDiscard,
      topCard: newTop,
      forcedSuit: newForced,
      pending: newPending,
      direction: newDir,
      turnSeat: nextTurn,
      turnStartedAt: extraTurn ? state.turnStartedAt ?? new Date().toISOString() : new Date().toISOString(),
      lastEvent: `${me.name} played ${cardToString(card)}.`,
    });

    return { emptiedHand: false };
  }

  async function drawCards() {
    setStatusMsg("");
    if (roundStatus !== "playing") return setStatusMsg("Round not active.");
    if (!me?.alive) return setStatusMsg("You are OUT this round.");
    if (!isMyTurn) return setStatusMsg("Not your turn.");

    if (myPlayable.length > 0) return setStatusMsg("You have a playable/defense card — you must play.");

    const hadPending = (pending?.count || 0) > 0;
    const drawCount = hadPending ? pending.count : 1;
    const pendingType = hadPending ? pending.type : null;

    let currDeck = [...deck];
    let currDiscard = [...discard];
    const currTop = topCard;

    const resh = reshuffleIfNeeded(currDeck, currDiscard, currTop);
    currDeck = resh.deck;
    currDiscard = resh.discard;

    const drawn = currDeck.splice(0, drawCount);
    const newHand = [...myHand, ...drawn];

    const clearedPending = { count: 0, type: null };
    const sevensDrawn = drawn.filter((c) => c.r === 7).length;

    if (sevensDrawn > 0) {
      const eightsBefore = countRank(myHand, 8);

      if (eightsBefore < sevensDrawn) {
        const newPlayers = players.map((p) => (p.id === me.id ? { ...p, alive: false } : p));

        await saveState({
          players: newPlayers,
          hands: { ...hands, [mySeat]: newHand },
          deck: currDeck,
          discard: currDiscard,
          pending: clearedPending,
          lastEvent: `${me.name} picked up ${drawCount} ${pendingType ? "(penalty)" : ""} and hit ${sevensDrawn} seven(s) — OUT.`,
        });
        return;
      }

      const res = resolveAllSevensManual(newHand);
      if (!res.ok) return setStatusMsg("Unexpected: could not resolve sevens.");

      const newDiscard2 = [...currDiscard];
      for (let i = 0; i < sevensDrawn; i++) {
        newDiscard2.push({ r: 7, s: "S" });
        newDiscard2.push({ r: 8, s: chooseSuit });
      }
      const newTop2 = newDiscard2[newDiscard2.length - 1];

      const next = nextAliveSeat(turnSeat, direction, 0, aliveSeats);

      await saveState({
        hands: { ...hands, [mySeat]: res.hand },
        deck: currDeck,
        discard: newDiscard2,
        topCard: newTop2,
        forcedSuit: chooseSuit,
        pending: clearedPending,
        turnSeat: next,
        turnStartedAt: new Date().toISOString(),
        lastEvent: `${me.name} picked up ${drawCount} ${pendingType ? "(penalty)" : ""}, hit ${sevensDrawn} seven(s), saved with 8(s). Suit is now ${suitLabel(
          chooseSuit
        )}.`,
      });
      return;
    }

    const playableAfterDraw = playableCards(newHand, topCard, forcedSuit, clearedPending);
    const canPlayNow = playableAfterDraw.length > 0;

    if (canPlayNow) {
      await saveState({
        hands: { ...hands, [mySeat]: newHand },
        deck: currDeck,
        discard: currDiscard,
        pending: clearedPending,
        turnSeat: turnSeat,
        lastEvent: hadPending
          ? `${me.name} picked up ${drawCount} (penalty) and can now play.`
          : `${me.name} picked up 1 and can now play.`,
      });
      return;
    }

    const next = nextAliveSeat(turnSeat, direction, 0, aliveSeats);

    await saveState({
      hands: { ...hands, [mySeat]: newHand },
      deck: currDeck,
      discard: currDiscard,
      pending: clearedPending,
      turnSeat: next,
      turnStartedAt: new Date().toISOString(),
      lastEvent: hadPending
        ? `${me.name} picked up ${drawCount} (penalty). No play — turn passes.`
        : `${me.name} picked up 1. No play — turn passes.`,
    });
  }

  async function timeoutPickupAndPass() {
    setStatusMsg("");
    if (roundStatus !== "playing") return;
    if (!me?.alive) return;
    if (!isMyTurn) return;

    const hadPending = (pending?.count || 0) > 0;
    const drawCount = hadPending ? pending.count : 1;
    const pendingType = hadPending ? pending.type : null;

    let currDeck = [...deck];
    let currDiscard = [...discard];
    const currTop = topCard;

    const resh = reshuffleIfNeeded(currDeck, currDiscard, currTop);
    currDeck = resh.deck;
    currDiscard = resh.discard;

    const drawn = currDeck.splice(0, drawCount);
    const newHand = [...myHand, ...drawn];

    const clearedPending = { count: 0, type: null };
    const sevensDrawn = drawn.filter((c) => c.r === 7).length;

    if (sevensDrawn > 0) {
      const eightsBefore = countRank(myHand, 8);

      if (eightsBefore < sevensDrawn) {
        const newPlayers = players.map((p) => (p.id === me.id ? { ...p, alive: false } : p));

        await saveState({
          players: newPlayers,
          hands: { ...hands, [mySeat]: newHand },
          deck: currDeck,
          discard: currDiscard,
          pending: clearedPending,
          lastEvent: `${me.name} TIMED OUT, picked up ${drawCount} ${pendingType ? "(penalty)" : ""} and hit ${sevensDrawn} seven(s) — OUT.`,
        });
        return;
      }

      const res = resolveAllSevensManual(newHand);
      if (!res.ok) return setStatusMsg("Unexpected: could not resolve sevens.");

      const newDiscard2 = [...currDiscard];
      for (let i = 0; i < sevensDrawn; i++) {
        newDiscard2.push({ r: 7, s: "S" });
        newDiscard2.push({ r: 8, s: chooseSuit });
      }
      const newTop2 = newDiscard2[newDiscard2.length - 1];

      const next = nextAliveSeat(turnSeat, direction, 0, aliveSeats);

      await saveState({
        hands: { ...hands, [mySeat]: res.hand },
        deck: currDeck,
        discard: newDiscard2,
        topCard: newTop2,
        forcedSuit: chooseSuit,
        pending: clearedPending,
        turnSeat: next,
        turnStartedAt: new Date().toISOString(),
        lastEvent: `${me.name} TIMED OUT, picked up ${drawCount} ${pendingType ? "(penalty)" : ""}, hit ${sevensDrawn} seven(s), saved with 8(s). Suit is now ${suitLabel(
          chooseSuit
        )}. Turn passes.`,
      });
      return;
    }

    const next = nextAliveSeat(turnSeat, direction, 0, aliveSeats);

    await saveState({
      hands: { ...hands, [mySeat]: newHand },
      deck: currDeck,
      discard: currDiscard,
      pending: clearedPending,
      turnSeat: next,
      turnStartedAt: new Date().toISOString(),
      lastEvent: hadPending
        ? `${me.name} TIMED OUT — picked up ${drawCount} (penalty). Turn passes.`
        : `${me.name} TIMED OUT — picked up 1. Turn passes.`,
    });
  }

  return {
    createRoom,
    joinRoom,
    saveState,
    toggleReady,
    playCard,
    drawCards,
    timeoutPickupAndPass,
  };
}
