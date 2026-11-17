// Moteur « bankroll / risque de ruine » — 100 % client-side, sans dépendance.
//
// CASH GAME — modèle de diffusion (mouvement brownien avec dérive) :
//   dérive μ = winrate (bb/100), volatilité σ = écart-type (bb/100), bankroll B en bb.
//   Risque de ruine sur un horizon infini : RoR = exp(−2·μ·B / σ²) (μ ≤ 0 → 100 %).
//   Bankroll pour un risque cible r : B = −σ²·ln(r) / (2μ).
//   Résultat après N mains ≈ loi normale (moyenne μ·N/100, écart-type σ·√(N/100)).
//   Downswings et ruine sur horizon FINI : simulation Monte-Carlo seedée (blocs de mains).
//
// TOURNOIS / SIT & GO — modèle discret simplifié et assumé :
//   structure de prix type (SnG 9-max 50/30/20, SnG 6-max 65/35, MTT ~15 % payés),
//   le ROI est obtenu en augmentant UNIFORMÉMENT la probabilité de chaque place payée
//   (même multiplicateur pour la 1re et le min-cash), les places non payées absorbent le reste.
//   C'est l'hypothèse la plus prudente côté variance : un vrai gagnant gagne surtout plus de
//   grosses places, donc sa variance réelle est PLUS forte → les bankrolls données sont un minimum.
//   Unité = 1 buy-in (frais compris) : le ROI s'entend comme profit / total misé (comme les trackers).

/* ---------------------------------------------------------------- outils numériques */

/** Fonction de répartition de la loi normale centrée réduite (Abramowitz-Stegun 7.1.26, erreur < 1,5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** Générateur pseudo-aléatoire seedable (mulberry32) → [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tirage normal N(0,1) par Box-Muller (on garde le second tirage). */
export function gaussian(rand: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0;
    while (u === 0) u = rand();
    const v = rand();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** Quantile empirique (q ∈ [0,1]) d'un tableau déjà trié croissant. */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  const pos = Math.min(n - 1, Math.max(0, q * (n - 1)));
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function sortedCopy(a: ArrayLike<number>): Float64Array {
  const s = Float64Array.from(a as ArrayLike<number>);
  s.sort();
  return s;
}

/* ---------------------------------------------------------------- cash game : formules fermées */

/** Risque de ruine (horizon infini). winrate et sd en bb/100, bankroll en bb. */
export function riskOfRuin(winrate: number, sd: number, bankrollBb: number): number {
  if (bankrollBb <= 0) return 1;
  if (winrate <= 0) return 1;
  if (sd <= 0) return 0;
  return Math.exp((-2 * winrate * bankrollBb) / (sd * sd));
}

/** Bankroll (en bb) pour un risque de ruine cible (0 < risk < 1). Infinity si winrate ≤ 0. */
export function requiredBankroll(winrate: number, sd: number, risk: number): number {
  if (winrate <= 0) return Infinity;
  if (risk >= 1) return 0;
  if (risk <= 0) return Infinity;
  return (-(sd * sd) * Math.log(risk)) / (2 * winrate);
}

export interface ResultAfter {
  mean: number; // bb
  sd: number; // bb
  lo95: number; // bb
  hi95: number; // bb
  pLoss: number; // probabilité d'être perdant
  winrateLo95: number; // bb/100 observé, borne basse
  winrateHi95: number; // bb/100 observé, borne haute
}

/** Distribution du résultat après N mains (approximation normale). */
export function resultAfter(winrate: number, sd: number, hands: number): ResultAfter {
  const k = hands / 100;
  const mean = winrate * k;
  const s = sd * Math.sqrt(k);
  const z = 1.959964;
  const pLoss = s > 0 ? normalCdf(-mean / s) : mean < 0 ? 1 : 0;
  const wrHalf = k > 0 ? (z * sd) / Math.sqrt(k) : Infinity;
  return { mean, sd: s, lo95: mean - z * s, hi95: mean + z * s, pLoss, winrateLo95: winrate - wrHalf, winrateHi95: winrate + wrHalf };
}

/* ---------------------------------------------------------------- simulation (cash et tournois) */

export interface SimResult {
  /** Plus bas niveau atteint (résultat cumulé minimal, ≤ 0) par trajectoire — trié croissant. */
  minCum: Float64Array;
  /** Pire baisse depuis un sommet (≥ 0) par trajectoire — trié croissant. */
  maxDrawdown: Float64Array;
  /** Résultat final par trajectoire — trié croissant. */
  final: Float64Array;
}

export interface CashSimOptions {
  winrate: number; // bb/100
  sd: number; // bb/100
  hands: number;
  runs?: number;
  block?: number; // mains par pas (défaut 100)
  seed?: number;
}

/** Marches aléatoires gaussiennes : N mains découpées en blocs, `runs` trajectoires. */
export function simulateCash(o: CashSimOptions): SimResult {
  const runs = o.runs ?? 2000;
  const block = o.block ?? 100;
  const steps = Math.max(1, Math.round(o.hands / block));
  const mu = (o.winrate * block) / 100;
  const sig = o.sd * Math.sqrt(block / 100);
  const g = gaussian(mulberry32(o.seed ?? 12345));
  const minCum = new Float64Array(runs), maxDd = new Float64Array(runs), fin = new Float64Array(runs);
  for (let r = 0; r < runs; r++) {
    let x = 0, peak = 0, mn = 0, dd = 0;
    for (let i = 0; i < steps; i++) {
      x += mu + sig * g();
      if (x > peak) peak = x;
      else if (peak - x > dd) dd = peak - x;
      if (x < mn) mn = x;
    }
    minCum[r] = mn; maxDd[r] = dd; fin[r] = x;
  }
  return { minCum: sortedCopy(minCum), maxDrawdown: sortedCopy(maxDd), final: sortedCopy(fin) };
}

/** Part des trajectoires ruinées : le cumul est descendu sous `threshold` (ex. −B). */
export function ruinShare(minCumSorted: Float64Array, threshold: number): number {
  // nombre d'éléments ≤ threshold (tableau trié croissant) par dichotomie
  let lo = 0, hi = minCumSorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (minCumSorted[m] <= threshold) lo = m + 1; else hi = m; }
  return lo / minCumSorted.length;
}

