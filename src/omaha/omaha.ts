// Moteur d'équité Omaha (PLO4 / PLO5) — règle stricte : exactement 2 cartes privatives + 3 du board.
// Réutilise le modèle de cartes du Hold'em (src/equity/cards.ts) et produit des scores
// IDENTIQUES à evaluate5 (src/equity/evaluator.ts), via un évaluateur 5 cartes rapide (sans allocation).
// Exact quand le nombre de runouts est raisonnable (flop/turn/river), Monte-Carlo sinon (préflop,
// mains adverses aléatoires). Les pots partagés sont divisés entre gagnants.
import { Card, FULL_DECK } from "../equity/cards";

export interface OmahaHand {
  /** 4 (PLO4) ou 5 (PLO5) cartes si connues ; ignoré si random=true. */
  cards: Card[];
  /** main inconnue (n'importe quelles 4/5 cartes). */
  random: boolean;
}

export interface OmahaPlayerEquity {
  win: number; // % des runouts gagnés seul
  tie: number; // % des runouts partagés
  equity: number; // % de part de pot espérée
}

export interface OmahaResult {
  results: OmahaPlayerEquity[];
  iterations: number;
  exact: boolean;
  mode: "exact" | "mc";
}

export interface OmahaOptions {
  /** Nombre de cartes privatives : 4 (PLO) ou 5 (PLO5). Défaut : déduit des mains connues, sinon 4. */
  holeSize?: 4 | 5;
  /** Budget d'évaluations 5 cartes au-delà duquel on passe en Monte-Carlo. */
  exactBudget?: number;
  /** Nombre de tirages Monte-Carlo (défaut : adapté au nombre de joueurs). */
  mcSamples?: number;
  rng?: () => number;
}

export const MAX_PLAYERS = 6;
const DEFAULT_EXACT_BUDGET = 8_000_000;
const MC_EVAL_BUDGET = 12_000_000;

// ── Évaluateur 5 cartes rapide, score identique à evaluate5 ──────────────────────────
const cnt = new Int8Array(15);
const P16 = [1, 16, 256, 4096, 65536, 1048576];

export function fastEval5(a: Card, b: Card, c: Card, d: Card, e: Card): number {
  const ra = (a >> 2) + 2, rb = (b >> 2) + 2, rc = (c >> 2) + 2, rd = (d >> 2) + 2, re = (e >> 2) + 2;
  const flush = (a & 3) === (b & 3) && (a & 3) === (c & 3) && (a & 3) === (d & 3) && (a & 3) === (e & 3);
  const mask = (1 << ra) | (1 << rb) | (1 << rc) | (1 << rd) | (1 << re);
  let straight = 0;
  if (mask === 0b100000000111100) straight = 5; // roue A-2-3-4-5
  else {
    for (let hi = 14; hi >= 6; hi--) {
      if (((mask >> (hi - 4)) & 31) === 31) { straight = hi; break; }
    }
  }
  if (straight) return (flush ? 8 : 4) * P16[5] + straight * P16[4];
  cnt[ra]++; cnt[rb]++; cnt[rc]++; cnt[rd]++; cnt[re]++;
  // départage : (occurrences desc, rang desc)
  let v = 0, n = 0, maxc = 0, pairs = 0;
  for (let k = 4; k >= 1; k--) {
    for (let r = 14; r >= 2; r--) {
      if (cnt[r] === k) {
        v = v * 16 + r; n++;
        if (k > maxc) maxc = k;
        if (k === 2) pairs++;
      }
    }
  }
  cnt[ra] = 0; cnt[rb] = 0; cnt[rc] = 0; cnt[rd] = 0; cnt[re] = 0;
  while (n < 5) { v *= 16; n++; }
  let cat: number;
  if (maxc === 4) cat = 7;
  else if (maxc === 3) cat = pairs ? 6 : (flush ? 5 : 3);
  else if (flush) cat = 5;
  else if (pairs === 2) cat = 2;
  else if (pairs === 1) cat = 1;
  else cat = 0;
  if (cat === 5) {
    // couleur : les 5 rangs desc (tous distincts, sinon pas de couleur possible avec un brelan… sauf full exclu)
    v = 0;
    for (let r = 14, m = 0; r >= 2 && m < 5; r--) if (mask & (1 << r)) { v = v * 16 + r; m++; }
  }
  return cat * P16[5] + v;
}

