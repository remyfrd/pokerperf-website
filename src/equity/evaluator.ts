// Évaluateur de main — porte la logique de poker.py (rank5) en score numérique comparable.
// Un score plus grand = meilleure main. Catégorie dans le nibble de poids fort, puis
// jusqu'à 5 rangs de départage.  (Lisible et exact ; la vitesse vient de l'entier compact.)
import { Card, rankValue, suitOf } from "./cards";

export const CATEGORY_NAMES = [
  "Carte haute", // 0
  "Paire", // 1
  "Double paire", // 2
  "Brelan", // 3
  "Quinte", // 4
  "Couleur", // 5
  "Full", // 6
  "Carré", // 7
  "Quinte flush", // 8
] as const;

function pack(category: number, tiebreaks: number[]): number {
  // 1 nibble catégorie + 5 nibbles de départage (rangs ≤ 14 < 16).
  let v = category;
  for (let i = 0; i < 5; i++) v = v * 16 + (tiebreaks[i] ?? 0);
  return v;
}

/** Catégorie 0..8 à partir d'un score (pour l'affichage). */
export function categoryOf(score: number): number {
  return Math.floor(score / 16 ** 5);
}

/** Évalue exactement 5 cartes → score. */
export function evaluate5(cards: Card[]): number {
  const ranks = cards.map(rankValue).sort((a, b) => b - a); // desc
  const suits = cards.map(suitOf);
  const flush = suits.every((s) => s === suits[0]);

  const rset = new Set(ranks);
  let straightHigh = 0;
  if ([14, 2, 3, 4, 5].every((r) => rset.has(r))) straightHigh = 5; // roue A-2-3-4-5
  for (const hi of [...rset].sort((a, b) => b - a)) {
    let run = true;
    for (let k = 0; k < 5; k++) if (!rset.has(hi - k)) { run = false; break; }
    if (run) { straightHigh = Math.max(straightHigh, hi); break; }
  }

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // tri par (occurrence desc, rang desc)
  const by = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const pattern = by.map(([, c]) => c);
  const ordered = by.map(([r]) => r);

  if (flush && straightHigh) return pack(8, [straightHigh]);
  if (pattern[0] === 4) return pack(7, ordered); // [carré, kicker]
  if (pattern[0] === 3 && pattern[1] === 2) return pack(6, ordered); // [brelan, paire]
  if (flush) return pack(5, ranks);
  if (straightHigh) return pack(4, [straightHigh]);
  if (pattern[0] === 3) return pack(3, ordered); // [brelan, k1, k2]
  if (pattern[0] === 2 && pattern[1] === 2) return pack(2, ordered); // [hp, lp, kicker]
  if (pattern[0] === 2) return pack(1, ordered); // [paire, k1, k2, k3]
  return pack(0, ranks);
}

// Les 21 combinaisons d'indices (5 parmi 7), précalculées.
const C7x5: number[][] = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out; // 21
})();

/** Meilleure main de 5 parmi 7 cartes → score. */
export function evaluate7(cards: Card[]): number {
  let best = -1;
  const five: Card[] = [0, 0, 0, 0, 0];
  for (const combo of C7x5) {
    for (let i = 0; i < 5; i++) five[i] = cards[combo[i]];
    const v = evaluate5(five);
    if (v > best) best = v;
  }
  return best;
}
