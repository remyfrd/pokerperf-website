// Widget « EV du semi-bluff » — arithmétique client-side, bilingue (data-lang).
// Modèle (simplifié, un seul tour de mise) : tu mises B dans un pot P avec un tirage.
//   Il se couche (FE)     → tu gagnes P.
//   Il paie (1 − FE)      → pot final P + 2B, tu le gagnes avec ton équité E : E·(P+2B) − B.
//   EV(semi-bluff) = FE·P + (1 − FE)·(E·(P+2B) − B)
//   Fold equity minimale  = −X / (P − X) avec X = E·(P+2B) − B (0 si X ≥ 0).
//   Repère « checker »    ≈ E·P (tu réalises ton équité gratuitement).
type Lang = "fr" | "en";
interface S {
  pot: string; bet: string; fe: string; eq: string; eqPct: string; eqOuts: string; outs: string; street: string;
  flop: string; turn: string; estEq: (x: string) => string;
  evFold: string; evCall: string; evTotal: string; feMin: string; evCheck: string;
  good: string; okButCheck: string; bad: (x: string) => string; enter: string; model: string;
}
const STR: Record<Lang, S> = {
  fr: {
    pot: "Pot au milieu", bet: "Ta mise", fe: "Chance qu'il se couche (fold equity, %)", eq: "Ton équité si payé",
    eqPct: "En %", eqOuts: "Via mes outs", outs: "Outs", street: "Cartes à venir", flop: "Flop → river (2)", turn: "River (1)",
    estEq: (x) => `Équité estimée ≈ ${x} % (règle du 4 et 2)`,
    evFold: "Gain s'il se couche", evCall: "EV s'il paie", evTotal: "EV du semi-bluff", feMin: "Fold equity minimale", evCheck: "Repère : EV si tu checkes",
    good: "✅ Semi-bluff rentable, et meilleur que checker",
    okButCheck: "⚖️ Rentable, mais checker rapporte un peu plus dans ce modèle",
    bad: (x) => `❌ Pas rentable : il faudrait qu'il se couche au moins ${x} % du temps`,
    enter: "Entre un pot, une mise et ta fold equity.",
    model: "Modèle simplifié : un seul tour de mise, pas de relance, équité réalisée s'il paie.",
  },
  en: {
    pot: "Pot size", bet: "Your bet", fe: "Chance he folds (fold equity, %)", eq: "Your equity if called",
    eqPct: "As %", eqOuts: "From my outs", outs: "Outs", street: "Cards to come", flop: "Flop → river (2)", turn: "River (1)",
    estEq: (x) => `Estimated equity ≈ ${x}% (rule of 4 and 2)`,
    evFold: "Win when he folds", evCall: "EV when called", evTotal: "Semi-bluff EV", feMin: "Break-even fold equity", evCheck: "Benchmark: EV if you check",
    good: "✅ Profitable semi-bluff, and better than checking",
    okButCheck: "⚖️ Profitable, but checking earns slightly more in this model",
    bad: (x) => `❌ Not profitable: he would need to fold at least ${x}% of the time`,
    enter: "Enter a pot, a bet and your fold equity.",
    model: "Simplified model: one betting round, no raise, equity realised when called.",
  },
};

export function mountSemiBluff(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  const num = (v: string) => { const n = parseFloat(v.replace(",", ".")); return isFinite(n) ? n : NaN; };
  root.innerHTML = `
    <div class="pp-calc po">
      <div class="po-row">
        <label>${s.pot}<input type="number" min="0" step="any" id="sb-pot" inputmode="decimal"></label>
        <label>${s.bet}<input type="number" min="0" step="any" id="sb-bet" inputmode="decimal"></label>
      </div>
      <div class="po-row" style="margin-top:12px;">
        <label>${s.fe}<input type="number" min="0" max="100" step="any" id="sb-fe" inputmode="decimal"></label>
      </div>
      <fieldset class="po-eq">
        <legend>${s.eq}</legend>
        <div class="po-modes">
          <label><input type="radio" name="sb-mode" value="pct" checked> ${s.eqPct}</label>
          <label><input type="radio" name="sb-mode" value="outs"> ${s.eqOuts}</label>
        </div>
        <div class="po-row" id="sb-eq-pct"><label>%<input type="number" min="0" max="100" step="any" id="sb-eqv" inputmode="decimal"></label></div>
        <div class="po-row" id="sb-eq-outs" style="display:none;">
          <label>${s.outs}<input type="number" min="0" max="23" step="1" id="sb-outs" inputmode="numeric"></label>
          <label>${s.street}<select id="sb-street"><option value="4">${s.flop}</option><option value="2">${s.turn}</option></select></label>
        </div>
        <p class="sub" id="sb-est"></p>
      </fieldset>
      <div class="po-out" id="sb-out" aria-live="polite"></div>
      <p class="mode">${s.model}</p>
    </div>`;
  const $ = (id: string) => root.querySelector("#" + id) as HTMLInputElement;
  const out = root.querySelector("#sb-out") as HTMLElement;
  const est = root.querySelector("#sb-est") as HTMLElement;
  const mode = () => (root.querySelector('input[name="sb-mode"]:checked') as HTMLInputElement)?.value ?? "pct";
  const dec = (x: number, d = 1) => (lang === "fr" ? x.toFixed(d).replace(".", ",") : x.toFixed(d));
  const fmt = (x: number) => (x >= 0 ? "+" : "") + dec(x);

  function render() {
    ($("sb-eq-pct").closest(".po-row") as HTMLElement).style.display = mode() === "pct" ? "" : "none";
    (root.querySelector("#sb-eq-outs") as HTMLElement).style.display = mode() === "outs" ? "" : "none";
    let E = NaN; est.textContent = "";
    if (mode() === "pct") E = num($("sb-eqv").value) / 100;
    else {
      const o = num($("sb-outs").value), m = parseFloat(($("sb-street") as unknown as HTMLSelectElement).value);
      if (o >= 0) { const pct = Math.min(o * m, 100); E = pct / 100; est.textContent = s.estEq(pct.toFixed(0)); }
    }
    const P = num($("sb-pot").value), B = num($("sb-bet").value), FE = num($("sb-fe").value) / 100;
    if (!(P >= 0) || !(B > 0) || !(FE >= 0 && FE <= 1) || !(E >= 0 && E <= 1)) { out.innerHTML = `<p class="calc">${s.enter}</p>`; return; }
    const X = E * (P + 2 * B) - B;
    const ev = FE * P + (1 - FE) * X;
    const feMin = X >= 0 ? 0 : (-X / (P - X)) * 100;
    const evCheck = E * P;
    const row = (k: string, v: string) => `<div class="po-big"><span>${k}</span><strong>${v}</strong></div>`;
    const verdict = ev <= 0 ? s.bad(dec(feMin)) : ev >= evCheck ? s.good : s.okButCheck;
    out.innerHTML =
      row(s.evTotal, fmt(ev)) + row(s.evFold, fmt(P)) + row(s.evCall, fmt(X)) +
      row(s.feMin, dec(feMin) + (lang === "fr" ? " %" : "%")) + row(s.evCheck, fmt(evCheck)) +
      `<div class="po-decision ${ev > 0 ? "ok" : "no"}">${verdict}</div>`;
  }
  root.querySelectorAll("input,select").forEach((e) => { e.addEventListener("input", render); e.addEventListener("change", render); });
  render();
}

const target = typeof document !== "undefined" && document.getElementById("semi-bluff");
if (target) mountSemiBluff(target as HTMLElement, (target as HTMLElement).dataset.lang === "en" ? "en" : "fr");