/* ---------------------------------------------------------------- tournois */

export type TourneyFormat = "sng9" | "sng6" | "mtt";

/**
 * Prix par place en part du prize pool (somme = 1).
 * MTT : ~15 % de payés ; chaque payé reçoit un plancher (1,5 × la mise moyenne du pool),
 * le reste est réparti en 1/k (structure type simplifiée, 1re place ≈ 14 % du pool pour 1 000 joueurs).
 */
export function payoutShares(format: TourneyFormat, field: number): number[] {
  if (format === "sng9") return [0.5, 0.3, 0.2];
  if (format === "sng6") return [0.65, 0.35];
  const n = Math.max(10, Math.round(field));
  const paid = Math.max(1, Math.round(n * 0.15));
  const floor = 1.5 / n; // 1,5 × (pool / n)
  const rest = 1 - floor * paid;
  let h = 0;
  for (let k = 1; k <= paid; k++) h += 1 / k;
  const out: number[] = [];
  for (let k = 1; k <= paid; k++) out.push(floor + (rest * (1 / k)) / h);
  return out;
}

export function fieldSize(format: TourneyFormat, field: number): number {
  return format === "sng9" ? 9 : format === "sng6" ? 6 : Math.max(10, Math.round(field));
}

export interface TourneyModel {
  field: number;
  /** Gain brut par place payée, en buy-ins (frais compris). */
  prizes: number[];
  /** Probabilité de chaque place payée (même valeur pour toutes). */
  pPaidPlace: number;
  /** Probabilité de finir payé. */
  itm: number;
  /** Espérance de profit par tournoi, en buy-ins (= ROI). */
  mean: number;
  /** Écart-type du profit par tournoi, en buy-ins. */
  sd: number;
  /** ROI atteignable maximum avec cette structure (toutes les participations payées). */
  maxRoi: number;
  /** false si le ROI demandé dépasse le maximum (il a alors été plafonné). */
  feasible: boolean;
}

