// Widget « calculateur ICM » — bilingue (data-lang), 100 % client-side.
// Entrées : prix par place + tapis (2 à 10 joueurs) + « moi ».
// Sorties : espérance ICM par joueur ($ et % du prize pool) ; pour « moi », équité requise
// pour un tapis contre chaque adversaire (bubble factor), comparée aux 50 % du chip-EV.
import { icmEquities, allInRisk, MAX_PLAYERS } from "../icm/icm";

type Lang = "fr" | "en";
const STR = {
  fr: {
    payouts: "Prix par place (1re, 2e, 3e…)", payoutsHint: "Montants ou pourcentages, séparés par des espaces ou des virgules.",
    players: "Tapis des joueurs", player: (i: number) => `Joueur ${i}`, stack: "Tapis", me: "C'est moi",
    add: "+ Ajouter un joueur", remove: "Retirer", removeLabel: (i: number) => `Retirer le joueur ${i}`,
    presets: "Exemples", pBubble: "Bulle (4 joueurs, 3 payés)", pFt: "Table finale (6 joueurs)", pSat: "Satellite (5 joueurs, 4 tickets)",
    thPlayer: "Joueur", thStack: "Tapis", thChips: "% des jetons", thIcm: "Valeur ICM", thPool: "% des prix",
    you: "toi", total: "Total",
    riskTitle: "Ton risque à tapis", riskIntro: "Équité minimale pour payer (ou pousser) un tapis contre chaque adversaire, sans argent mort au milieu. En chip-EV, ce serait 50 %.",
    thVs: "Contre", thEff: "Jetons en jeu", thReq: "Équité requise", thBf: "Bubble factor",
    err: "Entre au moins un prix et au moins deux tapis supérieurs à 0.",
    tooMany: `Maximum ${MAX_PLAYERS} joueurs.`,
    decimal: ",",
  },
  en: {
    payouts: "Payouts by place (1st, 2nd, 3rd…)", payoutsHint: "Amounts or percentages, separated by spaces or commas.",
    players: "Player stacks", player: (i: number) => `Player ${i}`, stack: "Stack", me: "This is me",
    add: "+ Add a player", remove: "Remove", removeLabel: (i: number) => `Remove player ${i}`,
    presets: "Examples", pBubble: "Bubble (4 left, 3 paid)", pFt: "Final table (6 players)", pSat: "Satellite (5 left, 4 seats)",
    thPlayer: "Player", thStack: "Stack", thChips: "% of chips", thIcm: "ICM value", thPool: "% of prizes",
    you: "you", total: "Total",
    riskTitle: "Your all-in risk", riskIntro: "Minimum equity to call (or shove) an all-in against each opponent, with no dead money in the pot. In chip-EV it would be 50%.",
    thVs: "Against", thEff: "Chips at risk", thReq: "Required equity", thBf: "Bubble factor",
    err: "Enter at least one payout and at least two stacks above 0.",
    tooMany: `Maximum ${MAX_PLAYERS} players.`,
    decimal: ".",
  },
};

const PRESETS: Record<string, { payouts: string; stacks: number[]; me: number }> = {
  bubble: { payouts: "50 30 20", stacks: [4000, 3000, 2000, 1000], me: 1 },
  ft: { payouts: "30 20 15 13 12 10", stacks: [12000, 9000, 7000, 5000, 4000, 3000], me: 2 },
  sat: { payouts: "1 1 1 1", stacks: [3000, 2500, 2000, 1500, 1000], me: 1 },
};

export function parsePayouts(s: string): number[] {
  // « 50 30 20 », « 50; 30; 20 », « 50, 30, 20 » → séparateurs = espaces/« ; » (virgule = décimale : « 12,5 »)
  // « 50,30,20 » (aucun espace) → séparateur = virgule
  const t = s.trim().replace(/,\s+/g, " ");
  const parts = /[\s;]/.test(t) ? t.split(/[\s;]+/) : t.split(",");
  return parts.map((x) => parseFloat(x.replace("%", "").replace(",", ".")))
    .filter((x) => isFinite(x) && x >= 0);
}

