import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";

import { useGameRoom } from "./hooks/useGameRoom";
import { cardToString, makeDeck, shuffle, suitLabel } from "./game/cards";
import {
  canCoverSevens,
  countRank,
  normalizePending,
  normalizeState,
  playableCards,
  resolveAllSevensManual,
} from "./game/rules";

import SuitModal from "./components/SuitModal";

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

  // Suit chooser modal state
  const [suitModalOpen, setSuitModalOpen] = useState(false);
  const [suitModalValue, setSuitModalValue] = useState("S");
  const [pendingSuitAction, setPendingSuitAction] = useState(null);
  // { kind: "play8", card } OR { kind: "preplaySevens" }

  // default suit preference (also used for auto-resolve 7 draws)
  const [chooseSuit, setChooseSuit] = useState("S");

  // timer tick
  const [nowMs, setNowMs] = useState(Date.now());
  const timeoutHandledRef = useRef(null);

  // Realtime room hook
  const { gameRow, setGameRow, state } = useGameRoom(roomCode);

  const players = Array.isArray(state.players) ? state.players : [];
  const me = players.find((p) => p.id === myId) || null;
  const mySeat = me?.seat ?? null;

  const hands = state.hands || {};
  const myHand = Array.isArray(hands[mySeat]) ? hands[mySeat] : [];

  const roundWins = state.roundWins || {};
  const round = state.round ?? 0;

  // lobby | preplay | playing | finished_round | finished_match
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

  /* =========================
     Turn timer
     ========================= */

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

  /* =========================
     Modal helpers
     ========================= */

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
     Persistence
     ========================= */

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

  /* =========================
     Lobby: create/join/ready
     ========================= */

  function genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
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

      // timer fields
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

  const allReady = players.length >= 2 && players.every((p) => p.ready);

  /* =========================
     Seat helpers
     (kept here for now because your seat.js doesn’t have skipCount logic yet)
     ========================= */

  function nextIndexCircular(i, n, dir) {
    if (n <= 0) return 0;
    const raw = i + dir;
    if (raw < 0) return n - 1;
    if (raw >= n) return 0;
    return raw;
  }

  function nextAliveSeat(fromSeat, dir, skipCount = 0, aliveList = aliveSeats) {
    if (aliveList.length === 0) return null;
    let idx = aliveList.indexOf(fromSeat);
    if (idx === -1) idx = 0;
    idx = nextIndexCircular(idx, aliveList.length, dir);
    for (let i = 0; i < skipCount; i++) idx = nextIndexCircular(idx, aliveList.length, dir);
    return aliveList[idx];
  }

  function reshuffleIfNeeded(currDeck, currDiscard, currTop) {
    if (currDeck.length > 0) return { deck: currDeck, discard: currDiscard, topCard: currTop };
    const reshuffle = currDiscard.filter((c) => !(c.r === currTop.r && c.s === currTop.s));
    const newDeck = shuffle(reshuffle);
    return { deck: newDeck, discard: [currTop], topCard: currTop };
  }

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

    await saveState({
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
    await saveState({
      roundStatus: "finished_round",
      turnSeat: null,
      firstTurnSeat: null,
      turnStartedAt: null,
      roundResult: { winnerId: null, reason, nextDealerSeat },
      lastEvent: `Round draw (${reason}).`,
    });
  }

  /* =========================
     Round setup
     ========================= */

  async function startRound() {
    setStatusMsg("");
    if (players.length < 2) return setStatusMsg("Need at least 2 players.");
    if (!allReady) return setStatusMsg("Everyone must be ready.");
    if (!me || me.seat !== dealerSeat) return setStatusMsg("Only the dealer can start the round.");

    let d = shuffle(makeDeck());
    const h = {};
    let disc = [];
    let top = null;

    // deal 7 each
    const seatOrder = players.slice().sort((a, b) => a.seat - b.seat);
    for (const p of seatOrder) h[p.seat] = d.splice(0, 7);

    // face up
    top = d.shift();
    disc = [top];

    let forced = null;
    let dir = 1;
    let pend = { count: 0, type: null };

    // eliminate only if cannot cover sevens
    const nextPlayers = players.map((p) => ({ ...p, alive: true, ready: false }));
    for (const p of nextPlayers) {
      if (!canCoverSevens(h[p.seat])) p.alive = false;
    }

    const alive = nextPlayers.filter((p) => p.alive);

    if (alive.length === 0) {
      await saveState({
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
        turnSeconds,
        roundResult: { winnerId: null, reason: "draw_all_eliminated_on_deal", nextDealerSeat: computeNextDealer(null) },
        lastEvent: "Round draw (everyone eliminated on deal). Dealer rotates.",
      });
      return;
    }

    if (alive.length === 1) {
      await saveState({
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
        turnSeconds,
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

      await saveState({
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
        turnSeconds,
        roundResult: null,
        lastEvent: `Round ${round + 1} setup. Face-up ${cardToString(top)} reversed. Pre-round phase.`,
      });
      return;
    }

    if (top.r === 12 && top.s === "S") {
      pend = { count: 4, type: "qs" };
    }

    await saveState({
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
      turnSeconds,
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

    await saveState({
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
      first = nextAliveSeat(first, direction, 0);
    }

    await saveState({
      roundStatus: "playing",
      turnSeat: first,
      turnStartedAt: new Date().toISOString(),
      lastEvent: `First turn begins. Seat ${first}'s turn.`,
    });
  }

  /* =========================
     End-of-round: Continue
     ========================= */

  async function continueToNextRound() {
    setStatusMsg("");
    if (roundStatus !== "finished_round") return setStatusMsg("Round is not finished.");

    const nextDealerSeat = roundResult?.nextDealerSeat ?? computeNextDealer(null);

    const resetPlayers = players.map((p) => ({
      ...p,
      alive: true,
      ready: false,
    }));

    await saveState({
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
      turnSeconds,
      lastEvent: `Back to lobby. Next dealer is seat ${nextDealerSeat}.`,
    });
  }

  /* =========================
     Turn actions: Play / Draw
     ========================= */

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

    let newDiscard = [...discard, card];
    let newTop = card;

    let newForced = null;
    let newPending = { ...pending };
    let newDir = direction;

    let extraTurn = false;
    let skipNext = 0;

    const aliveCount = aliveSeats.length;

    if ((pending?.count || 0) > 0) {
      if (card.r === 2) {
        newPending = { count: pending.count + 2, type: "two" };
      } else if (card.r === 12 && card.s === "S") {
        newPending = { count: pending.count + 4, type: "qs" };
      } else {
        return setStatusMsg(`You must defend with a 2 or Q♠/2♠, or pick up ${pending.count}.`);
      }
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
    if (!extraTurn) nextTurn = nextAliveSeat(turnSeat, newDir, skipNext);

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

      await finishRoundWithWinner(me, "shed_all_cards");
      return;
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
    let currTop = topCard;

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
        const stillAlive = newPlayers.filter((p) => p.alive);

        await saveState({
          players: newPlayers,
          hands: { ...hands, [mySeat]: newHand },
          deck: currDeck,
          discard: currDiscard,
          pending: clearedPending,
          lastEvent: `${me.name} picked up ${drawCount} ${pendingType ? "(penalty)" : ""} and hit ${sevensDrawn} seven(s) — OUT.`,
        });

        if (stillAlive.length === 1) {
          await finishRoundWithWinner(stillAlive[0], "last_alive");
        } else if (stillAlive.length === 0) {
          await finishRoundDraw("draw_all_eliminated");
        } else {
          const next = nextAliveSeat(
            turnSeat,
            direction,
            0,
            stillAlive.map((p) => p.seat).sort((a, b) => a - b)
          );
          await saveState({ turnSeat: next, turnStartedAt: new Date().toISOString() });
        }
        return;
      } else {
        const res = resolveAllSevensManual(newHand);
        if (!res.ok) return setStatusMsg("Unexpected: could not resolve sevens.");

        let newDiscard2 = [...currDiscard];
        for (let i = 0; i < sevensDrawn; i++) {
          newDiscard2.push({ r: 7, s: "S" });
          newDiscard2.push({ r: 8, s: chooseSuit });
        }
        const newTop2 = newDiscard2[newDiscard2.length - 1];

        const next = nextAliveSeat(turnSeat, direction, 0);

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

    const next = nextAliveSeat(turnSeat, direction, 0);

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

  /* =========================
     Timer: timeout auto-pickup + pass
     ========================= */

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
    let currTop = topCard;

    const resh = reshuffleIfNeeded(currDeck, currDiscard, currTop);
    currDeck = resh.deck;
    currDiscard = resh.discard;

    const drawn = currDeck.splice(0, drawCount);
    const newHand = [...myHand, ...drawn];

    const clearedPending = { count: 0, type: null };
    const next = nextAliveSeat(turnSeat, direction, 0);

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

    // NOTE: This timeout version is the "simple" one: always pickup+pass.
    // Your drawCards() function still contains the special 7-handling.
  }

  useEffect(() => {
    if (roundStatus !== "playing") return;
    if (!isMyTurn) return;
    if (!state.turnStartedAt) return;
    if (remainingSec === null) return;

    if (remainingSec <= 0) {
      if (timeoutHandledRef.current === state.turnStartedAt) return;
      timeoutHandledRef.current = state.turnStartedAt;
      timeoutPickupAndPass();
    }
  }, [roundStatus, isMyTurn, remainingSec, state.turnStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* =========================
     UI
     ========================= */

  const codeShown = roomCode.toUpperCase();
  const topDisplay = topCard ? cardToString(topCard) : "-";
  const readyCount = players.filter((p) => p.ready).length;

  const winnerName =
    roundResult?.winnerId ? (players.find((p) => p.id === roundResult.winnerId)?.name || "Winner") : null;

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
          <button onClick={createRoom} style={{ padding: 10 }}>
            Create Room
          </button>

          <input
            placeholder="Room code"
            value={codeShown}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            style={{ padding: 10, letterSpacing: 2 }}
          />

          <button onClick={joinRoom} style={{ padding: 10 }}>
            Join Room
          </button>
        </div>

        {statusMsg && <div style={{ color: "crimson" }}>{statusMsg}</div>}
      </div>

      {roomCode && (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div>
                <b>Room:</b> {codeShown}
              </div>
              <div>
                <b>You:</b> {me ? `${me.name} (seat ${me.seat})` : "Not joined"}
              </div>
              <div>
                <b>Round:</b> {round} &nbsp; <b>Status:</b> {roundStatus}
              </div>
              <div style={{ marginTop: 4 }}>
                <b>Turn timer:</b>{" "}
                {roundStatus === "playing" && remainingSec != null ? (
                  <span style={{ fontWeight: 900, color: remainingSec <= 5 ? "crimson" : "inherit" }}>
                    {remainingSec}s
                  </span>
                ) : (
                  "-"
                )}
              </div>
            </div>

            <div>
              <div>
                <b>Dealer seat:</b> {dealerSeat}
              </div>
              <div>
                <b>Turn seat:</b> {turnSeat ?? "-"} {isMyTurn ? "(YOU)" : ""}
              </div>
              <div>
                <b>Direction:</b> {direction === 1 ? "→" : "←"}
              </div>
              <div>
                <b>Pending draw:</b> {pending?.count || 0} {pending?.type ? `(${pending.type})` : ""}
              </div>
            </div>

            <div>
              <div>
                <b>Top:</b> {topDisplay}
              </div>
              <div>
                <b>Forced suit:</b> {forcedSuit ? suitLabel(forcedSuit) : "-"}
              </div>
              <div>
                <b>Deck:</b> {deck.length}
              </div>
              <div>
                <b>Discard:</b> {discard.length}
              </div>
            </div>
          </div>

          {state.lastEvent && (
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              <b>Event:</b> {state.lastEvent}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <b>Score (first to 7 wins)</b>
            <div style={{ display: "grid", gap: 4, marginTop: 6 }}>
              {players
                .slice()
                .sort((a, b) => a.seat - b.seat)
                .map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      Seat {p.seat}: {p.name} {p.alive ? "" : "(OUT)"} {p.ready ? "✅" : ""}
                    </div>
                    <div style={{ opacity: 0.85 }}>Wins: {roundWins[p.id] || 0}</div>
                  </div>
                ))}
            </div>
          </div>

          {/* Public Table View (still inline for now) */}
          <div style={{ marginTop: 16, padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <b>Table</b>
                <div style={{ marginTop: 6, fontSize: 14, opacity: 0.9 }}>
                  <div>
                    <b>Top:</b> {topDisplay}{" "}
                    {forcedSuit ? (
                      <span style={{ marginLeft: 8 }}>
                        <b>Suit:</b> {suitLabel(forcedSuit)}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <b>Direction:</b> {direction === 1 ? "→" : "←"} &nbsp;&nbsp;
                    <b>Dealer:</b> seat {dealerSeat}
                  </div>
                </div>
              </div>

              <div>
                {(pending?.count || 0) > 0 ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      background: "#fff3cd",
                      border: "1px solid #ffe69c",
                      fontWeight: 700,
                    }}
                  >
                    Pending pickup: {pending.count} {pending.type ? `(${pending.type})` : ""} — defend with 2 / Q♠ (or 2♠
                    vs Q♠ chain)
                  </div>
                ) : (
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: "#f6f6f6", border: "1px solid #eee" }}>
                    No pending pickup
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              {players
                .slice()
                .sort((a, b) => a.seat - b.seat)
                .map((p) => {
                  const handCount = Array.isArray(hands?.[p.seat]) ? hands[p.seat].length : 0;
                  const isTurn = turnSeat === p.seat && roundStatus === "playing";
                  const isMe = p.id === myId;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #eee",
                        background: isTurn ? "#e9f5ff" : "white",
                      }}
                    >
                      <div>
                        <b>Seat {p.seat}:</b> {p.name} {isMe ? "(YOU)" : ""} {!p.alive ? " — OUT" : ""}
                        {isTurn ? <span style={{ marginLeft: 8, fontWeight: 800 }}>(TURN)</span> : null}
                      </div>
                      <div style={{ opacity: 0.9 }}>
                        Cards: <b>{handCount}</b>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

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
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={toggleReady} style={{ padding: 10 }}>
                {me?.ready ? "Unready" : "Ready"}
              </button>

              <div style={{ paddingTop: 2 }}>
                <b>Ready:</b> {readyCount}/{players.length} (min 2, all must be ready)
              </div>

              <button onClick={startRound} style={{ padding: 10 }} disabled={!me || me.seat !== dealerSeat || !allReady}>
                Deal / Start Round (Dealer)
              </button>
            </div>
          )}

          {roundStatus === "preplay" && (
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <b>Pre-Round Phase:</b> Resolve any 7s manually by playing 7→8 before the first turn begins.
              </div>

              <div style={{ marginTop: 10 }}>
                <b>Your hand ({myHand.length})</b>
                {!me?.alive && <div style={{ color: "crimson", marginTop: 6 }}>You are OUT this round.</div>}
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {myHand.map((c, i) => (
                    <div
                      key={`${c.r}${c.s}${i}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        background: "white",
                      }}
                    >
                      {cardToString(c)}
                    </div>
                  ))}
                  {myHand.length === 0 && <div>(empty)</div>}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  onClick={() => openSuitModal({ kind: "preplaySevens" })}
                  style={{ padding: 10 }}
                  disabled={!me?.alive || mySevens === 0}
                >
                  Play 7+8 Save ({mySevens} seven{mySevens === 1 ? "" : "s"})
                </button>

                <div style={{ fontSize: 13, opacity: 0.85 }}>
                  You must end preplay with <b>0 sevens</b> in your hand.
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <b>Ready to begin?</b> {allAliveSevensResolved ? "✅ All sevens resolved" : "⏳ Waiting on players"}
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  onClick={beginFirstTurn}
                  style={{ padding: 10 }}
                  disabled={!me || me.seat !== dealerSeat || !allAliveSevensResolved}
                >
                  Begin First Turn (Dealer)
                </button>
              </div>
            </div>
          )}

          {roundStatus === "playing" && (
            <div>
              <hr style={{ margin: "14px 0" }} />

              <div>
                <b>Your hand ({myHand.length})</b>
                {!me?.alive && <div style={{ color: "crimson", marginTop: 6 }}>You are OUT this round.</div>}

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {myHand.map((c, i) => {
                    const isPlayable = myPlayable.some((p) => p.r === c.r && p.s === c.s);
                    return (
                      <button
                        key={`${c.r}${c.s}${i}`}
                        onClick={() => {
                          if (c.r === 8 && (pending?.count || 0) === 0) {
                            openSuitModal({ kind: "play8", card: c });
                            return;
                          }
                          playCard(c);
                        }}
                        disabled={!isMyTurn || !me?.alive || !isPlayable}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: "1px solid #ccc",
                          background: isPlayable ? "white" : "#f3f3f3",
                          cursor: "pointer",
                        }}
                        title={
                          isPlayable
                            ? "Playable"
                            : (pending?.count || 0) > 0
                            ? "Only defense cards playable (no 8 defense)"
                            : "Not playable"
                        }
                      >
                        {cardToString(c)}
                      </button>
                    );
                  })}
                  {myHand.length === 0 && <div>(empty)</div>}
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={drawCards} style={{ padding: 10 }} disabled={!isMyTurn || !me?.alive}>
                    {(pending?.count || 0) > 0 ? `Pick up ${pending.count} (penalty)` : "Pick up 1"}
                  </button>

                  <div style={{ fontSize: 13, opacity: 0.85 }}>
                    Rule: If you have a playable/defense card, you MUST play. After you pick up, if you now can play, you
                    may play one card.
                  </div>
                </div>
              </div>
            </div>
          )}

          {roundStatus === "finished_match" && (
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
              <b>Match finished!</b> Refresh / create a new room to start a new match.
            </div>
          )}

          {/* Suit chooser modal */}
          <SuitModal
            open={suitModalOpen}
            value={suitModalValue}
            onChange={setSuitModalValue}
            onCancel={closeSuitModal}
            onConfirm={async () => {
              const suit = suitModalValue;
              setChooseSuit(suit);

              const action = pendingSuitAction;
              closeSuitModal();

              if (!action) return;

              if (action.kind === "play8") {
                await playCard(action.card, suit);
                return;
              }

              if (action.kind === "preplaySevens") {
                await preplayResolveMySevens(suit);
                return;
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
