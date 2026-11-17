import { describe, it, expect } from "vitest";
import { computeSidePots, requiredEquity, SidePotError, SidePotPlayer } from "./sidepot";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe("computeSidePots", () => {
  it("3 joueurs, un tapis court : pot principal + 1 side pot", () => {
    // A tapis 50, B et C misent 200
    const r = computeSidePots([{ bet: 50 }, { bet: 200 }, { bet: 200 }]);
    expect(r.refund).toBeNull();
    expect(r.pots.map((p) => p.amount)).toEqual([150, 300]);
    expect(r.pots[0].eligible).toEqual([0, 1, 2]);
    expect(r.pots[1].eligible).toEqual([1, 2]);
    expect(r.total).toBe(450);
  });

  it("exemple de la page : 3 tapis + appel, 60 d'argent préflop", () => {
    // A 115, B 265, C 415, Héros 415
    const r = computeSidePots([{ bet: 115 }, { bet: 265 }, { bet: 415 }, { bet: 415 }]);
    expect(r.pots.map((p) => p.amount)).toEqual([460, 450, 300]);
    expect(r.pots.map((p) => p.eligible)).toEqual([[0, 1, 2, 3], [1, 2, 3], [2, 3]]);
    expect(r.total).toBe(1210);
  });

  it("4 joueurs, 3 tapis de tailles différentes", () => {
    const r = computeSidePots([{ bet: 20 }, { bet: 50 }, { bet: 100 }, { bet: 100 }]);
    expect(r.pots.map((p) => p.amount)).toEqual([80, 90, 100]);
    expect(r.pots.map((p) => p.cap)).toEqual([20, 50, 100]);
  });

  it("mise non payée rendue au plus gros contributeur", () => {
    // A tapis 40, B mise 150 : B récupère 110
    const r = computeSidePots([{ bet: 40 }, { bet: 150 }], 1);
    expect(r.refund).toEqual({ player: 1, amount: 110 });
    expect(r.pots).toHaveLength(1);
    expect(r.pots[0].amount).toBe(80);
  });

  it("un joueur couché laisse ses jetons dans les pots qu'il a alimentés", () => {
    // A tapis 30 ; B a payé 60 puis s'est couché ; C et D vont à 100
    const r = computeSidePots([{ bet: 30 }, { bet: 60, folded: true }, { bet: 100 }, { bet: 100 }]);
    expect(r.pots.map((p) => p.amount)).toEqual([120, 170]); // 4×30 ; 30 (B) + 70 + 70
    expect(r.pots[0].eligible).toEqual([0, 2, 3]);
    expect(r.pots[1].eligible).toEqual([2, 3]);
  });

  it("couché au-dessus du plus gros joueur en main : excédent au dernier pot", () => {
    // B a misé 100 puis s'est couché ; A tapis 40 et C 80 restent
    const r = computeSidePots([{ bet: 40 }, { bet: 100, folded: true }, { bet: 80 }]);
    // mise non payée : 100 vs 80 → 20 rendus à B
    expect(r.refund).toEqual({ player: 1, amount: 20 });
    expect(r.pots.map((p) => p.amount)).toEqual([120, 80]);
    expect(r.total).toBe(200);
  });

  it("showdown : le tapis court gagne le principal, le side pot va au meilleur des autres", () => {
    const r = computeSidePots([
      { bet: 50, rank: 1 }, { bet: 200, rank: 3 }, { bet: 200, rank: 2 },
    ]);
    expect(r.winnings).toEqual([150, 0, 300]);
    expect(r.net).toEqual([100, -200, 100]);
    expect(r.pots[0].winners).toEqual([0]);
    expect(r.pots[1].winners).toEqual([2]);
  });

  it("égalité : partage, jeton indivisible au premier à gauche du bouton", () => {
    // pot de 3 × 25 = 75 partagé entre les joueurs 0 et 2 : 37 chacun + 1 jeton indivisible au 1er siège (index 0)
    const r = computeSidePots([{ bet: 25, rank: 1 }, { bet: 25, rank: 2 }, { bet: 25, rank: 1 }]);
    expect(r.winnings).toEqual([38, 0, 37]);
  });

  it("égalité avec unité 0,5 : partage au demi-jeton", () => {
    const r = computeSidePots([{ bet: 2.5, rank: 1 }, { bet: 2.5, rank: 1 }, { bet: 2.5, rank: 3 }], 0.5);
    // 7,5 = 15 unités → 8 + 7 → 4 et 3,5
    expect(r.winnings).toEqual([4, 3.5, 0]);
  });

  it("égalité dans un side pot seulement", () => {
    // A tapis 100 gagne le principal ; B et C partagent le side pot
    const r = computeSidePots([{ bet: 100, rank: 1 }, { bet: 300, rank: 2 }, { bet: 300, rank: 2 }]);
    expect(r.winnings).toEqual([300, 200, 200]);
  });

  it("tous couchés sauf un : il ramasse tout", () => {
    const r = computeSidePots([{ bet: 10, folded: true }, { bet: 30, folded: true }, { bet: 30, rank: 1 }]);
    expect(r.winnings).toEqual([0, 0, 70]);
  });

  it("sans classement : pas de gains calculés", () => {
    const r = computeSidePots([{ bet: 10 }, { bet: 10 }]);
    expect(r.winnings).toBeUndefined();
  });

  it("erreurs d'entrée", () => {
    expect(() => computeSidePots([{ bet: 10 }])).toThrow(SidePotError);
    expect(() => computeSidePots([{ bet: -1 }, { bet: 5 }])).toThrow(SidePotError);
    expect(() => computeSidePots([{ bet: 5, folded: true }, { bet: 5, folded: true }])).toThrow(SidePotError);
  });

  it("invariant : conservation des jetons sur 5 000 mains aléatoires", () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let t = 0; t < 5000; t++) {
      const n = 2 + Math.floor(rnd() * 8);
      const ps: SidePotPlayer[] = Array.from({ length: n }, () => ({
        bet: Math.floor(rnd() * 500),
        folded: rnd() < 0.3,
        rank: 1 + Math.floor(rnd() * 3),
      }));
      if (ps.every((p) => p.folded)) ps[0].folded = false;
      const r = computeSidePots(ps);
      const bets = sum(ps.map((p) => p.bet));
      const refund = r.refund ? r.refund.amount : 0;
      expect(sum(r.pots.map((p) => p.amount)) + refund).toBe(bets);
      expect(sum(r.winnings!)).toBe(r.total);
      expect(sum(r.net!)).toBe(0);
      // personne ne gagne plus, de chaque adversaire, que ce qu'il a misé
      r.pots.forEach((p) => p.eligible.forEach((i) => expect(ps[i].folded).toBeFalsy()));
      ps.forEach((p, i) => { if (p.folded) expect(r.winnings![i]).toBe(0); });
      // un pot à un seul éligible n'existe que si quelqu'un (couché) l'a alimenté
      for (const p of r.pots) if (p.eligible.length === 1) {
        const lvlPrev = p.index === 0 ? 0 : r.pots[p.index - 1].cap;
        expect(ps.some((q) => q.folded && q.bet > lvlPrev)).toBe(true);
      }
    }
  });
});

describe("requiredEquity", () => {
  it("appel ÷ total gagnable", () => {
    expect(requiredEquity(400, 1210)).toBeCloseTo(0.3306, 4);
    expect(requiredEquity(10, 0)).toBe(1);
  });
});
