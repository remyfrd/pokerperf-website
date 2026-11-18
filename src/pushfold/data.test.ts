import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HANDS, GRID, SHARE, STACKS, combosOf, frequencyOf } from "./data";

// Les grilles HTML des 3 pages push/fold sont la référence affichée : l'outil doit dire exactement la même chose.
const PAGES = ["en/guides/push-fold-chart/index.html", "fr/guides/push-fold/index.html", "es/guias/tablas-push-fold/index.html"];

function parseGrids(file: string): Map<string, number>[] {
  const html = readFileSync(resolve(__dirname, "../..", file), "utf8");
  const block = html.slice(html.indexOf("<!--PF:GRIDS-->"), html.indexOf("<!--/PF:GRIDS-->"));
  return block.split("<caption>").slice(1).map((table) => {
    const cells = new Map<string, number>();
    for (const m of table.matchAll(/<td class="([a-z]+)"><b>([^<]+)<\/b><i aria-hidden="true">([^<]*)<\/i>/g)) {
      const [, cls, hand, mark] = m;
      cells.set(hand, cls === "on" ? 100 : cls === "off" ? 0 : Number(mark.replace("◐", "")));
    }
    return cells;
  });
}

describe("données push/fold", () => {
  it("couvre les 169 mains et 1 326 combos", () => {
    expect(HANDS).toHaveLength(169);
    expect(new Set(HANDS).size).toBe(169);
    expect(HANDS.reduce((n, h) => n + combosOf(h), 0)).toBe(1326);
  });

  for (const page of PAGES) {
    it(`concorde avec les 8 grilles de ${page}`, () => {
      const grids = parseGrids(page);
      expect(grids).toHaveLength(8);
      STACKS.forEach((stack, k) => {
        for (const [role, g] of [["sb", grids[2 * k]], ["bb", grids[2 * k + 1]]] as const) {
          expect(g.size).toBe(169);
          for (const hand of HANDS) expect([page, stack, role, hand, frequencyOf(hand, stack, role)]).toEqual([page, stack, role, hand, g.get(hand)]);
        }
      });
    });

    it(`concorde avec le tableau de synthèse de ${page}`, () => {
      const html = readFileSync(resolve(__dirname, "../..", page), "utf8");
      const summary = html.slice(html.indexOf("<!--PF:SUMMARY-->"), html.indexOf("<!--/PF:SUMMARY-->"));
      const nums = [...summary.matchAll(/<td>([\d.,]+)/g)].map((m) => Number(m[1].replace(",", ".")));
      expect(nums).toEqual(STACKS.flatMap((s) => [SHARE[s].sb, SHARE[s].bb]));
    });
  }

  it("garde des repères connus", () => {
    expect(frequencyOf("AA", 20, "bb")).toBe(100);
    expect(frequencyOf("72o", 20, "sb")).toBe(0);
    expect(frequencyOf("K5o", 10, "bb")).toBe(15);
    expect(GRID[10].sb.filter((f) => f === 100).length).toBeGreaterThan(GRID[20].sb.filter((f) => f === 100).length);
  });
});
