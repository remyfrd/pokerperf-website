// Widget « calculateur de side pots » — bilingue (data-lang fr/en), 100 % client-side.
// Entrées : par joueur (ordre des sièges depuis la gauche du bouton) le total misé dans la main,
// couché ou non, et optionnellement le classement au showdown.
// Sorties : mise non payée rendue, pot principal + side pots (montant, qui peut les gagner),
// et si le classement est complet : gagnants, gains et résultat net de chacun.
import { computeSidePots, SidePotPlayer } from "../sidepot/sidepot";

type Lang = "fr" | "en";
const MAX = 10;
const STR = {
  fr: {
    presets: "Exemples", pBasic: "Classique (4 joueurs)", pJams: "3 tapis + un appel", pFold: "Avec un joueur couché", pSplit: "Partage",
    players: "Joueurs (dans l'ordre des sièges, à partir de la gauche du bouton)",
    player: (i: number) => `Joueur ${i}`, playersN: "Joueurs", bet: "Total misé dans la main", folded: "Couché",
    rank: "Showdown", rankNone: "—", rankOpt: (r: number) => (r === 1 ? "1re main" : `${r}e main`),
    rankHint: "Optionnel : classe les mains au showdown (1 = meilleure ; même rang = égalité) pour voir qui gagne quoi.",
    unit: "Plus petite unité (jeton indivisible)",
    add: "+ Ajouter un joueur", remove: "Retirer", removeLabel: (i: number) => `Retirer le joueur ${i}`,
    refund: (p: string, a: string) => `Mise non payée : <strong>${a}</strong> rendus à ${p} (personne n'a payé cette partie de sa mise).`,
    thPot: "Pot", main: "Pot principal", side: (k: number) => `Side pot ${k}`, thAmount: "Montant", thEligible: "Qui peut le gagner", thWinner: "Gagnant(s)",
    total: "Total au milieu", only: "seul",
    thPlayer: "Joueur", thBet: "Misé", thBack: "Récupère", thNet: "Résultat",
    noRank: "Classe toutes les mains encore en jeu (menu « Showdown ») pour voir qui remporte chaque pot.",
    err: "Entre au moins deux joueurs, dont un pas couché, avec des mises de 0 ou plus.",
    and: " et ", colon: "&nbsp;:",
  },
  en: {
    presets: "Examples", pBasic: "Classic (4 players)", pJams: "3 all-ins + a call", pFold: "With a folded player", pSplit: "Split pot",
    players: "Players (in seat order, starting left of the button)",
    player: (i: number) => `Player ${i}`, playersN: "Players", bet: "Total put in this hand", folded: "Folded",
    rank: "Showdown", rankNone: "—", rankOpt: (r: number) => (r === 1 ? "1st best" : r === 2 ? "2nd best" : r === 3 ? "3rd best" : `${r}th best`),
    rankHint: "Optional: rank the hands at showdown (1 = best; same rank = tie) to see who wins what.",
    unit: "Smallest unit (odd chip)",
    add: "+ Add a player", remove: "Remove", removeLabel: (i: number) => `Remove player ${i}`,
    refund: (p: string, a: string) => `Uncalled bet: <strong>${a}</strong> returned to ${p} (nobody called that part of the bet).`,
    thPot: "Pot", main: "Main pot", side: (k: number) => `Side pot ${k}`, thAmount: "Amount", thEligible: "Who can win it", thWinner: "Winner(s)",
    total: "Total in the middle", only: "only",
    thPlayer: "Player", thBet: "Put in", thBack: "Gets back", thNet: "Net result",
    noRank: "Rank every hand still in play (\"Showdown\" menu) to see who wins each pot.",
    err: "Enter at least two players, at least one not folded, with bets of 0 or more.",
    and: " and ", colon: ":",
  },
};

