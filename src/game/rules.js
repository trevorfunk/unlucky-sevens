// src/game/rules.js

export function normalizeState(state) {
  if (!state) return {};
  if (typeof state === "string") {
    try {
      return JSON.parse(state);
    } catch {
      return {};
    }
  }
  return state;
}

export function countRank(hand, r) {
  return hand.filter((c) => c.r === r).length;
}

export function canCoverSevens(hand) {
  const sevens = countRank(hand, 7);
  if (sevens === 0) return true;
  const eights = countRank(hand, 8);
  return eights >= sevens;
}

export function resolveAllSevensManual(hand) {
  const sevens = countRank(hand, 7);
  if (sevens === 0) return { ok: true, hand, sevensResolved: 0 };

  const eights = countRank(hand, 8);
  if (eights < sevens) return { ok: false, reason: "Not enough 8s to cover all 7s." };

  // remove all 7s
  let h = hand.filter((c) => c.r !== 7);

  // remove same number of 8s
  let need8 = sevens;
  const out = [];
  for (const c of h) {
    if (c.r === 8 && need8 > 0) {
      need8--;
      continue;
    }
    out.push(c);
  }

  return { ok: true, hand: out, sevensResolved: sevens };
}

export function canMatch(card, topCard, forcedSuit) {
  // 8 always playable when NO penalty is pending
  if (card.r === 8) return true;

  // if top is 8 and no forced suit, next can play anything
  if (topCard?.r === 8 && !forcedSuit) return true;

  const suitToMatch = forcedSuit || topCard?.s;
  const rankToMatch = topCard?.r;
  return card.s === suitToMatch || card.r === rankToMatch;
}

export function normalizePending(p) {
  if (!p) return { count: 0, type: null };
  if (typeof p === "string") {
    try {
      const obj = JSON.parse(p);
      return { count: Number(obj?.count || 0), type: obj?.type ?? null };
    } catch {
      return { count: 0, type: null };
    }
  }
  if (typeof p === "object") {
    return { count: Number(p?.count || 0), type: p?.type ?? null };
  }
  return { count: 0, type: null };
}

/**
 * Pending pickup rule:
 * - If pending.count > 0, ONLY defense cards are playable:
 *   - pending type "two": any 2, OR Q♠ (flips into qs chain)
 *   - pending type "qs": 2♠, OR Q♠ (stack)
 * - You may NOT defend with an 8.
 * - If pending.type is missing/unknown, default to "two"
 */
export function playableCards(hand, topCard, forcedSuit, pending) {
  const pendingCount = Number(pending?.count || 0);

  if (pendingCount > 0) {
    const t = pending?.type === "qs" ? "qs" : "two";

    const twos = hand.filter((c) => c.r === 2);
    const twoSpades = hand.filter((c) => c.r === 2 && c.s === "S");
    const queenSpades = hand.filter((c) => c.r === 12 && c.s === "S");

    if (t === "two") return [...twos, ...queenSpades];
    return [...twoSpades, ...queenSpades];
  }

  return hand.filter((c) => canMatch(c, topCard, forcedSuit));
}