/**
 * Modèle de tournoi : roi (ex. 0.10 = +10 %), rake = part du buy-in prélevée (ex. 0.10).
 * Probabilité de chaque place payée = (1 + a) / N, avec a choisi pour que l'espérance = ROI.
 */
export function tourneyModel(format: TourneyFormat, roi: number, rake: number, field = 1000): TourneyModel {
  const n = fieldSize(format, field);
  const shares = payoutShares(format, n);
  const poolPerEntry = 1 - rake; // le pool vaut n × (1 − rake) buy-ins
  const prizes = shares.map((s) => s * n * poolPerEntry);
  const paid = prizes.length;
  // E[prize] = (1 + a)/n × Σ prizes = (1 + a) × (1 − rake)  →  1 + roi = (1 + a)(1 − rake)
  let lift = (1 + roi) / poolPerEntry; // = 1 + a
  const maxLift = n / paid; // proba de place payée ≤ 1/paid
  const feasible = lift <= maxLift && lift >= 0;
  lift = Math.min(Math.max(lift, 0), maxLift);
  const pPaidPlace = lift / n;
  const itm = pPaidPlace * paid;
  let e = 0, e2 = 0;
  for (const p of prizes) { e += pPaidPlace * p; e2 += pPaidPlace * p * p; }
  const mean = e - 1;
  const varPrize = e2 - e * e;
  return { field: n, prizes, pPaidPlace, itm, mean, sd: Math.sqrt(Math.max(0, varPrize)), maxRoi: maxLift * poolPerEntry - 1, feasible };
}

export interface TourneySimOptions { tournaments: number; runs?: number; seed?: number }

/** Simule `runs` séries de `tournaments` tournois (unité : buy-in). */
export function simulateTourneys(m: TourneyModel, o: TourneySimOptions): SimResult {
  const runs = o.runs ?? 2000;
  const rand = mulberry32(o.seed ?? 4242);
  const paid = m.prizes.length;
  const minCum = new Float64Array(runs), maxDd = new Float64Array(runs), fin = new Float64Array(runs);
  for (let r = 0; r < runs; r++) {
    let x = 0, peak = 0, mn = 0, dd = 0;
    for (let i = 0; i < o.tournaments; i++) {
      const u = rand();
      x -= 1;
      if (u < m.itm) {
        // place payée uniforme parmi les payées (toutes ont la même proba)
        const k = Math.min(paid - 1, Math.floor(u / m.pPaidPlace));
        x += m.prizes[k];
      }
      if (x > peak) peak = x;
      else if (peak - x > dd) dd = peak - x;
      if (x < mn) mn = x;
    }
    minCum[r] = mn; maxDd[r] = dd; fin[r] = x;
  }
  return { minCum: sortedCopy(minCum), maxDrawdown: sortedCopy(maxDd), final: sortedCopy(fin) };
}

/**
 * Tournois : on est ruiné quand il reste moins d'un buy-in (on ne peut plus s'inscrire).
 * Bankroll B (en buy-ins) ruinée si B + minCum < 1.
 */
export function tourneyRuin(sim: SimResult, bankrollBuyins: number): number {
  return ruinShare(sim.minCum, 1 - bankrollBuyins - 1e-9);
}

/** Bankroll (en buy-ins) pour ne pas descendre sous 1 buy-in avec une probabilité ≥ 1 − risk sur l'horizon simulé. */
export function tourneyRequired(sim: SimResult, risk: number): number {
  return Math.max(1, 1 - quantileSorted(sim.minCum, risk));
}

/** Bankroll (en bb) pour un risque cible sur un horizon FINI (simulation cash). */
export function cashRequiredFinite(sim: SimResult, risk: number): number {
  return Math.max(0, -quantileSorted(sim.minCum, risk));
}
