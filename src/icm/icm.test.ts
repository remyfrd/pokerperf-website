import { describe, it, expect } from "vitest";
import { icmEquities, icmWithBusts, allInRisk } from "./icm";

// Référence INDÉPENDANTE : énumère tous les ordres d'arrivée (n!) avec la règle de Harville.
function bruteForce(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  const eq = new Array<number>(n).fill(0);
  const rec = (left: number[], p: number, place: number) => {
    if (left.length === 0) return;
    const tot = left.reduce((a, i) => a + stacks[i], 0);
    for (const i of left) {
      const q = (p * stacks[i]) / tot;
      eq[i] += q * (payouts[place] ?? 0);
      rec(left.filter((j) => j !== i), q, place + 1);
    }
  };
  rec([...Array(n).keys()], 1, 0);
  return eq;
}

describe("ICM Malmuth-Harville", () => {
  it("tête-à-tête : 1re place au prorata des tapis", () => {
    const [a, b] = icmEquities([75, 25], [60, 40]);
    expect(a).toBeCloseTo(0.75 * 60 + 0.25 * 40, 10); // 55
    expect(b).toBeCloseTo(45, 10);
  });

  it("tapis égaux → parts égales", () => {
    const eq = icmEquities([10, 10, 10, 10], [50, 30, 20]);
    for (const e of eq) expect(e).toBeCloseTo(25, 10);
  });

  it("exemple classique 3 joueurs 5000/3000/2000, prix 50/30/20", () => {
    // calcul à la main : P(1er) = 0,5 / 0,3 / 0,2 ; P(2e | A 1er) = 3/5, etc.
    const eq = icmEquities([5000, 3000, 2000], [50, 30, 20]);
    const pA2 = 0.3 * (5 / 7) + 0.2 * (5 / 8);
    const pA1 = 0.5;
    expect(eq[0]).toBeCloseTo(pA1 * 50 + pA2 * 30 + (1 - pA1 - pA2) * 20, 10);
    expect(eq.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
  });

  it("identique à l'énumération brute sur des cas aléatoires (jusqu'à 8 joueurs)", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 60; t++) {
      const n = 2 + Math.floor(rnd() * 7);
      const stacks = Array.from({ length: n }, () => 1 + Math.floor(rnd() * 100));
      const k = 1 + Math.floor(rnd() * n);
      const payouts = Array.from({ length: k }, (_, i) => (k - i) * 10 + Math.floor(rnd() * 5));
      const a = icmEquities(stacks, payouts), b = bruteForce(stacks, payouts);
      a.forEach((x, i) => expect(x).toBeCloseTo(b[i], 9));
      expect(a.reduce((s, x) => s + x, 0)).toBeCloseTo(payouts.slice(0, n).reduce((s, x) => s + x, 0), 9);
    }
  });

  it("10 joueurs : somme = prix distribués, rapide", () => {
    const stacks = [12, 30, 7, 55, 21, 9, 40, 18, 26, 33];
    const pay = [30, 20, 14, 10, 8, 7, 6, 5];
    const t0 = Date.now();
    const eq = icmEquities(stacks, pay);
    expect(Date.now() - t0).toBeLessThan(200);
    expect(eq.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
  });

  it("éliminé = dernière place restante", () => {
    const eq = icmWithBusts([60, 0, 40], [50, 30, 20]);
    expect(eq[1]).toBe(20);
    expect(eq[0]).toBeCloseTo(0.6 * 50 + 0.4 * 30, 10);
  });

  it("chip-EV (1 seul prix) : bubble factor = 1, équité requise 50 %", () => {
    const r = allInRisk([40, 30, 30], [100], 0, 1);
    expect(r.bubbleFactor).toBeCloseTo(1, 10);
    expect(r.requiredEquity).toBeCloseTo(0.5, 10);
  });

  it("bulle de satellite : 4 joueurs, 3 tickets, tapis égaux → tapis entre deux joueurs presque injouable", () => {
    const r = allInRisk([25, 25, 25, 25], [1, 1, 1], 0, 1);
    // gagner = ticket assuré (+0,25) ; perdre = 0 (−0,75) → BF 3, équité requise 75 %
    expect(r.evWin).toBeCloseTo(1, 10);
    expect(r.evLose).toBeCloseTo(0, 10);
    expect(r.bubbleFactor).toBeCloseTo(3, 10);
    expect(r.requiredEquity).toBeCloseTo(0.75, 10);
  });
});

import { parsePayouts } from "../ui/icm";
describe("saisie des prix", () => {
  it("espaces, virgules, points-virgules, décimales FR, %", () => {
    expect(parsePayouts("50 30 20")).toEqual([50, 30, 20]);
    expect(parsePayouts("50,30,20")).toEqual([50, 30, 20]);
    expect(parsePayouts("50, 30, 20")).toEqual([50, 30, 20]);
    expect(parsePayouts("12,5 7,5")).toEqual([12.5, 7.5]);
    expect(parsePayouts("50%; 30%; 20%")).toEqual([50, 30, 20]);
    expect(parsePayouts("")).toEqual([]);
  });
});