export function mountIcm(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  const fmt = (x: number, d = 2) => x.toFixed(d).replace(".", s.decimal);
  const pct = (x: number, d = 1) => `${fmt(x * 100, d)}${lang === "fr" ? " %" : "%"}`;
  let stacks = PRESETS.bubble.stacks.slice();
  let me = PRESETS.bubble.me;

  root.innerHTML = `
    <div class="pp-calc po icm">
      <div class="icm-presets" role="group" aria-label="${s.presets}">
        <span>${s.presets}${lang === "fr" ? "&nbsp;:" : ":"}</span>
        <button type="button" class="ctl" data-preset="bubble">${s.pBubble}</button>
        <button type="button" class="ctl" data-preset="ft">${s.pFt}</button>
        <button type="button" class="ctl" data-preset="sat">${s.pSat}</button>
      </div>
      <label class="icm-pay">${s.payouts}
        <input type="text" id="icm-pay" inputmode="decimal" autocomplete="off" aria-describedby="icm-pay-hint">
      </label>
      <p class="sub" id="icm-pay-hint">${s.payoutsHint}</p>
      <fieldset class="po-eq"><legend>${s.players}</legend>
        <div id="icm-rows"></div>
        <button type="button" class="ctl" id="icm-add">${s.add}</button>
      </fieldset>
      <div id="icm-out" aria-live="polite"></div>
    </div>`;

  const payIn = root.querySelector("#icm-pay") as HTMLInputElement;
  const rowsEl = root.querySelector("#icm-rows") as HTMLElement;
  const out = root.querySelector("#icm-out") as HTMLElement;
  const addBtn = root.querySelector("#icm-add") as HTMLButtonElement;
  payIn.value = PRESETS.bubble.payouts;

  function drawRows() {
    rowsEl.innerHTML = stacks.map((v, i) => `
      <div class="icm-row">
        <label>${s.player(i + 1)} — ${s.stack}<input type="number" min="0" step="any" inputmode="decimal" data-i="${i}" value="${v}"></label>
        <label class="icm-me"><input type="radio" name="icm-me" value="${i}" ${i === me ? "checked" : ""}> ${s.me}</label>
        ${stacks.length > 2 ? `<button type="button" class="ctl icm-del" data-del="${i}" aria-label="${s.removeLabel(i + 1)}">${s.remove}</button>` : ""}
      </div>`).join("");
    addBtn.disabled = stacks.length >= MAX_PLAYERS;
    addBtn.title = addBtn.disabled ? s.tooMany : "";
  }

  function render() {
    const payouts = parsePayouts(payIn.value);
    const alive = stacks.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
    if (payouts.length === 0 || payouts.every((p) => p === 0) || alive.length < 2) {
      out.innerHTML = `<p class="calc">${s.err}</p>`; return;
    }
    const st = alive.map((x) => x.v);
    const eq = icmEquities(st, payouts);
    const chips = st.reduce((a, b) => a + b, 0);
    const pool = payouts.slice(0, st.length).reduce((a, b) => a + b, 0);
    const meK = alive.findIndex((x) => x.i === me);
    let html = `<div class="odds-scroll" role="region" aria-label="${s.thIcm}" tabindex="0"><table class="num icm-table">
      <thead><tr><th scope="col">${s.thPlayer}</th><th scope="col">${s.thStack}</th><th scope="col">${s.thChips}</th><th scope="col">${s.thIcm}</th><th scope="col">${s.thPool}</th></tr></thead><tbody>`;
    alive.forEach((x, k) => {
      const isMe = k === meK;
      html += `<tr${isMe ? ' class="me"' : ""}><th scope="row">${s.player(x.i + 1)}${isMe ? ` <span class="tag">(${s.you})</span>` : ""}</th>
        <td>${x.v.toLocaleString(lang)}</td><td>${pct(x.v / chips)}</td><td><strong>${fmt(eq[k])}</strong></td><td>${pct(eq[k] / pool)}</td></tr>`;
    });
    html += `<tr class="total"><th scope="row">${s.total}</th><td>${chips.toLocaleString(lang)}</td><td>${pct(1, 0)}</td><td>${fmt(pool)}</td><td>${pct(1, 0)}</td></tr></tbody></table></div>`;

    if (meK >= 0) {
      html += `<h3 class="icm-h">${s.riskTitle}</h3><p class="sub">${s.riskIntro}</p>
        <div class="odds-scroll" role="region" aria-label="${s.riskTitle}" tabindex="0"><table class="num icm-table">
        <thead><tr><th scope="col">${s.thVs}</th><th scope="col">${s.thEff}</th><th scope="col">${s.thReq}</th><th scope="col">${s.thBf}</th></tr></thead><tbody>`;
      alive.forEach((x, k) => {
        if (k === meK) return;
        const r = allInRisk(st, payouts, meK, k);
        const bf = isFinite(r.bubbleFactor) ? fmt(r.bubbleFactor, 2) : "∞";
        html += `<tr><th scope="row">${s.player(x.i + 1)}</th><td>${r.effective.toLocaleString(lang)}</td><td><strong>${pct(r.requiredEquity)}</strong></td><td>${bf}</td></tr>`;
      });
      html += `</tbody></table></div>`;
    }
    out.innerHTML = html;
  }

  root.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.dataset.i !== undefined) { const v = parseFloat(t.value.replace(",", ".")); stacks[+t.dataset.i] = isFinite(v) ? v : 0; }
    render();
  });
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === "icm-me") { me = +t.value; render(); }
  });
  root.addEventListener("click", (e) => {
    const t = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!t) return;
    if (t.dataset.preset) {
      const p = PRESETS[t.dataset.preset]; stacks = p.stacks.slice(); me = p.me; payIn.value = p.payouts;
    } else if (t.id === "icm-add" && stacks.length < MAX_PLAYERS) {
      stacks.push(stacks[stacks.length - 1] || 1000);
    } else if (t.dataset.del !== undefined) {
      const i = +t.dataset.del; stacks.splice(i, 1);
      if (me === i) me = 0; else if (me > i) me--;
    } else return;
    drawRows(); render();
  });

  drawRows();
  render();
}

const target = typeof document !== "undefined" && document.getElementById("icm-calculator");
if (target) {
  const lang = ((target as HTMLElement).dataset.lang === "en" ? "en" : "fr") as Lang;
  mountIcm(target as HTMLElement, lang);
}
