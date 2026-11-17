// Widget « calculateur de bankroll / risque de ruine » — bilingue (data-lang fr|en), 100 % client-side.
// Mode cash : formule fermée (horizon infini) + simulation (downswings, ruine sur l'horizon choisi).
// Mode tournois : modèle discret simplifié (voir src/bankroll/bankroll.ts) + simulation.
import {
  riskOfRuin, requiredBankroll, resultAfter, simulateCash, ruinShare, quantileSorted,
  tourneyModel, simulateTourneys, tourneyRuin, tourneyRequired, type TourneyFormat,
} from "../bankroll/bankroll";

type Lang = "fr" | "en";
const STR = {
  fr: {
    mode: "Format", cash: "Cash game", tourney: "Tournois / Sit & Go",
    wr: "Winrate (bb/100)", wrHint: "Ton gain moyen pour 100 mains. Repère : 2 à 5 = bon gagnant en ligne.",
    sd: "Écart-type (bb/100)", sdHint: "Ta volatilité. Repère : 70 à 100 en 6-max NL (90 par défaut), un peu moins en full ring.",
    br: "Bankroll (caves de 100 bb)", hands: "Horizon (mains)", handsHint: "Pour les downswings et la ruine « sur la période ».",
    fmt: "Format", sng9: "Sit & Go 9 joueurs (3 payés)", sng6: "Sit & Go 6 joueurs (2 payés)", mtt: "Tournoi MTT (~15 % payés)",
    field: "Nombre d'inscrits", roi: "ROI (%)", roiHint: "Profit ÷ total misé, comme dans les trackers. Repère : +5 à +10 % en SnG, +10 à +30 % en MTT pour un bon gagnant.",
    rake: "Rake (% du buy-in)", brT: "Bankroll (en buy-ins)", nT: "Horizon (tournois)", amount: "Montant d'un buy-in (optionnel)",
    rorInf: "Risque de ruine (à long terme)", rorH: (h: string) => `Risque de ruine sur ${h} mains`,
    req5: "Bankroll pour 5 % de risque", req1: "Bankroll pour 1 % de risque",
    after: (h: string) => `Après ${h} mains`, exp: "Résultat moyen", range95: "Fourchette à 95 %", pLoss: "Probabilité d'être perdant",
    obsWr: "Winrate observé (95 %)", ddMed: "Pire downswing, cas typique (médiane)", dd90: "Pire downswing, 1 fois sur 10",
    itm: "Places payées (ITM)", sdT: "Écart-type par tournoi", rorT: (n: string) => `Risque de ruine sur ${n} tournois`,
    reqT5: (n: string) => `Bankroll pour 5 % de risque (${n} tournois)`, reqT1: (n: string) => `Bankroll pour 1 % de risque (${n} tournois)`,
    pLossT: (n: string) => `Probabilité d'être perdant après ${n} tournois`, ddT: "Pire downswing, cas typique (médiane)",
    caves: (x: string) => `${x} caves`, bi: (x: string) => `${x} buy-ins`, bb: (x: string) => `${x} bb`,
    never: "jamais (winrate ≤ 0)", certain: "100 % (winrate ≤ 0 : la ruine est certaine à long terme)",
    infeasible: (max: string) => `ROI impossible avec ce format : plafonné à ${max} (toutes tes places seraient payées).`,
    summaryCash: (ror: string, r5: string) => `Risque de ruine à long terme : ${ror}. Bankroll pour 5 % de risque : ${r5}.`,
    summaryT: (ror: string, r5: string) => `Risque de ruine sur l'horizon : ${ror}. Bankroll pour 5 % de risque : ${r5}.`,
    simNote: (n: string) => `Downswings et ruine sur la période : simulation de ${n} trajectoires (approximation, change légèrement selon le tirage).`,
    modelNoteT: "Modèle simplifié : ton avantage augmente de la même façon la probabilité de chaque place payée. Un vrai gagnant gagne surtout plus de grosses places, donc sa variance est plus forte : prends ces bankrolls comme un minimum.",
    err: "Entre des valeurs positives (écart-type, bankroll, horizon).",
    decimal: ",", pctSp: " %",
  },
  en: {
    mode: "Format", cash: "Cash game", tourney: "Tournaments / Sit & Go",
    wr: "Win rate (bb/100)", wrHint: "Your average profit per 100 hands. Benchmark: 2 to 5 is a solid online winner.",
    sd: "Standard deviation (bb/100)", sdHint: "Your volatility. Benchmark: 70 to 100 in 6-max NL (90 by default), a bit less at full ring.",
    br: "Bankroll (100bb buy-ins)", hands: "Horizon (hands)", handsHint: "Used for downswings and risk of ruin over that period.",
    fmt: "Format", sng9: "9-max Sit & Go (3 paid)", sng6: "6-max Sit & Go (2 paid)", mtt: "MTT (~15% paid)",
    field: "Field size", roi: "ROI (%)", roiHint: "Profit ÷ total buy-ins, as trackers report it. Benchmark: +5 to +10% in SnGs, +10 to +30% in MTTs for a good winner.",
    rake: "Rake (% of buy-in)", brT: "Bankroll (buy-ins)", nT: "Horizon (tournaments)", amount: "Buy-in amount (optional)",
    rorInf: "Risk of ruin (long run)", rorH: (h: string) => `Risk of ruin over ${h} hands`,
    req5: "Bankroll for 5% risk", req1: "Bankroll for 1% risk",
    after: (h: string) => `After ${h} hands`, exp: "Average result", range95: "95% range", pLoss: "Chance of being down",
    obsWr: "Observed win rate (95%)", ddMed: "Worst downswing, typical (median)", dd90: "Worst downswing, 1 time in 10",
    itm: "In the money (ITM)", sdT: "Standard deviation per tournament", rorT: (n: string) => `Risk of ruin over ${n} tournaments`,
    reqT5: (n: string) => `Bankroll for 5% risk (${n} tournaments)`, reqT1: (n: string) => `Bankroll for 1% risk (${n} tournaments)`,
    pLossT: (n: string) => `Chance of being down after ${n} tournaments`, ddT: "Worst downswing, typical (median)",
    caves: (x: string) => `${x} buy-ins`, bi: (x: string) => `${x} buy-ins`, bb: (x: string) => `${x}bb`,
    never: "never (win rate ≤ 0)", certain: "100% (win rate ≤ 0: ruin is certain in the long run)",
    infeasible: (max: string) => `ROI not possible in this format: capped at ${max} (you would cash every time).`,
    summaryCash: (ror: string, r5: string) => `Long-run risk of ruin: ${ror}. Bankroll for 5% risk: ${r5}.`,
    summaryT: (ror: string, r5: string) => `Risk of ruin over the horizon: ${ror}. Bankroll for 5% risk: ${r5}.`,
    simNote: (n: string) => `Downswings and risk over the period: ${n} simulated runs (approximate, varies slightly between draws).`,
    modelNoteT: "Simplified model: your edge raises the probability of every paid place by the same factor. Real winners mostly win more big finishes, so their variance is higher: treat these bankrolls as a minimum.",
    err: "Enter positive values (standard deviation, bankroll, horizon).",
    decimal: ".", pctSp: "%",
  },
};

