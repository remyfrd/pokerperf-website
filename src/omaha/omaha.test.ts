import { describe, it, expect } from "vitest";
import { parseCards, Card, FULL_DECK } from "../equity/cards";
import { evaluate5, evaluate7, categoryOf } from "../equity/evaluator";
import { fastEval5, evaluateOmaha, computeOmahaEquity, computeOmahaEquityAsync, OmahaHand } from "./omaha";

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function deal(rng: () => number, n: number, exclude: Card[] = []): Card[] {
  const d = FULL_DECK.filter((c) => !exclude.includes(c));
  for (let i = 0; i < n; i++) { const j = i + Math.floor(rng() * (d.length - i)); [d[i], d[j]] = [d[j], d[i]]; }
  return d.slice(0, n);
}
function combos<T>(a: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (a.length < k) return [];
  const [h, ...t] = a;
  return [...combos(t, k - 1).map((c) => [h, ...c]), ...combos(t, k)];
}
/** Évaluateur Omaha INDÉPENDANT : brute-force lisible avec evaluate5 du Hold'em. */
function bruteOmaha(hole: Card[], board: Card[]): number {
  let best = -1;
  for (const h of combos(hole, 2)) for (const b of combos(board, 3)) best = Math.max(best, evaluate5([...h, ...b]));
  return best;
}
/** Équité exacte INDÉPENDANTE : énumère tous les runouts, crédite les parts de pot. */
function bruteEquity(holes: Card[][], board: Card[]): number[] {
  const dead = new Set([...board, ...holes.flat()]);
  const deck = FULL_DECK.filter((c) => !dead.has(c));
  const share = holes.map(() => 0);
  let n = 0;
  for (const run of combos(deck, 5 - board.length)) {
    const b = [...board, ...run];
    const s = holes.map((h) => bruteOmaha(h, b));
    const m = Math.max(...s);
    const w = s.filter((x) => x === m).length;
    s.forEach((x, i) => { if (x === m) share[i] += 1 / w; });
    n++;
  }
  return share.map((x) => (100 * x) / n);
}
const H = (s: string): OmahaHand => ({ cards: parseCards(s), random: false });

describe("fastEval5 = evaluate5 (même score)", () => {
  it("sur 300 000 mains de 5 cartes aléatoires", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 300_000; i++) {
      const c = deal(rng, 5);
      expect(fastEval5(c[0], c[1], c[2], c[3], c[4])).toBe(evaluate5(c));
    }
  });
  it("sur des mains rares (quintes flush, carrés, fulls, roues, couleurs)", () => {
    for (const s of ["AsKsQsJsTs", "5s4s3s2sAs", "AhAdAcAs2d", "KhKdKc2s2d", "Ah2c3d4s5h", "Ah9h7h4h2h", "6c5d4h3s2c", "2c2d3h3s4c", "9s9h9dKcQs", "AsKdQhJcTs"])
      { const c = parseCards(s); expect(fastEval5(c[0], c[1], c[2], c[3], c[4])).toBe(evaluate5(c)); }
  });
});

describe("règle Omaha : exactement 2 cartes privatives + 3 du board", () => {
  it("4 piques au board + 1 pique en main ≠ couleur", () => {
    const hole = parseCards("As Kd 7c 2h");
    const board = parseCards("Qs Js 9s 4s 3d");
    expect(categoryOf(evaluateOmaha(hole, board))).not.toBe(5);
    // au Hold'em avec les mêmes cartes, A♠ ferait la couleur
    expect(categoryOf(evaluate7([...parseCards("As Kd"), ...board]))).toBe(5);
  });
  it("une quinte flush royale au board+1 carte en Hold'em n'est qu'une carte haute en Omaha", () => {
    const hole = parseCards("Ts 3c 4c 5h");
    const board = parseCards("As Ks Qs Js 2d");
    expect(categoryOf(evaluateOmaha(hole, board))).toBe(0); // A K Q T 5
    expect(evaluateOmaha(hole, board)).toBe(evaluate5(parseCards("As Ks Qs Ts 5h")));
  });
  it("une paire au board + brelan en main ≠ full : on ne joue que 2 cartes", () => {
    const hole = parseCards("9h 9d 9c 2s");
    const board = parseCards("Kc Kd 5h 7s 3c");
    // 9 9 + K K x = double paire, jamais de full avec un seul 9 du board inexistant
    expect(categoryOf(evaluateOmaha(hole, board))).toBe(2);
  });
  it("PLO5 : 10 paires × 10 triplets, même règle", () => {
    const hole = parseCards("As Ks 7c 2h 8d");
    const board = parseCards("Qs Js 9s 4s 3d");
    expect(categoryOf(evaluateOmaha(hole, board))).toBe(5); // A♠K♠ + 3 piques
    expect(evaluateOmaha(hole, board)).toBe(bruteOmaha(hole, board));
  });
});

describe("évaluateur rapide = brute-force indépendant", () => {
  it("sur 20 000 donnes PLO4 et 10 000 PLO5", () => {
    const rng = mulberry32(7);
    for (const [hs, n] of [[4, 20_000], [5, 10_000]] as const) {
      for (let i = 0; i < n; i++) {
        const c = deal(rng, hs + 5);
        const hole = c.slice(0, hs), board = c.slice(hs);
        expect(evaluateOmaha(hole, board)).toBe(bruteOmaha(hole, board));
      }
    }
  });
});

