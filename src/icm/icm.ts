// ICM (Independent Chip Model) — modèle de Malmuth-Harville.
// La probabilité qu'un joueur finisse 1er = son tapis / total des tapis ; une fois les
// premiers placés retirés, la même règle s'applique aux restants pour la place suivante.
// Calcul exact par programmation dynamique sur les sous-ensembles « déjà classés »
// (2^n × n opérations : instantané jusqu'à 10 joueurs).

export const MAX_PLAYERS = 10;

/**
 * Espérance de gain de chaque joueur.
 * @param stacks tapis (> 0) des joueurs encore en jeu
 * @param payouts prix par place (1re, 2e, …) ; les places au-delà valent 0
 */
export function icmEquities(stacks: number[], payouts: number[]): number[] {
  const n = stacks.length;
  if (n === 0) return [];
  if (n > MAX_PLAYERS) throw new Error(`ICM : ${MAX_PLAYERS} joueurs maximum.`);
  if (stacks.some((s) => !(s > 0) || !isFinite(s))) throw new Error("ICM : chaque tapis doit être > 0.");
  const paid = Math.min(payouts.length, n);
  const eq = new Array<number>(n).fill(0);
  const total = stacks.reduce((a, b) => a + b, 0);
  const size = 1 << n;
  const prob = new Float64Array(size); // probabilité que « mask » soit exactement l'ensemble des places 1..|mask|
  const sumOf = new Float64Array(size); // somme des tapis de mask
  for (let m = 1; m < size; m++) {
    const low = m & -m;
    sumOf[m] = sumOf[m ^ low] + stacks[31 - Math.clz32(low)];
  }
  prob[0] = 1;
  // parcours par cardinal croissant : m → m|i ne fait que monter, l'ordre numérique suffit
  for (let m = 0; m < size; m++) {
    const p = prob[m];
    if (p === 0) continue;
    let placed = 0;
    for (let x = m; x; x &= x - 1) placed++;
    if (placed >= paid) continue; // plus aucun prix à distribuer
    const rest = total - sumOf[m];
    const prize = payouts[placed] ?? 0;
    for (let i = 0; i < n; i++) {
      if (m & (1 << i)) continue;
      const q = (p * stacks[i]) / rest;
      eq[i] += q * prize;
      prob[m | (1 << i)] += q;
    }
  }
  return eq;
}

/**
 * Espérance avec des tapis pouvant tomber à 0 (joueur éliminé) : les éliminés prennent les
 * dernières places (le plus petit tapis d'origine sort le premier — ici un seul éliminé à la fois).
 */
export function icmWithBusts(stacks: number[], payouts: number[]): number[] {
  const alive = stacks.map((s, i) => [s, i] as const).filter(([s]) => s > 0);
  const busted = stacks.map((s, i) => [s, i] as const).filter(([s]) => !(s > 0));
  const out = new Array<number>(stacks.length).fill(0);
  const eqAlive = icmEquities(alive.map(([s]) => s), payouts);
  alive.forEach(([, i], k) => (out[i] = eqAlive[k]));
  // éliminés : places alive.length+1, alive.length+2, …
  busted.forEach(([, i], k) => (out[i] = payouts[alive.length + k] ?? 0));
  return out;
}

export interface AllInRisk {
  /** joueur adverse */
  villain: number;
  /** jetons en jeu (tapis effectif) */
  effective: number;
  /** espérance actuelle, si je gagne, si je perds */
  ev0: number; evWin: number; evLose: number;
  /** bubble factor = ce que coûte une défaite ÷ ce que rapporte une victoire */
  bubbleFactor: number;
  /** équité minimale pour accepter le tapis sans argent mort (50 % en chip-EV) */
  requiredEquity: number;
}

/** Risque ICM d'un tapis entre `hero` et `villain` (sans argent mort au milieu). */
export function allInRisk(stacks: number[], payouts: number[], hero: number, villain: number): AllInRisk {
  const e = Math.min(stacks[hero], stacks[villain]);
  const ev0 = icmEquities(stacks, payouts)[hero];
  const win = stacks.slice(); win[hero] += e; win[villain] -= e;
  const lose = stacks.slice(); lose[hero] -= e; lose[villain] += e;
  const evWin = icmWithBusts(win, payouts)[hero];
  const evLose = icmWithBusts(lose, payouts)[hero];
  const gain = evWin - ev0, loss = ev0 - evLose;
  const bubbleFactor = gain > 0 ? loss / gain : Infinity;
  const requiredEquity = gain + loss > 0 ? loss / (gain + loss) : 1;
  return { villain, effective: e, ev0, evWin, evLose, bubbleFactor, requiredEquity };
}
