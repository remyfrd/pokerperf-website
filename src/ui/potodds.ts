// Widget « cote du pot » (pot odds) — arithmétique client-side, bilingue (data-lang).
// Entrées : pot, mise à suivre ; sorties : cote (ratio), équité requise ;
// + verdict payer/coucher et EV si on fournit son équité (directe ou via outs → règle 4/2).
type Lang = "fr" | "en";
interface S {
  pot: string; bet: string; required: string; odds: string; ratioSuffix: string;
  need: (x: string) => string;
  compare: string; eqPct: string; eqOuts: string; outs: string; street: string;
  flop: string; turn: string; estEq: (x: string) => string;
  verdictCall: string; verdictFold: string; ev: string; enterNums: string;
}
const STR: Record<Lang, S> = {
  fr: {
    pot: "Pot au milieu", bet: "Mise à suivre", required: "Équité requise", odds: "Cote du pot",
    ratioSuffix: "contre 1",
    need: (x) => `Tu dois gagner au moins ${x} % du temps pour que suivre soit rentable.`,
    compare: "Compare à ton équité (optionnel)", eqPct: "En %", eqOuts: "Via mes outs",
    outs: "Outs", street: "Cartes à venir", flop: "Flop → river (2)", turn: "River (1)",
    estEq: (x) => `Équité estimée ≈ ${x} % (règle du 4 et 2)`,
    verdictCall: "PAYER", verdictFold: "COUCHER", ev: "EV du call", enterNums: "Entre un pot et une mise.",
  },
  en: {
    pot: "Pot size", bet: "Bet to call", required: "Required equity", odds: "Pot odds",
    ratioSuffix: "to 1",
    need: (x) => `You need to win at least ${x}% of the time for a call to be profitable.`,
    compare: "Compare to your equity (optional)", eqPct: "As %", eqOuts: "From my outs",
    outs: "Outs", street: "Cards to come", flop: "Flop → river (2)", turn: "River (1)",
    estEq: (x) => `Estimated equity ≈ ${x}% (rule of 4 and 2)`,
    verdictCall: "CALL", verdictFold: "FOLD", ev: "Call EV", enterNums: "Enter a pot and a bet.",
  },
};

export function mountPotOdds(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isFinite(n) ? n : NaN; };
  root.innerHTML = `
    <div class="pp-calc po">
      <div class="po-row">
        <label>${s.pot}<input type="number" min="0" step="any" id="po-pot" inputmode="decimal"></label>
        <label>${s.bet}<input type="number" min="0" step="any" id="po-bet" inputmode="decimal"></label>
      </div>
      <div class="po-out" id="po-out"></div>
      <fieldset class="po-eq">
        <legend>${s.compare}</legend>
        <div class="po-modes">
          <label><input type="radio" name="po-mode" value="pct" checked> ${s.eqPct}</label>
          <label><input type="radio" name="po-mode" value="outs"> ${s.eqOuts}</label>
        </div>
        <div class="po-row" id="po-eq-pct">
          <label>${s.required.replace(/requise|equity/i, "").trim() || "Équité"} %<input type="number" min="0" max="100" step="any" id="po-eqv" inputmode="decimal"></label>
        </div>
        <div class="po-row" id="po-eq-outs" style="display:none;">
          <label>${s.outs}<input type="number" min="0" max="23" step="1" id="po-outs" inputmode="numeric"></label>
          <label>${s.street}<select id="po-street"><option value="4">${s.flop}</option><option value="2">${s.turn}</option></select></label>
        </div>
        <div class="po-verdict" id="po-verdict"></div>
      </fieldset>
    </div>`;

  const $ = (id: string) => root.querySelector("#" + id) as HTMLInputElement;
  const out = root.querySelector("#po-out") as HTMLElement;
  const verdict = root.querySelector("#po-verdict") as HTMLElement;
  const pctRow = root.querySelector("#po-eq-pct") as HTMLElement;
  const outsRow = root.querySelector("#po-eq-outs") as HTMLElement;

  function mode(): string {
    const r = root.querySelector('input[name="po-mode"]:checked') as HTMLInputElement;
    return r ? r.value : "pct";
  }

  function render() {
    const pot = num($("po-pot").value), bet = num($("po-bet").value);
    pctRow.style.display = mode() === "pct" ? "" : "none";
    outsRow.style.display = mode() === "outs" ? "" : "none";

    if (!(pot >= 0) || !(bet > 0)) { out.innerHTML = `<p class="calc">${s.enterNums}</p>`; verdict.innerHTML = ""; return; }
    const required = (bet / (pot + bet + bet)) * 100;
    const ratio = (pot + bet) / bet;
    out.innerHTML =
      `<div class="po-big"><span>${s.odds}</span><strong>${ratio.toFixed(1)} ${s.ratioSuffix}</strong></div>` +
      `<div class="po-big"><span>${s.required}</span><strong>${required.toFixed(1)} %</strong></div>` +
      `<p class="sub">${s.need(required.toFixed(1))}</p>`;

    // équité du héros
    let eq = NaN, note = "";
    if (mode() === "pct") eq = num($("po-eqv").value);
    else {
      const o = num($("po-outs").value), mult = parseFloat(($("po-street") as unknown as HTMLSelectElement).value);
      if (o >= 0) { eq = Math.min(o * mult, 100); note = s.estEq(eq.toFixed(0)); }
    }
    if (!(eq >= 0)) { verdict.innerHTML = note ? `<p class="sub">${note}</p>` : ""; return; }
    const call = eq >= required;
    const ev = (eq / 100) * (pot + bet) - (1 - eq / 100) * bet;
    verdict.innerHTML =
      (note ? `<p class="sub">${note}</p>` : "") +
      `<div class="po-decision ${call ? "ok" : "no"}">${call ? "✅ " + s.verdictCall : "❌ " + s.verdictFold} ` +
      `<span>(${eq.toFixed(1)} % ${call ? "≥" : "<"} ${required.toFixed(1)} %)</span></div>` +
      `<p class="sub">${s.ev} = ${ev >= 0 ? "+" : ""}${ev.toFixed(1)}</p>`;
  }

  root.querySelectorAll("input,select").forEach((e) => {
    e.addEventListener("input", render);
    e.addEventListener("change", render);
  });
  render();
}

const target = typeof document !== "undefined" && document.getElementById("pot-odds");
if (target) {
  const lang = ((target as HTMLElement).dataset.lang === "en" ? "en" : "fr") as Lang;
  mountPotOdds(target as HTMLElement, lang);
}