interface Row { bet: number; folded: boolean; rank: number | null }
const PRESETS: Record<string, { rows: Row[]; unit: number }> = {
  basic: { unit: 1, rows: [{ bet: 20, folded: false, rank: 1 }, { bet: 50, folded: false, rank: 2 }, { bet: 100, folded: false, rank: 3 }, { bet: 100, folded: false, rank: 4 }] },
  jams: { unit: 1, rows: [{ bet: 115, folded: false, rank: null }, { bet: 265, folded: false, rank: null }, { bet: 415, folded: false, rank: null }, { bet: 415, folded: false, rank: null }] },
  fold: { unit: 1, rows: [{ bet: 30, folded: false, rank: 2 }, { bet: 60, folded: true, rank: null }, { bet: 100, folded: false, rank: 1 }, { bet: 100, folded: false, rank: 3 }] },
  split: { unit: 1, rows: [{ bet: 25, folded: false, rank: 1 }, { bet: 100, folded: false, rank: 2 }, { bet: 100, folded: false, rank: 2 }, { bet: 40, folded: true, rank: null }] },
};

export function mountSidePot(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  const num = (x: number) => x.toLocaleString(lang === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 2 });
  const signed = (x: number) => (x > 0 ? "+" : x < 0 ? "−" : "") + num(Math.abs(x));
  let rows: Row[] = PRESETS.basic.rows.map((r) => ({ ...r }));

  root.innerHTML = `
    <div class="pp-calc po sp">
      <div class="sp-presets" role="group" aria-label="${s.presets}">
        <span>${s.presets}${s.colon}</span>
        <button type="button" class="ctl" data-preset="basic">${s.pBasic}</button>
        <button type="button" class="ctl" data-preset="jams">${s.pJams}</button>
        <button type="button" class="ctl" data-preset="fold">${s.pFold}</button>
        <button type="button" class="ctl" data-preset="split">${s.pSplit}</button>
      </div>
      <fieldset class="po-eq"><legend>${s.players}</legend>
        <p class="sub" id="sp-rank-hint">${s.rankHint}</p>
        <div id="sp-rows"></div>
        <button type="button" class="ctl" id="sp-add">${s.add}</button>
      </fieldset>
      <label class="sp-unit">${s.unit}
        <input type="number" id="sp-unit" min="0.01" step="any" inputmode="decimal" value="1">
      </label>
      <div id="sp-out" aria-live="polite"></div>
    </div>`;

  const rowsEl = root.querySelector("#sp-rows") as HTMLElement;
  const out = root.querySelector("#sp-out") as HTMLElement;
  const addBtn = root.querySelector("#sp-add") as HTMLButtonElement;
  const unitIn = root.querySelector("#sp-unit") as HTMLInputElement;

  function drawRows() {
    rowsEl.innerHTML = rows.map((r, i) => {
      const opts = [`<option value=""${r.rank === null ? " selected" : ""}>${s.rankNone}</option>`]
        .concat(rows.map((_, k) => `<option value="${k + 1}"${r.rank === k + 1 ? " selected" : ""}>${s.rankOpt(k + 1)}</option>`)).join("");
      return `
      <div class="sp-row">
        <span class="sp-name">${s.player(i + 1)}</span>
        <label class="sp-bet">${s.bet}<input type="number" min="0" step="any" inputmode="decimal" data-i="${i}" value="${r.bet}"></label>
        <label class="sp-fold"><input type="checkbox" data-fold="${i}" ${r.folded ? "checked" : ""}> ${s.folded}</label>
        <label class="sp-rank">${s.rank}<select data-rank="${i}" aria-describedby="sp-rank-hint" ${r.folded ? "disabled" : ""}>${opts}</select></label>
        ${rows.length > 2 ? `<button type="button" class="ctl sp-del" data-del="${i}" aria-label="${s.removeLabel(i + 1)}">${s.remove}</button>` : ""}
      </div>`;
    }).join("");
    addBtn.disabled = rows.length >= MAX;
  }

  // « Joueur 3 » ; « Joueurs 1, 2 et 4 »
  function names(idx: number[]) {
    if (idx.length === 1) return s.player(idx[0] + 1);
    const n = idx.map((i) => String(i + 1));
    return `${s.playersN} ${n.slice(0, -1).join(", ")}${s.and}${n[n.length - 1]}`;
  }

  function render() {
    const unit = parseFloat(unitIn.value.replace(",", "."));
    const players: SidePotPlayer[] = rows.map((r) => ({ bet: r.bet, folded: r.folded, rank: r.folded || r.rank === null ? undefined : r.rank }));
    let res;
    try {
      if (rows.some((r) => !isFinite(r.bet) || r.bet < 0)) throw new Error();
      res = computeSidePots(players, isFinite(unit) && unit > 0 ? unit : 1);
    } catch {
      out.innerHTML = `<p class="calc">${s.err}</p>`; return;
    }
    let html = "";
    if (res.refund) html += `<p class="sp-refund">${s.refund(s.player(res.refund.player + 1), num(res.refund.amount))}</p>`;
    const ranked = !!res.winnings;
    html += `<div class="odds-scroll" role="region" aria-label="${s.thPot}" tabindex="0"><table class="num sp-table">
      <thead><tr><th scope="col">${s.thPot}</th><th scope="col">${s.thAmount}</th><th scope="col">${s.thEligible}</th>${ranked ? `<th scope="col">${s.thWinner}</th>` : ""}</tr></thead><tbody>`;
    res.pots.forEach((p) => {
      const label = p.index === 0 ? s.main : s.side(p.index);
      const elig = p.eligible.length === 1 ? `${names(p.eligible)} (${s.only})` : names(p.eligible);
      html += `<tr><th scope="row">${label}</th><td><strong>${num(p.amount)}</strong></td><td class="sp-names">${elig}</td>${ranked ? `<td class="sp-names">${names(p.winners!)}</td>` : ""}</tr>`;
    });
    html += `<tr class="total"><th scope="row">${s.total}</th><td>${num(res.total)}</td><td></td>${ranked ? "<td></td>" : ""}</tr></tbody></table></div>`;

    if (ranked) {
      html += `<div class="odds-scroll" role="region" aria-label="${s.thNet}" tabindex="0"><table class="num sp-table">
        <thead><tr><th scope="col">${s.thPlayer}</th><th scope="col">${s.thBet}</th><th scope="col">${s.thBack}</th><th scope="col">${s.thNet}</th></tr></thead><tbody>`;
      rows.forEach((r, i) => {
        const back = res.winnings![i] + (res.refund && res.refund.player === i ? res.refund.amount : 0);
        const net = res.net![i];
        html += `<tr${net > 0 ? ' class="win"' : ""}><th scope="row">${s.player(i + 1)}</th><td>${num(r.bet)}</td><td>${num(back)}</td><td><strong>${signed(net)}</strong></td></tr>`;
      });
      html += `</tbody></table></div>`;
    } else {
      html += `<p class="sub">${s.noRank}</p>`;
    }
    out.innerHTML = html;
  }

  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.i !== undefined) { const v = parseFloat(t.value.replace(",", ".")); rows[+t.dataset.i].bet = isFinite(v) ? v : NaN; }
    render();
  });
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement & HTMLSelectElement;
    if (t.dataset.fold !== undefined) {
      const i = +t.dataset.fold; rows[i].folded = t.checked;
      const sel = rowsEl.querySelector(`select[data-rank="${i}"]`) as HTMLSelectElement | null;
      if (sel) sel.disabled = t.checked;
    } else if (t.dataset.rank !== undefined) {
      rows[+t.dataset.rank].rank = t.value === "" ? null : +t.value;
    } else return;
    render();
  });
  root.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!t) return;
    if (t.dataset.preset) {
      const p = PRESETS[t.dataset.preset]; rows = p.rows.map((r) => ({ ...r })); unitIn.value = String(p.unit);
    } else if (t.id === "sp-add" && rows.length < MAX) {
      rows.push({ bet: rows[rows.length - 1]?.bet || 100, folded: false, rank: null });
    } else if (t.dataset.del !== undefined) {
      rows.splice(+t.dataset.del, 1);
      rows.forEach((r) => { if (r.rank !== null && r.rank > rows.length) r.rank = rows.length; });
    } else return;
    drawRows(); render();
  });

  drawRows();
  render();
}

const target = typeof document !== "undefined" && document.getElementById("side-pot-calculator");
if (target) {
  const lang = ((target as HTMLElement).dataset.lang === "en" ? "en" : "fr") as Lang;
  mountSidePot(target as HTMLElement, lang);
}
