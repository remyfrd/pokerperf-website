import { describe, it, expect } from "vitest";
import {
  normalCdf, riskOfRuin, requiredBankroll, resultAfter, simulateCash, ruinShare,
  payoutShares, tourneyModel, simulateTourneys, tourneyRuin, tourneyRequired, quantileSorted, mulberry32, gaussian,
} from "./bankroll";

describe("outils", () => {
  it("normalCdf : valeurs de référence", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 5);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 5);
  });
  it("gaussienne seedée : moyenne 0, écart-type 1, reproductible", () => {
    const g = gaussian(mulberry32(7));
    let s = 0, s2 = 0; const n = 200000;
    for (let i = 0; i < n; i++) { const x = g(); s += x; s2 += x * x; }
    expect(Math.abs(s / n)).toBeLessThan(0.01);
    expect(Math.sqrt(s2 / n)).toBeCloseTo(1, 2);
    expect(gaussian(mulberry32(7))()).toBe(gaussian(mulberry32(7))());
  });
});

describe("cash : formules fermées", () => {
  it("RoR = exp(−2μB/σ²) : 5 bb/100, σ 90, 20 caves → 8,5 %", () => {
    expect(riskOfRuin(5, 90, 2000)).toBeCloseTo(Math.exp(-20000 / 8100), 10);
    expect(riskOfRuin(5, 90, 2000)).toBeCloseTo(0.0847, 3);
  });
  it("cas limites : winrate ≤ 0 → 100 %, bankroll 0 → 100 %, σ 0 → 0", () => {
    expect(riskOfRuin(0, 90, 5000)).toBe(1);
    expect(riskOfRuin(-2, 90, 5000)).toBe(1);
    expect(riskOfRuin(5, 90, 0)).toBe(1);
    expect(riskOfRuin(5, 0, 100)).toBe(0);
    expect(requiredBankroll(0, 90, 0.05)).toBe(Infinity);
  });
  it("requiredBankroll est l'inverse de riskOfRuin", () => {
    for (const [wr, sd, r] of [[5, 90, 0.05], [2.5, 100, 0.01], [10, 70, 0.001]]) {
      expect(riskOfRuin(wr, sd, requiredBankroll(wr, sd, r))).toBeCloseTo(r, 10);
    }
    // 5 bb/100, σ 90 : 5 % → 24,3 caves, 1 % → 37,3 caves
    expect(requiredBankroll(5, 90, 0.05) / 100).toBeCloseTo(24.27, 1);
    expect(requiredBankroll(5, 90, 0.01) / 100).toBeCloseTo(37.30, 1);
  });
  it("resultAfter reproduit le tableau du guide variance (5 bb/100, σ 90)", () => {
    const r10 = resultAfter(5, 90, 10000);
    expect(r10.pLoss).toBeCloseTo(0.289, 2); // 29 %
    expect(r10.winrateLo95).toBeCloseTo(-12.6, 1);
    expect(r10.winrateHi95).toBeCloseTo(22.6, 1);
    expect(resultAfter(5, 90, 100000).pLoss).toBeCloseTo(0.039, 2); // 4 %
  });
});

