// Moteur « side pots » (pots annexes) — 100 % pur, sans DOM.
//
// Entrée : la liste des joueurs dans l'ORDRE DES SIÈGES en partant du premier joueur à gauche
// du bouton (c'est cet ordre qui reçoit les jetons indivisibles d'un partage), avec pour chacun
// le TOTAL misé dans la main (blindes et toutes les rues comprises) et s'il s'est couché.
// Optionnel : le classement au showdown (1 = meilleure main, égalité = même rang).
//
// Règles appliquées (standard des cardrooms / TDA) :
//  1. Mise non payée : l'excédent du plus gros contributeur sur le 2e plus gros n'a été payé
//     par personne → il lui est rendu, il n'entre dans aucun pot.
//  2. Chaque joueur encore en main ne peut gagner, de chaque adversaire, que ce qu'il a lui-même
//     misé. Les niveaux de mise des joueurs encore en main découpent la masse en pot principal +
//     side pots ; un pot est jouable par tous les joueurs en main qui ont atteint son niveau.
//  3. Les jetons d'un joueur couché restent dans les pots qu'ils ont alimentés, mais il ne peut
//     rien gagner. Si un joueur couché a misé plus que le plus gros joueur en main (cas rare),
//     l'excédent va au dernier pot.
//  4. Partage : chaque pot est divisé à parts égales entre les meilleures mains éligibles ; les
//     jetons indivisibles (plus petite unité) vont un par un aux gagnants dans l'ordre des sièges
//     à partir de la gauche du bouton. Chaque pot est partagé séparément.
//
// Les montants sont convertis en nombre entier d'unités (`unit`, défaut 1) pour éviter les
// erreurs d'arrondi : 12,50 avec unit 0,01 → 1250 unités.

export interface SidePotPlayer {
  /** Total misé dans la main (toutes rues), ≥ 0. */
  bet: number;
  /** Couché : ses jetons restent au milieu mais il ne peut rien gagner. */
  folded?: boolean;
  /** Classement au showdown (1 = meilleur, égalité = même rang). Ignoré si couché. */
  rank?: number;
}

export interface Pot {
  /** 0 = pot principal, 1 = side pot 1… */
  index: number;
  amount: number;
  /** Indices (dans la liste d'entrée) des joueurs qui peuvent gagner ce pot. */
  eligible: number[];
  /** Niveau de mise (par joueur) qui ferme ce pot. */
  cap: number;
  /** Gagnants (si classement fourni). */
  winners?: number[];
}

export interface SidePotResult {
  pots: Pot[];
  /** Mise non payée rendue (joueur + montant), ou null. */
  refund: { player: number; amount: number } | null;
  /** Total au milieu (hors mise rendue). */
  total: number;
  /** Gains par joueur (pots gagnés), si classement fourni pour tous les joueurs en main. */
  winnings?: number[];
  /** Résultat net par joueur = gains + remboursement − mise. */
  net?: number[];
}

export class SidePotError extends Error {}

export function computeSidePots(players: SidePotPlayer[], unit = 1): SidePotResult {
  if (!(unit > 0)) throw new SidePotError("unit");
  if (players.length < 2) throw new SidePotError("players");
  const toU = (x: number) => {
    if (!isFinite(x) || x < 0) throw new SidePotError("bet");
    return Math.round(x / unit);
  };
  const fromU = (u: number) => Math.round(u * unit * 1e6) / 1e6;
  const bets = players.map((p) => toU(p.bet));
  const live = players.map((p, i) => i).filter((i) => !players[i].folded);
  if (live.length === 0) throw new SidePotError("nolive");

  // 1. Mise non payée
  const order = bets.map((b, i) => i).sort((a, b) => bets[b] - bets[a]);
  const top = order[0];
  const second = bets[order[1]];
  let refund: SidePotResult["refund"] = null;
  const eff = bets.slice();
  if (bets[top] > second) {
    refund = { player: top, amount: fromU(bets[top] - second) };
    eff[top] = second;
  }

  // 2. Niveaux des joueurs en main
  const levels = [...new Set(live.map((i) => eff[i]))].filter((l) => l > 0).sort((a, b) => a - b);
  const potsU: { amount: number; eligible: number[]; cap: number }[] = [];
  let prev = 0;
  for (const L of levels) {
    let amount = 0;
    for (let i = 0; i < eff.length; i++) amount += Math.min(eff[i], L) - Math.min(eff[i], prev);
    const eligible = live.filter((i) => eff[i] >= L);
    if (amount > 0) potsU.push({ amount, eligible, cap: L });
    prev = L;
  }
  // 3. Excédent des couchés au-dessus du plus haut niveau en main → dernier pot
  let extra = 0;
  for (let i = 0; i < eff.length; i++) extra += Math.max(0, eff[i] - prev);
  if (extra > 0) {
    if (potsU.length === 0) potsU.push({ amount: 0, eligible: live.slice(), cap: prev });
    potsU[potsU.length - 1].amount += extra;
  }

  const totalU = potsU.reduce((a, p) => a + p.amount, 0);
  const pots: Pot[] = potsU.map((p, k) => ({ index: k, amount: fromU(p.amount), eligible: p.eligible, cap: fromU(p.cap) }));
  const result: SidePotResult = { pots, refund, total: fromU(totalU) };

  // 4. Showdown
  const ranked = live.every((i) => typeof players[i].rank === "number" && isFinite(players[i].rank!));
  if (ranked) {
    const winU = new Array(players.length).fill(0);
    potsU.forEach((p, k) => {
      const best = Math.min(...p.eligible.map((i) => players[i].rank!));
      const winners = p.eligible.filter((i) => players[i].rank === best).sort((a, b) => a - b);
      const share = Math.floor(p.amount / winners.length);
      let odd = p.amount - share * winners.length;
      for (const w of winners) winU[w] += share;
      for (const w of winners) { if (odd <= 0) break; winU[w] += 1; odd--; }
      pots[k].winners = winners;
    });
    result.winnings = winU.map(fromU);
    result.net = winU.map((w, i) => fromU(w + (refund && refund.player === i ? bets[i] - eff[i] : 0) - bets[i]));
  }
  return result;
}

/**
 * Équité requise pour payer quand on ne peut gagner qu'une partie de la masse :
 * appel ÷ (total des pots que l'on peut gagner, appel compris). C'est l'approximation
 * « même équité dans tous les pots » ; en réalité on a plus de chances de gagner un side pot
 * (moins d'adversaires) que le pot principal.
 */
export function requiredEquity(call: number, winnable: number): number {
  return winnable > 0 ? call / winnable : 1;
}
