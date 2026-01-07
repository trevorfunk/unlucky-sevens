// src/game/cards.js
export const SUITS = ["S", "H", "D", "C"];

export function rankLabel(r) {
  if (r === 1) return "A";
  if (r === 11) return "J";
  if (r === 12) return "Q";
  if (r === 13) return "K";
  return String(r);
}

export function suitLabel(s) {
  if (s === "S") return "♠";
  if (s === "H") return "♥";
  if (s === "D") return "♦";
  if (s === "C") return "♣";
  return s;
}

export function cardToString(c) {
  return `${rankLabel(c.r)}${suitLabel(c.s)}`;
}

export function makeDeck() {
  const d = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) d.push({ r, s });
  return d;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
