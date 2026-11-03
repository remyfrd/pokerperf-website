// 3e référence — indépendante de poker.py ET du moteur :
//  (A) Table d'équités PUBLIÉES (canon PokerStove/Equilab + « vs main aléatoire »).
//  (B) Évaluateur INDÉPENDANT (quinte par masque de bits) testé en différentiel.
import { describe, it, expect } from "vitest";
import { Card, FULL_DECK, parseCards, rankValue, suitOf } from "./cards";
import { evaluate7, categoryOf } from "./evaluator";
import { computeEquity, Hand } from "./equity";

const h = (s: string): Hand => ({ cards: parseCards(s), random: false });
const RANDOM: Hand = { cards: [], random: true };

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// (A) TABLE D'ÉQUITÉS PUBLIÉES (référence externe)
// Sources : valeurs canoniques pré-flop PokerStove/Equilab (part de pot, somme = 100)
// et table « main vs main aléatoire » standard (169 mains de départ).
// Pré-flop = Monte-Carlo → tolérance large (±1,5 %) pour absorber le bruit d'échantillonnage.
// ============================================================
describe("(A) Table d'équités publiée — référence externe", () => {
  const SAMPLES = 60000;
  type Row = { label: string; a: Hand; b: Hand; idx: 0 | 1; lo: number; hi: number };
  const table: Row[] = [
    { label: "AA vs KK → AA ~82,4%", a: h("As Ah"), b: h("Ks Kh"), idx: 0, lo: 80.9, hi: 83.9 },
    { label: "AKs vs QQ → QQ ~54%", a: h("Ah Kh"), b: h("Qs Qd"), idx: 1, lo: 52, hi: 56 },
    // Une petite paire est LÉGÈREMENT favorite face à 2 surcartes (~53% pour la paire) — canon.
    { label: "AKo vs 22 (race) → 22 favori ~53%", a: h("Ah Kd"), b: h("2s 2c"), idx: 1, lo: 51.5, hi: 54.5 },
    { label: "AA vs random → ~85,2%", a: h("As Ad"), b: RANDOM, idx: 0, lo: 83.7, hi: 86.7 },
    { label: "72o vs random → ~34,6% (pire main)", a: h("7h 2c"), b: RANDOM, idx: 0, lo: 33, hi: 36.5 },
    { label: "AKs vs random → ~67%", a: h("As Ks"), b: RANDOM, idx: 0, lo: 65.5, hi: 68.5 },
  ];
  for (const row of table) {
    it(row.label, () => {
      const r = computeEquity([row.a, row.b], [], { rng: mulberry32(2024), mcSamples: SAMPLES });
      const got = r.results[row.idx].equity;
      expect(got).toBeGreaterThanOrEqual(row.lo);
      expect(got).toBeLessThanOrEqual(row.hi);
    });
  }
});

// ============================================================
// (B) ÉVALUATEUR INDÉPENDANT (différentiel)
// Codé autrement : quinte détectée par masque de bits (dont as-bas), clé = tableau comparé
// lexicographiquement. Doit s'accorder avec le moteur sur des milliers de mains aléatoires.
// ============================================================
function refEvaluate5(cards: Card[]): number[] {
  const ranks = cards.map(rankValue).sort((a, b) => b - a);
  const suits = cards.map(suitOf);
  const flush = suits.every((s) => s === suits[0]);

  // Quinte par masque de bits (méthode distincte de poker.py)
  let present = 0;
  for (const r of ranks) present |= 1 << r;
  if (present & (1 << 14)) present |= 1 << 1; // as bas
  let straightHigh = 0;
  for (let hi = 14; hi >= 5; hi--) {
    const mask = 0b11111 << (hi - 4);
    if ((present & mask) === mask) { straightHigh = hi; break; }
  }

  const cnt = new Map<number, number>();
  for (const r of ranks) cnt.set(r, (cnt.get(r) ?? 0) + 1);
  const groups = [...cnt.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const sig = groups.map((g) => g[1]);
  const ord = groups.map((g) => g[0]);

  if (flush && straightHigh) return [8, straightHigh];
  if (sig[0] === 4) return [7, ...ord];
  if (sig[0] === 3 && sig[1] === 2) return [6, ...ord];
  if (flush) return [5, ...ranks];
  if (straightHigh) return [4, straightHigh];
  if (sig[0] === 3) return [3, ...ord];
  if (sig[0] === 2 && sig[1] === 2) return [2, ...ord];
  if (sig[0] === 2) return [1, ...ord];
  return [0, ...ranks];
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

const COMBOS: number[][] = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) for (let c = b + 1; c < 7; c++)
    for (let d = c + 1; d < 7; d++) for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out;
})();

function refEvaluate7(cards: Card[]): number[] {
  let best: number[] = [-1];
  for (const combo of COMBOS) {
    const v = refEvaluate5(combo.map((i) => cards[i]));
    if (cmp(v, best) > 0) best = v;
  }
  return best;
}

function shuffle(deck: Card[], rng: () => number): Card[] {
  const d = deck.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

describe("(B) Évaluateur indépendant — test différentiel", () => {
  it("accorde la catégorie sur 20 000 mains de 7 cartes aléatoires", () => {
    const rng = mulberry32(7);
    for (let n = 0; n < 20000; n++) {
      const d = shuffle(FULL_DECK, rng).slice(0, 7);
      expect(categoryOf(evaluate7(d))).toBe(refEvaluate7(d)[0]);
    }
  });

  it("désigne le même gagnant sur 20 000 confrontations aléatoires (tiebreaks inclus)", () => {
    const rng = mulberry32(99);
    for (let n = 0; n < 20000; n++) {
      const d = shuffle(FULL_DECK, rng);
      const board = d.slice(0, 5);
      const h1 = [d[5], d[6]], h2 = [d[7], d[8]];
      const s1 = evaluate7([...h1, ...board]);
      const s2 = evaluate7([...h2, ...board]);
      const r1 = refEvaluate7([...h1, ...board]);
      const r2 = refEvaluate7([...h2, ...board]);
      expect(Math.sign(s1 - s2)).toBe(Math.sign(cmp(r1, r2)));
    }
  });
});
