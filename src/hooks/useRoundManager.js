import { useMemo } from "react";
import { nextAliveSeat } from "../game/seat";
import { makeDeck, shuffle, cardToString, suitLabel } from "../game/cards";
import { countRank, canCoverSevens, resolveAllSevensManual } from "../game/rules";

export function useRoundManager({
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
}) {
  const allReady = players.length >= 2 && players.every((p) => p.ready);

  const allAliveSevensResolved = useMemo(() => {
    const alive = players.filter((p) => p.alive);
    if (alive.length === 0) return true;
    for (const p of alive) {
      const hand = Array.isArray(hands[p.seat]) ? hands[p.seat] : [];
      if (countRank(hand, 7) > 0) return false;
    }
    return true;
  }, [players, hands]);

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

  return {
    allReady,
    allAliveSevensResolved,
    startRound,
    preplayResolveMySevens,
    beginFirstTurn,
    continueToNextRound,
  };
}
