import { describe, it, expect } from "vitest";
import { HANDS, RANKED, TOTAL_COMBOS, combosOf, countCombos, topPercent, parseRange, compressRange, handIndex } from "./range";

// A♠ = 0, K♦ = 1*4+2 (rangDesc*4 + couleur ♠♥♦♣)
const As = 0, Kd = 6;

describe("combinatoire des ranges", () => {
  it("169 mains, 1 326 combos ; paires 6, assorties 4, dépareillées 12", () => {
    expect(HANDS).toHaveLength(169);
    expect(countCombos(HANDS.map((h) => h.idx))).toBe(TOTAL_COMBOS);
    expect(combosOf(handIndex("AA"))).toBe(6);
    expect(combosOf(handIndex("AKs"))).toBe(4);
    expect(combosOf(handIndex("AKo"))).toBe(12);
    // chaque combo est unique
    const all = new Set(HANDS.flatMap((h) => h.combos.map(([a, b]) => a * 52 + b)));
    expect(all.size).toBe(1326);
  });

  it("AA-JJ + AK = 40 combos ≈ 3,0 %", () => {
    const sel = parseRange("JJ+, AK");
    expect(sel.size).toBe(6);
    const n = countCombos(sel);
    expect(n).toBe(40);
    expect(((n / TOTAL_COMBOS) * 100).toFixed(1)).toBe("3.0");
  });

  it("bloqueurs A♠K♦ : AA 3, KK 3, AK 9 → AA-JJ + AK = 27", () => {
    const dead = new Set([As, Kd]);
    expect(combosOf(handIndex("AA"), dead)).toBe(3);
    expect(combosOf(handIndex("KK"), dead)).toBe(3);
    expect(combosOf(handIndex("QQ"), dead)).toBe(6);
    expect(combosOf(handIndex("AKs"), dead) + combosOf(handIndex("AKo"), dead)).toBe(9);
    expect(countCombos(parseRange("JJ+, AK"), dead)).toBe(27);
    // total restant = C(50,2)
    expect(countCombos(HANDS.map((h) => h.idx), dead)).toBe(1225);
  });

  it("top X % : seuil jamais dépassé, la main qui franchit est exclue", () => {
    expect(topPercent(100).size).toBe(169);
    expect(topPercent(0).size).toBe(0);
    for (const p of [1, 3, 4, 5, 15, 27, 45, 77.5]) {
      const sel = topPercent(p);
      const n = countCombos(sel);
      expect(n).toBeLessThanOrEqual((p / 100) * TOTAL_COMBOS);
      // la main suivante ferait dépasser
      const next = RANKED[sel.size];
      expect(n + combosOf(next)).toBeGreaterThan((p / 100) * TOTAL_COMBOS);
    }
    expect(compressRange(topPercent(4))).toBe("88+, AQs+");
    expect(RANKED[0]).toBe(handIndex("AA"));
  });

  it("compression en notation standard (aller-retour)", () => {
    expect(compressRange(parseRange("JJ+, AK"))).toBe("JJ+, AKs, AKo");
    expect(compressRange(parseRange("TT+, AQs+, AKo"))).toBe("TT+, AQs+, AKo");
    expect(compressRange(parseRange("66-55, 22, A5s-A2s, KTs+, QJo"))).toBe("66-55, 22, A5s-A2s, KTs+, QJo");
    expect(compressRange(topPercent(100))).toBe(
      "22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, " +
        "A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o",
    );
    for (const p of [5, 15, 27, 45]) {
      const sel = topPercent(p);
      expect(parseRange(compressRange(sel))).toEqual(sel);
    }
  });
});
