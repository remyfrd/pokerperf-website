import { describe, it, expect } from "vitest";
import { parseCards } from "./cards";
import { evaluate5, evaluate7, categoryOf } from "./evaluator";
import { computeEquity, Hand } from "./equity";

const h = (s: string): Hand => ({ cards: parseCards(s), random: false });
const RANDOM: Hand = { cards: [], random: true };
const ev5 = (s: string) => evaluate5(parseCards(s));

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("evaluate5 — ordre des catégories", () => {
  it("respecte la hiérarchie des mains", () => {
    const sf = ev5("9s 8s 7s 6s 5s"); // quinte flush
    const quads = ev5("9s 9h 9d 9c 2s");
    const full = ev5("9s 9h 9d 2c 2s");
    const flush = ev5("As Qs 9s 5s 2s");
    const straight = ev5("9s 8h 7d 6c 5s");
    const trips = ev5("9s 9h 9d 5c 2s");
    const twoPair = ev5("9s 9h 5d 5c 2s");
    const pair = ev5("9s 9h 5d 3c 2s");
    const high = ev5("As Qh 9d 5c 2s");
    const order = [high, pair, twoPair, trips, straight, flush, full, quads, sf];
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]);
    expect(categoryOf(sf)).toBe(8);
    expect(categoryOf(high)).toBe(0);
  });

  it("gère la roue (A-2-3-4-5) sous la quinte 6-haute", () => {
    const wheel = ev5("As 2h 3d 4c 5s");
    const six = ev5("6s 5h 4d 3c 2s");
    expect(categoryOf(wheel)).toBe(4);
    expect(six).toBeGreaterThan(wheel);
  });

  it("départage par kicker", () => {
    expect(ev5("As Ah Ks 5c 2d")).toBeGreaterThan(ev5("As Ah Qs 5c 2d"));
  });

  it("royal flush > quinte flush plus basse", () => {
    expect(ev5("As Ks Qs Js Ts")).toBeGreaterThan(ev5("Ks Qs Js Ts 9s"));
  });

  it("evaluate7 choisit la meilleure de 7", () => {
    // 7 cartes contenant une couleur (5 piques : As Ks 2s 9s 5s)
    expect(categoryOf(evaluate7(parseCards("As Ks 2s 3d 9s 5s 7c")))).toBe(5);
  });
});

describe("computeEquity", () => {
  it("river : main faite = 100% (exact, 1 runout)", () => {
    const r = computeEquity([h("As Ks"), h("7c 7d")], parseCards("Qs Js 2s 3h 4h"));
    expect(r.exact).toBe(true);
    expect(r.iterations).toBe(1);
    expect(r.results[0].equity).toBe(100);
    expect(r.results[1].equity).toBe(0);
  });

  it("partage : deux broadway → chop 50/50, tie 100%", () => {
    const r = computeEquity([h("As Ks"), h("Ah Kh")], parseCards("Qc Jc Tc 2d 3d"));
    expect(r.results[0].equity).toBeCloseTo(50, 5);
    expect(r.results[1].equity).toBeCloseTo(50, 5);
    expect(r.results[0].tie).toBe(100);
    expect(r.results[0].win).toBe(0);
  });

  it("AA vs KK préflop (Monte-Carlo) : AA ~82%", () => {
    const r = computeEquity([h("As Ah"), h("Ks Kh")], [], { rng: mulberry32(99), mcSamples: 80000 });
    expect(r.exact).toBe(false); // préflop > limite exacte → MC
    expect(r.results[0].equity).toBeGreaterThan(81);
    expect(r.results[0].equity).toBeLessThan(83.5);
    expect(r.results[0].equity + r.results[1].equity).toBeCloseTo(100, 6);
  });

  it("Monte-Carlo converge vers l'exact (< 1,5% d'écart)", () => {
    const board = parseCards("9s 8s 2d");
    const hands = [h("9h 9d"), h("7s 6s")];
    const exact = computeEquity(hands, board);
    expect(exact.exact).toBe(true); // flop → exact (990 runouts)
    const mc = computeEquity(hands, board, { exactLimit: 0, mcSamples: 80000, rng: mulberry32(7) });
    expect(mc.exact).toBe(false);
    expect(Math.abs(mc.results[0].equity - exact.results[0].equity)).toBeLessThan(1.5);
  });

  it("main aléatoire → Monte-Carlo ; AA vs random ~85%", () => {
    const r = computeEquity([h("As Ad"), RANDOM], [], { rng: mulberry32(1), mcSamples: 80000 });
    expect(r.exact).toBe(false);
    expect(r.results[0].equity).toBeGreaterThan(83);
    expect(r.results[0].equity).toBeLessThan(87);
  });

  it("3 joueurs : les équités somment à 100", () => {
    const r = computeEquity([h("As Ah"), h("Ks Kh"), h("Qs Qh")], [], { rng: mulberry32(5), mcSamples: 60000 });
    const sum = r.results.reduce((a, x) => a + x.equity, 0);
    expect(sum).toBeCloseTo(100, 5);
  });

  it("refuse un board de taille invalide", () => {
    expect(() => computeEquity([h("As Ah"), h("Ks Kh")], parseCards("2c 3d"))).toThrow();
  });

  it("refuse des cartes en double", () => {
    expect(() => computeEquity([h("As Ah"), h("As Kh")], [])).toThrow();
  });
});