describe("cash : la simulation recoupe la formule fermée", () => {
  it("RoR Monte-Carlo ≈ exp(−2μB/σ²) (μ 10, σ 100, B 1 000 bb → 13,5 %)", () => {
    // blocs de 10 mains : le dépassement discret est faible ; horizon 100 000 mains (ruine tardive négligeable)
    const sim = simulateCash({ winrate: 10, sd: 100, hands: 100000, block: 10, runs: 4000, seed: 99 });
    const mc = ruinShare(sim.minCum, -1000);
    expect(riskOfRuin(10, 100, 1000)).toBeCloseTo(0.1353, 3);
    expect(Math.abs(mc - 0.1353)).toBeLessThan(0.02);
  });
  it("résultat final simulé : moyenne et écart-type conformes", () => {
    const sim = simulateCash({ winrate: 5, sd: 90, hands: 10000, runs: 4000, seed: 3 });
    const f = sim.final; let s = 0, s2 = 0;
    for (const x of f) { s += x; s2 += x * x; }
    const m = s / f.length, sd = Math.sqrt(s2 / f.length - m * m);
    expect(Math.abs(m - 500)).toBeLessThan(40);
    expect(Math.abs(sd - 900) / 900).toBeLessThan(0.04);
    expect(Math.abs(ruinShare(sim.final, 0) - 0.289)).toBeLessThan(0.025); // P(perdant)
  });
  it("downswing médian sur 100 000 mains ≈ 1 900 bb (chiffre du guide variance)", () => {
    const sim = simulateCash({ winrate: 5, sd: 90, hands: 100000, runs: 3000, seed: 2026 });
    const med = quantileSorted(sim.maxDrawdown, 0.5);
    expect(med).toBeGreaterThan(1750);
    expect(med).toBeLessThan(2050);
  });
  it("winrate nul : la ruine sur horizon fini est fréquente mais < 100 %", () => {
    const sim = simulateCash({ winrate: 0, sd: 90, hands: 100000, runs: 2000, seed: 5 });
    // marche sans dérive : P(min ≤ −B) = 2·Φ(−B/(σ√k)) (principe de réflexion)
    const theo = 2 * normalCdf(-2000 / (90 * Math.sqrt(1000)));
    expect(Math.abs(ruinShare(sim.minCum, -2000) - theo)).toBeLessThan(0.04);
  });
});

describe("tournois", () => {
  it("structures : somme des parts = 1, MTT ~15 % payés, 1re ≈ 14 % pour 1 000 joueurs", () => {
    for (const f of [["sng9", 9], ["sng6", 6], ["mtt", 1000], ["mtt", 180]] as const) {
      const s = payoutShares(f[0], f[1]);
      expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
      for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThanOrEqual(s[i - 1]);
    }
    const m = payoutShares("mtt", 1000);
    expect(m.length).toBe(150);
    expect(m[0]).toBeGreaterThan(0.13); expect(m[0]).toBeLessThan(0.15);
    expect(m[149] * 1000).toBeGreaterThan(1.5); // min-cash > 1,5 × le pool moyen par entrée
  });
  it("le modèle restitue exactement le ROI demandé", () => {
    for (const fmt of ["sng9", "sng6", "mtt"] as const) {
      for (const roi of [-0.1, 0, 0.05, 0.2]) {
        const m = tourneyModel(fmt, roi, 0.08, 1000);
        expect(m.feasible).toBe(true);
        expect(m.mean).toBeCloseTo(roi, 10);
        expect(m.itm).toBeLessThanOrEqual(1);
      }
    }
  });
  it("SnG 9-max, ROI 0 sans rake : ITM = 1/3 et écart-type exact", () => {
    const m = tourneyModel("sng9", 0, 0);
    expect(m.itm).toBeCloseTo(1 / 3, 10);
    // prix 4,5 / 2,7 / 1,8 buy-ins chacun à 1/9 → E = 1, E[X²] = (20,25+7,29+3,24)/9
    expect(m.sd).toBeCloseTo(Math.sqrt((20.25 + 7.29 + 3.24) / 9 - 1), 10);
  });
  it("ROI impossible : plafonné et signalé", () => {
    const m = tourneyModel("sng6", 2, 0.05);
    expect(m.feasible).toBe(false);
    expect(m.itm).toBeCloseTo(1, 10);
    expect(m.mean).toBeCloseTo(m.maxRoi, 10);
  });
  it("la simulation recoupe le modèle (moyenne, écart-type) et la bankroll requise est cohérente", () => {
    const m = tourneyModel("mtt", 0.2, 0.1, 500);
    const sim = simulateTourneys(m, { tournaments: 500, runs: 3000, seed: 11 });
    let s = 0, s2 = 0;
    for (const x of sim.final) { s += x; s2 += x * x; }
    const mean = s / sim.final.length, sd = Math.sqrt(s2 / sim.final.length - mean * mean);
    expect(Math.abs(mean / 500 - 0.2)).toBeLessThan(4 * m.sd / Math.sqrt(500 * 3000));
    expect(Math.abs(sd - m.sd * Math.sqrt(500)) / (m.sd * Math.sqrt(500))).toBeLessThan(0.08);
    const b5 = tourneyRequired(sim, 0.05);
    expect(Math.abs(tourneyRuin(sim, b5) - 0.05)).toBeLessThan(0.01);
    expect(tourneyRuin(sim, b5 * 2)).toBeLessThan(0.05);
  });
});
