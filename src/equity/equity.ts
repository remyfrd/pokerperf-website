// Calcul d'équité multiway — énumération EXACTE si réaliste, sinon Monte-Carlo.
// Sémantique alignée sur poker.py : les pots partagés sont divisés entre gagnants
// (part de pot). equity = part de pot espérée ; win = victoire seule ; tie = partage.
import { Card, FULL_DECK } from "./cards";
import { evaluate7 } from "./evaluator";

export interface Hand {
  /** 2 cartes si connues ; ignoré si random=true. */
  cards: Card[];
  /** main adverse inconnue (« any two cards »). */
  random: boolean;
}

export interface PlayerEquity {
  win: number; // % de runouts gagnés seul
  tie: number; // % de runouts partagés
  equity: number; // % de part de pot espérée (win + partages pondérés)
}

export interface EquityResult {
  results: PlayerEquity[]; // parallèle à `hands`
  iterations: number;
  exact: boolean;
  mode: "exact" | "mc";
}

export interface EquityOptions {
  exactLimit?: number; // au-delà → Monte-Carlo
  mcSamples?: number;
  rng?: () => number; // injectable pour des tests reproductibles
}

// Au-delà de cette limite de runouts → Monte-Carlo (comme poker.py).
// Flop/turn/river (≤ ~178k runouts) = exact et instantané ; préflop = Monte-Carlo.
const DEFAULT_EXACT_LIMIT = 300_000;
const DEFAULT_MC_SAMPLES = 50_000;

function combinations<T>(arr: T[], k: number): T[][] {
  const res: T[][] = [];
  const idx = Array.from({ length: k }, (_, i) => i);
  if (k === 0) return [[]];
  if (k > arr.length) return res;
  while (true) {
    res.push(idx.map((i) => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === arr.length - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return res;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

export function computeEquity(
  hands: Hand[],
  board: Card[],
  opts: EquityOptions = {},
): EquityResult {
  const exactLimit = opts.exactLimit ?? DEFAULT_EXACT_LIMIT;
  const mcSamples = opts.mcSamples ?? DEFAULT_MC_SAMPLES;
  const rng = opts.rng ?? Math.random;

  if (hands.length < 2) throw new Error("Il faut au moins 2 mains.");
  if (![0, 3, 4, 5].includes(board.length)) throw new Error("Le board doit avoir 0, 3, 4 ou 5 cartes.");
  for (const h of hands) if (!h.random && h.cards.length !== 2) throw new Error("Chaque main connue doit avoir 2 cartes.");

  const known: Card[] = [...board];
  for (const h of hands) if (!h.random) known.push(...h.cards);
  if (new Set(known).size !== known.length) throw new Error("Cartes en double entre mains/board.");

  const dead = new Set(known);
  const deck = FULL_DECK.filter((c) => !dead.has(c));
  const boardNeed = 5 - board.length;
  const anyRandom = hands.some((h) => h.random);

  const share = new Array(hands.length).fill(0);
  const winCnt = new Array(hands.length).fill(0);
  const tieCnt = new Array(hands.length).fill(0);

  const tally = (fullBoard: Card[], holes: Card[][]) => {
    let best = -1;
    const scores = holes.map((hole) => {
      const s = evaluate7([...hole, ...fullBoard]);
      if (s > best) best = s;
      return s;
    });
    const winners: number[] = [];
    for (let i = 0; i < scores.length; i++) if (scores[i] === best) winners.push(i);
    if (winners.length === 1) {
      winCnt[winners[0]]++;
      share[winners[0]] += 1;
    } else {
      for (const i of winners) {
        tieCnt[i]++;
        share[i] += 1 / winners.length;
      }
    }
  };

  // --- EXACT : uniquement si toutes les mains sont connues et l'énumération est réaliste.
  const exact = !anyRandom && binomial(deck.length, boardNeed) <= exactLimit;

  let total: number;
  if (exact) {
    const holes = hands.map((h) => h.cards);
    const runouts = boardNeed === 0 ? [[]] : combinations(deck, boardNeed);
    total = runouts.length;
    for (const extra of runouts) tally([...board, ...extra], holes);
  } else {
    total = mcSamples;
    const randomCount = hands.filter((h) => h.random).length;
    const draw = randomCount * 2 + boardNeed;
    const pool = deck.slice();
    for (let t = 0; t < mcSamples; t++) {
      // Fisher-Yates partiel : on tire `draw` cartes distinctes.
      for (let i = 0; i < draw; i++) {
        const j = i + Math.floor(rng() * (pool.length - i));
        const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      let p = 0;
      const holes = hands.map((h) => (h.random ? [pool[p++], pool[p++]] : h.cards));
      const extra = pool.slice(p, p + boardNeed);
      tally([...board, ...extra], holes);
    }
  }

  const results = hands.map((_, i) => ({
    win: (winCnt[i] / total) * 100,
    tie: (tieCnt[i] / total) * 100,
    equity: (share[i] / total) * 100,
  }));
  return { results, iterations: total, exact, mode: exact ? "exact" : "mc" };
}