describe("équité exacte", () => {
  it("river : un seul gagnant → 100 / 0", () => {
    const r = computeOmahaEquity([H("As Kd 7c 2h"), H("Qh Qd 8c 3h")], parseCards("Qs Js 9s 4s 3d"));
    // Q♥Q♦ + Q♠… = brelan de dames ; A♠K♦ + ? : A♠ seul pique → pas de couleur ; quinte ? K Q J 9 … non.
    expect(r.exact).toBe(true);
    expect(r.results[1].equity).toBe(100);
    expect(r.results[0].equity).toBe(0);
  });
  it("river : partage exact 50 / 50 (même quinte)", () => {
    const r = computeOmahaEquity([H("Th 8c 2d 2c"), H("Td 8h 3c 3d")], parseCards("Qs Js 9h 4c 5d"));
    expect(r.results[0].tie).toBe(100);
    expect(r.results[0].equity).toBe(50);
    expect(r.results[1].equity).toBe(50);
  });
  it("turn : comptage des outs à la main", () => {
    // Board 9♣ 8♦ 2♥ K♠ ; A = A♥A♦ 6♣ 3♦ (paire d'as) ; B = J♥T♥ 4♠ 4♦ (quinte ouverte J T + 9 8 ; Q ou 7 → quinte).
    // Paquet restant : 52 − 4 − 8 = 40 cartes. Outs de B : Q (4) + 7 (4) = 8, A n'a rien qui bat une quinte
    // (pas de couleur possible : seuls 1 cœur au board ; A♥ + ? deux cœurs du board requis).
    // B aussi gagne avec un 4 (brelan) : 4♥ 4♣ restants = 2 → 10 outs. A ne peut pas améliorer au-delà d'un brelan.
    const r = computeOmahaEquity([H("Ah Ad 6c 3d"), H("Jh Th 4s 4d")], parseCards("9c 8d 2h Ks"));
    expect(r.exact).toBe(true);
    expect(r.iterations).toBe(40);
    expect(r.results[1].equity).toBeCloseTo((100 * 10) / 40, 10);
  });
  it("flop : moteur = énumération brute-force indépendante (spots aléatoires, 2 et 3 joueurs)", () => {
    const rng = mulberry32(42);
    for (const [players, hs, boardLen] of [[2, 4, 4], [3, 4, 4], [2, 5, 4], [2, 4, 3]] as const) {
      for (let t = 0; t < 2; t++) {
        const c = deal(rng, players * hs + boardLen);
        const holes = Array.from({ length: players }, (_, i) => c.slice(i * hs, (i + 1) * hs));
        const board = c.slice(players * hs);
        const r = computeOmahaEquity(holes.map((h) => ({ cards: h, random: false })), board);
        const ref = bruteEquity(holes, board);
        r.results.forEach((x, i) => expect(x.equity).toBeCloseTo(ref[i], 9));
      }
    }
  });
  it("les parts de pot somment à 100 %", () => {
    const r = computeOmahaEquity([H("As Ah Ks Kh"), H("Jd Td 9c 8c"), H("Qc Qd 7s 6s")], parseCards("Ts 9h 2c"));
    expect(r.results.reduce((s, x) => s + x.equity, 0)).toBeCloseTo(100, 9);
  });
});

describe("Monte-Carlo (préflop, mains aléatoires)", () => {
  it("reproductible avec un rng seedé et proche de l'exact sur un spot flop forcé en MC", () => {
    const hands = [H("As Ah Ks Kh"), H("Jd Td 9c 8c")];
    const board = parseCards("7s 6h 2d");
    const exact = computeOmahaEquity(hands, board);
    const a = computeOmahaEquity(hands, board, { exactBudget: 0, mcSamples: 40_000, rng: mulberry32(3) });
    const b = computeOmahaEquity(hands, board, { exactBudget: 0, mcSamples: 40_000, rng: mulberry32(3) });
    expect(a.mode).toBe("mc");
    expect(a.results[0].equity).toBe(b.results[0].equity);
    expect(Math.abs(a.results[0].equity - exact.results[0].equity)).toBeLessThan(1);
  });
  it("2 mains aléatoires : symétrie ≈ 50 %", () => {
    const r = computeOmahaEquity([{ cards: [], random: true }, { cards: [], random: true }], [], { mcSamples: 30_000, rng: mulberry32(9) });
    expect(Math.abs(r.results[0].equity - 50)).toBeLessThan(1.5);
  });
  it("async = sync pour le même rng", async () => {
    const hands = [H("As Ah Ks Kh"), { cards: [], random: true }];
    const s = computeOmahaEquity(hands, [], { mcSamples: 6_000, rng: mulberry32(5) });
    const a = await computeOmahaEquityAsync(hands, [], { mcSamples: 6_000, batch: 1_000, rng: mulberry32(5) });
    expect(a.results[0].equity).toBe(s.results[0].equity);
  });
});

describe("validations", () => {
  it("refuse doublons, tailles incohérentes, trop de joueurs", () => {
    expect(() => computeOmahaEquity([H("As Ah Ks Kh"), H("As Td 9c 8c")], [])).toThrow();
    expect(() => computeOmahaEquity([H("As Ah Ks Kh"), H("Jd Td 9c 8c 2s")], [])).toThrow();
    expect(() => computeOmahaEquity([H("As Ah Ks Kh"), H("Jd Td 9c 8c")], parseCards("2c 3c"))).toThrow();
    expect(() => computeOmahaEquity(Array.from({ length: 7 }, () => ({ cards: [], random: true })), [])).toThrow();
  });
});