// Index des paires de cartes privatives et des triplets du board.
function pairIdx(n: number): number[] {
  const o: number[] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) o.push(i, j);
  return o;
}
const PAIRS4 = pairIdx(4); // 6 paires
const PAIRS5 = pairIdx(5); // 10 paires
const TRIPLES: number[] = (() => {
  const o: number[] = [];
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) o.push(a, b, c);
  return o; // 10 triplets
})();

/** Meilleure main Omaha : exactement 2 cartes de `hole` + 3 de `board` (5 cartes). */
export function evaluateOmaha(hole: ArrayLike<Card>, board: ArrayLike<Card>): number {
  const pairs = hole.length === 5 ? PAIRS5 : PAIRS4;
  let best = -1;
  for (let t = 0; t < 30; t += 3) {
    const x = board[TRIPLES[t]], y = board[TRIPLES[t + 1]], z = board[TRIPLES[t + 2]];
    for (let p = 0; p < pairs.length; p += 2) {
      const s = fastEval5(hole[pairs[p]], hole[pairs[p + 1]], x, y, z);
      if (s > best) best = s;
    }
  }
  return best;
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

interface Prepared {
  holeSize: number;
  board: Card[];
  known: (Card[] | null)[];
  deck: Card[];
  boardNeed: number;
  nRandom: number;
}

function prepare(hands: OmahaHand[], board: Card[], opts: OmahaOptions): Prepared {
  if (hands.length < 2) throw new Error("Il faut au moins 2 mains.");
  if (hands.length > MAX_PLAYERS) throw new Error(`Maximum ${MAX_PLAYERS} joueurs.`);
  if (![0, 3, 4, 5].includes(board.length)) throw new Error("Le board doit avoir 0, 3, 4 ou 5 cartes.");
  const knownSizes = hands.filter((h) => !h.random).map((h) => h.cards.length);
  const holeSize = opts.holeSize ?? (knownSizes[0] === 5 ? 5 : 4);
  if (holeSize !== 4 && holeSize !== 5) throw new Error("Une main Omaha a 4 ou 5 cartes.");
  for (const s of knownSizes) if (s !== holeSize) throw new Error(`Chaque main connue doit avoir ${holeSize} cartes.`);
  const all: Card[] = [...board];
  for (const h of hands) if (!h.random) all.push(...h.cards);
  for (const c of all) if (!(c >= 0 && c < 52)) throw new Error("Carte invalide.");
  if (new Set(all).size !== all.length) throw new Error("Cartes en double entre mains/board.");
  const dead = new Set(all);
  const nRandom = hands.filter((h) => h.random).length;
  const deck = FULL_DECK.filter((c) => !dead.has(c));
  if (deck.length < 5 - board.length + nRandom * holeSize) throw new Error("Pas assez de cartes dans le paquet.");
  return { holeSize, board, known: hands.map((h) => (h.random ? null : h.cards)), deck, boardNeed: 5 - board.length, nRandom };
}

class Acc {
  win: Float64Array; tie: Float64Array; share: Float64Array; n = 0;
  scores: Float64Array;
  constructor(public p: number) {
    this.win = new Float64Array(p); this.tie = new Float64Array(p); this.share = new Float64Array(p);
    this.scores = new Float64Array(p);
  }
  /** this.scores rempli → crédite le(s) gagnant(s). */
  settle(weight = 1) {
    let best = -1, nb = 0;
    for (let i = 0; i < this.p; i++) {
      const s = this.scores[i];
      if (s > best) { best = s; nb = 1; } else if (s === best) nb++;
    }
    for (let i = 0; i < this.p; i++) {
      if (this.scores[i] === best) {
        if (nb === 1) this.win[i] += weight; else this.tie[i] += weight;
        this.share[i] += weight / nb;
      }
    }
    this.n += weight;
  }
  result(exact: boolean): OmahaResult {
    const n = this.n || 1;
    const results: OmahaPlayerEquity[] = [];
    for (let i = 0; i < this.p; i++)
      results.push({ win: (100 * this.win[i]) / n, tie: (100 * this.tie[i]) / n, equity: (100 * this.share[i]) / n });
    return { results, iterations: this.n, exact, mode: exact ? "exact" : "mc" };
  }
}

/** Coût d'une énumération exacte (évaluations 5 cartes), Infinity si mains aléatoires. */
export function exactCost(hands: OmahaHand[], board: Card[], holeSize: 4 | 5 = 4): number {
  if (hands.some((h) => h.random)) return Infinity;
  const deckLen = 52 - board.length - hands.length * holeSize;
  const pairs = holeSize === 5 ? 10 : 6;
  return binomial(deckLen, 5 - board.length) * hands.length * pairs * 10;
}

function enumerateExact(pr: Prepared): OmahaResult {
  const p = pr.known.length;
  const acc = new Acc(p);
  const b = new Array<Card>(5);
  for (let i = 0; i < pr.board.length; i++) b[i] = pr.board[i];
  const deck = pr.deck, need = pr.boardNeed, start = pr.board.length;
  const idx = Array.from({ length: need }, (_, i) => i);
  const run = () => {
    for (let k = 0; k < need; k++) b[start + k] = deck[idx[k]];
    for (let i = 0; i < p; i++) acc.scores[i] = evaluateOmaha(pr.known[i] as Card[], b);
    acc.settle();
  };
  if (need === 0) { run(); return acc.result(true); }
  const n = deck.length;
  while (true) {
    run();
    let i = need - 1;
    while (i >= 0 && idx[i] === n - need + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < need; j++) idx[j] = idx[j - 1] + 1;
  }
  return acc.result(true);
}

function defaultSamples(players: number, holeSize: number): number {
  const perSample = players * (holeSize === 5 ? 10 : 6) * 10;
  return Math.max(10_000, Math.min(60_000, Math.floor(MC_EVAL_BUDGET / perSample)));
}

/** Un lot de tirages Monte-Carlo accumulés dans `acc`. */
function mcBatch(pr: Prepared, acc: Acc, samples: number, rng: () => number) {
  const p = pr.known.length, hs = pr.holeSize;
  const deck = pr.deck; // paquet de travail persistant entre les lots (reproductible)
  const n = deck.length;
  const draw = pr.boardNeed + pr.nRandom * hs;
  const b = new Array<Card>(5);
  for (let i = 0; i < pr.board.length; i++) b[i] = pr.board[i];
  const holes: Card[][] = pr.known.map((k) => (k ? k : new Array<Card>(hs)));
  for (let s = 0; s < samples; s++) {
    // Fisher-Yates partiel
    for (let i = 0; i < draw; i++) {
      const j = i + Math.floor(rng() * (n - i));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    let k = 0;
    for (let i = pr.board.length; i < 5; i++) b[i] = deck[k++];
    for (let i = 0; i < p; i++) if (!pr.known[i]) for (let h = 0; h < hs; h++) holes[i][h] = deck[k++];
    for (let i = 0; i < p; i++) acc.scores[i] = evaluateOmaha(holes[i], b);
    acc.settle();
  }
}

/** Calcul synchrone (tests, scripts). */
export function computeOmahaEquity(hands: OmahaHand[], board: Card[], opts: OmahaOptions = {}): OmahaResult {
  const pr = prepare(hands, board, opts);
  const budget = opts.exactBudget ?? DEFAULT_EXACT_BUDGET;
  if (exactCost(hands, board, pr.holeSize as 4 | 5) <= budget) return enumerateExact(pr);
  const acc = new Acc(hands.length);
  mcBatch(pr, acc, opts.mcSamples ?? defaultSamples(hands.length, pr.holeSize), opts.rng ?? Math.random);
  return acc.result(false);
}

/** Calcul asynchrone pour l'UI : Monte-Carlo par paquets (setTimeout) pour rester réactif. */
export function computeOmahaEquityAsync(
  hands: OmahaHand[],
  board: Card[],
  opts: OmahaOptions & { batch?: number; onProgress?: (r: OmahaResult) => void } = {},
): Promise<OmahaResult> {
  let pr: Prepared;
  try { pr = prepare(hands, board, opts); } catch (e) { return Promise.reject(e); }
  const budget = opts.exactBudget ?? DEFAULT_EXACT_BUDGET;
  if (exactCost(hands, board, pr.holeSize as 4 | 5) <= budget) return Promise.resolve(enumerateExact(pr));
  const total = opts.mcSamples ?? defaultSamples(hands.length, pr.holeSize);
  const batch = opts.batch ?? 2_000;
  const rng = opts.rng ?? Math.random;
  const acc = new Acc(hands.length);
  return new Promise((resolve) => {
    const step = () => {
      mcBatch(pr, acc, Math.min(batch, total - acc.n), rng);
      if (acc.n >= total) resolve(acc.result(false));
      else { opts.onProgress?.(acc.result(false)); setTimeout(step, 0); }
    };
    step();
  });
}