const MAX_DRAWS = 3_000_000; // budget de tirages aléatoires par recalcul (fluidité mobile)

export function mountBankroll(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  const loc = lang === "fr" ? "fr-FR" : "en-US";
  const num = (x: number, d = 0) => x.toLocaleString(loc, { minimumFractionDigits: d, maximumFractionDigits: d });
  const pct = (p: number) => {
    if (p <= 0) return `0${s.pctSp}`;
    if (p >= 0.9995 && p <= 1) return `100${s.pctSp}`;
    if (p > 0 && p < 0.001) return `< 0${s.decimal}1${s.pctSp}`;
    return `${num(p * 100, p < 0.1 ? 1 : 0)}${s.pctSp}`;
  };

  root.innerHTML = `
    <div class="pp-calc po br">
      <fieldset class="br-mode"><legend>${s.mode}</legend>
        <div class="po-modes">
          <label><input type="radio" name="br-mode" value="cash" checked> ${s.cash}</label>
          <label><input type="radio" name="br-mode" value="tourney"> ${s.tourney}</label>
        </div>
      </fieldset>
      <div id="br-cash">
        <div class="po-row">
          <label>${s.wr}<input type="number" id="br-wr" step="0.5" inputmode="decimal" value="5" aria-describedby="br-wr-h"></label>
          <label>${s.sd}<input type="number" id="br-sd" min="1" step="5" inputmode="decimal" value="90" aria-describedby="br-sd-h"></label>
        </div>
        <p class="sub" id="br-wr-h">${s.wrHint}</p>
        <p class="sub" id="br-sd-h">${s.sdHint}</p>
        <div class="po-row br-gap">
          <label>${s.br}<input type="number" id="br-caves" min="0" step="1" inputmode="decimal" value="20"></label>
          <label>${s.hands}<input type="number" id="br-hands" min="1000" step="10000" inputmode="numeric" value="100000" aria-describedby="br-hands-h"></label>
        </div>
        <p class="sub" id="br-hands-h">${s.handsHint}</p>
      </div>
      <div id="br-tourney" hidden>
        <div class="po-row">
          <label>${s.fmt}<select id="br-fmt">
            <option value="sng9">${s.sng9}</option><option value="sng6">${s.sng6}</option><option value="mtt" selected>${s.mtt}</option>
          </select></label>
          <label id="br-field-l">${s.field}<input type="number" id="br-field" min="10" max="20000" step="10" inputmode="numeric" value="1000"></label>
        </div>
        <div class="po-row br-gap">
          <label>${s.roi}<input type="number" id="br-roi" step="1" inputmode="decimal" value="20" aria-describedby="br-roi-h"></label>
          <label>${s.rake}<input type="number" id="br-rake" min="0" max="30" step="1" inputmode="decimal" value="10"></label>
        </div>
        <p class="sub" id="br-roi-h">${s.roiHint}</p>
        <div class="po-row br-gap">
          <label>${s.brT}<input type="number" id="br-bi" min="1" step="10" inputmode="decimal" value="100"></label>
          <label>${s.nT}<input type="number" id="br-nt" min="10" max="20000" step="100" inputmode="numeric" value="1000"></label>
          <label>${s.amount}<input type="number" id="br-amt" min="0" step="any" inputmode="decimal" placeholder="—"></label>
        </div>
      </div>
      <p class="sr-only" id="br-live" aria-live="polite" aria-atomic="true"></p>
      <div id="br-out" class="po-out"></div>
    </div>`;

  const $ = (id: string) => root.querySelector("#" + id) as HTMLInputElement;
  const val = (id: string) => { const v = parseFloat(($(id).value || "").replace(",", ".")); return isFinite(v) ? v : NaN; };
  const out = root.querySelector("#br-out") as HTMLElement;
  const live = root.querySelector("#br-live") as HTMLElement;
  const row = (label: string, value: string, strong = true) =>
    `<div class="po-big${strong ? "" : " br-sec"}"><span>${label}</span><strong>${value}</strong></div>`;

  function renderCash() {
    const wr = val("br-wr"), sd = val("br-sd"), caves = val("br-caves"), hands = Math.round(val("br-hands"));
    if (!isFinite(wr) || !(sd > 0) || !(caves >= 0) || !(hands >= 100)) { out.innerHTML = `<p class="calc">${s.err}</p>`; live.textContent = ""; return; }
    const B = caves * 100;
    const ror = riskOfRuin(wr, sd, B);
    const r5 = requiredBankroll(wr, sd, 0.05), r1 = requiredBankroll(wr, sd, 0.01);
    const cv = (bb: number) => isFinite(bb) ? s.caves(num(bb / 100, bb < 1000 ? 1 : 0)) : s.never;
    const ra = resultAfter(wr, sd, hands);
    const steps = Math.max(1, Math.round(hands / 100));
    const runs = Math.max(300, Math.min(2000, Math.floor(MAX_DRAWS / steps)));
    const sim = simulateCash({ winrate: wr, sd, hands, runs, seed: 2026 });
    const rorH = ruinShare(sim.minCum, -B);
    const h = num(hands);
    let html = `<div class="br-key">`;
    html += row(s.rorInf, wr <= 0 ? s.certain : pct(ror));
    html += row(s.rorH(h), pct(rorH));
    html += row(s.req5, cv(r5));
    html += row(s.req1, cv(r1));
    html += `</div><h3 class="br-h">${s.after(h)}</h3>`;
    html += row(s.exp, s.bb(num(ra.mean)), false);
    html += row(s.range95, `${s.bb(num(ra.lo95))} → ${s.bb(num(ra.hi95))}`, false);
    html += row(s.pLoss, pct(ra.pLoss), false);
    html += row(s.obsWr, `${num(ra.winrateLo95, 1)} → ${num(ra.winrateHi95, 1)} bb/100`, false);
    html += row(s.ddMed, `${s.bb(num(quantileSorted(sim.maxDrawdown, 0.5)))} (${s.caves(num(quantileSorted(sim.maxDrawdown, 0.5) / 100))})`, false);
    html += row(s.dd90, `${s.bb(num(quantileSorted(sim.maxDrawdown, 0.9)))} (${s.caves(num(quantileSorted(sim.maxDrawdown, 0.9) / 100))})`, false);
    html += `<p class="sub br-note">${s.simNote(num(runs))}</p>`;
    out.innerHTML = html;
    live.textContent = s.summaryCash(wr <= 0 ? s.certain : pct(ror), cv(r5));
  }

  function renderTourney() {
    const fmt = (root.querySelector("#br-fmt") as HTMLSelectElement).value as TourneyFormat;
    const field = Math.round(val("br-field")), roi = val("br-roi") / 100, rake = val("br-rake") / 100;
    const bi = val("br-bi"), nt = Math.round(val("br-nt")), amt = val("br-amt");
    (root.querySelector("#br-field-l") as HTMLElement).hidden = fmt !== "mtt";
    if (!isFinite(roi) || !(rake >= 0 && rake < 0.5) || !(bi >= 1) || !(nt >= 10) || (fmt === "mtt" && !(field >= 10))) {
      out.innerHTML = `<p class="calc">${s.err}</p>`; live.textContent = ""; return;
    }
    const m = tourneyModel(fmt, roi, rake, Math.min(field, 20000));
    const ntc = Math.min(nt, 20000);
    const runs = Math.max(300, Math.min(3000, Math.floor(MAX_DRAWS / ntc)));
    const sim = simulateTourneys(m, { tournaments: ntc, runs, seed: 4242 });
    const ror = tourneyRuin(sim, bi);
    const q5 = tourneyRequired(sim, 0.05), q1 = tourneyRequired(sim, 0.01);
    const money = (x: number) => (amt > 0 ? ` · ${num(x * amt)}` : "");
    const biTxt = (x: number) => `${s.bi(num(x))}${money(x)}`;
    const n = num(ntc);
    const dd = quantileSorted(sim.maxDrawdown, 0.5);
    let html = "";
    if (!m.feasible) html += `<p class="calc br-warn" role="note">${s.infeasible(`${num(m.maxRoi * 100)}${s.pctSp}`)}</p>`;
    html += `<div class="br-key">`;
    html += row(s.rorT(n), pct(ror));
    html += row(s.reqT5(n), biTxt(q5));
    html += row(s.reqT1(n), biTxt(q1));
    html += `</div>`;
    html += row(s.itm, pct(m.itm), false);
    html += row(s.sdT, s.bi(num(m.sd, 1)), false);
    html += row(s.pLossT(n), pct(ruinShare(sim.final, 0)), false);
    html += row(s.ddT, biTxt(Math.round(dd)), false);
    html += `<p class="sub br-note">${s.modelNoteT}</p><p class="sub br-note">${s.simNote(num(runs))}</p>`;
    out.innerHTML = html;
    live.textContent = s.summaryT(pct(ror), biTxt(q5));
  }

  let mode: "cash" | "tourney" = "cash";
  let timer: number | undefined;
  const render = () => (mode === "cash" ? renderCash() : renderTourney());
  const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(render, 180) as unknown as number; };

  root.addEventListener("input", schedule);
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === "br-mode") {
      mode = t.value === "tourney" ? "tourney" : "cash";
      (root.querySelector("#br-cash") as HTMLElement).hidden = mode !== "cash";
      (root.querySelector("#br-tourney") as HTMLElement).hidden = mode !== "tourney";
      render();
    } else schedule();
  });
  render();
}

const target = typeof document !== "undefined" && document.getElementById("bankroll-calculator");
if (target) {
  const lang = ((target as HTMLElement).dataset.lang === "en" ? "en" : "fr") as Lang;
  mountBankroll(target as HTMLElement, lang);
}
