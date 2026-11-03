// Oracle lisible — `npm run oracle`.
// Imprime les équités calculées et compare à des bornes connues + aux spots de poker.py/equity.py.
// Sort en code 1 si un contrôle échoue.
import { parseCards, formatCards } from "./cards";
import { computeEquity, Hand } from "./equity";

// RNG reproductible pour les cas Monte-Carlo.
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const known = (s: string): Hand => ({ cards: parseCards(s), random: false });
const RANDOM: Hand = { cards: [], random: true };

let fails = 0;
function line(label: string, got: number, lo: number, hi: number, extra = "") {
  const ok = got >= lo && got <= hi;
  if (!ok) fails++;
  console.log(
    `  ${ok ? "✓" : "✗"}  ${label.padEnd(42)} ${got.toFixed(2).padStart(7)} %  (attendu ${lo}–${hi})  ${extra}`,
  );
}

console.log("\n=== Préflop heads-up (énumération EXACTE) ===");
{
  const r = computeEquity([known("As Ah"), known("Ks Kh")], []);
  line("AA vs KK — AA", r.results[0].equity, 80.5, 83.5, r.mode);
  line("AA vs KK — KK", r.results[1].equity, 16.5, 19.5);
}
{
  const r = computeEquity([known("Ah Kh"), known("2c 2d")], []);
  line("AKs vs 22 (pile ou face) — AK", r.results[0].equity, 44, 52, r.mode);
}
{
  const r = computeEquity([known("As Ad"), known("7h 2c")], []);
  line("AA vs 72o — AA", r.results[0].equity, 86, 89, r.mode);
}
{
  const r = computeEquity([known("As Ks"), known("Ah Kh")], []);
  line("AKs vs AKs (même force) — chop ~50", r.results[0].equity, 48, 52, `tie ${r.results[0].tie.toFixed(1)}%`);
}

console.log("\n=== vs main ALÉATOIRE (Monte-Carlo, seed fixe) ===");
{
  const r = computeEquity([known("As Ad"), RANDOM], [], { rng: mulberry32(42), mcSamples: 120000 });
  line("AA vs random — AA (~85%)", r.results[0].equity, 83, 87, r.mode);
}

console.log("\n=== Spots-pièges equity.py (flop, EXACT) — cross-check ===");
const traps: [string, string, string, string][] = [
  ["A) Top set vs OESFD", "9h 9d", "7s 6s", "9s 8s 2d"],
  ["B) Aces vs combo draw", "As Ah", "Qd 9d", "Jd Td 4c"],
  ["C) Top two vs nut FD+gut", "Kh Qh", "As Js", "Ks Qs 5h"],
  ["D) TPTK vs OESFD", "Ah 7d", "8s 9s", "7s 6s 2h"],
  ["E) Bottom set vs OESFD", "8s 8c", "9d Td", "8d 7d 2c"],
  ["F) Nut flush vs top set", "Ah 3h", "Kc Kd", "Kh Qh 7h"],
  ["G) Overpair vs set", "Ac Ad", "5h 5s", "5d 9c 2h"],
];
for (const [label, h1, h2, b] of traps) {
  const r = computeEquity([known(h1), known(h2)], parseCards(b));
  console.log(
    `  ${label.padEnd(30)} ${formatCards(parseCards(h1))} ${r.results[0].equity.toFixed(1).padStart(5)}%  vs  ` +
      `${formatCards(parseCards(h2))} ${r.results[1].equity.toFixed(1).padStart(5)}%   [${r.mode}, ${r.iterations} runouts]`,
  );
}

console.log(`\n${fails === 0 ? "✅ Tous les contrôles bornés passent." : `❌ ${fails} contrôle(s) en échec.`}\n`);
process.exit(fails === 0 ? 0 : 1);
