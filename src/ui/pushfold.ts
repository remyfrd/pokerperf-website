// Widget « Shove or fold? » — trilingue (data-lang fr|en|es), 100 % client-side.
// Entrées : main (2 rangs + assortie/dépareillée), tapis effectif (10/12/15/20 bb), rôle (SB qui pousse / BB qui paie).
// Sortie : verdict de la grille Nash affichée sur la page (mêmes données, cf. src/pushfold/data.test.ts),
// + la même main aux 4 tapis et la part de mains jouées à ce tapis.
import { STACKS, SHARE, frequencyOf, type Role, type Stack } from "../pushfold/data";

type Lang = "fr" | "en" | "es";
const RANKS = "AKQJT98765432";

const STR = {
  fr: {
    card1: "1re carte", card2: "2e carte", suited: "Assortie", offsuit: "Dépareillée", suitLegend: "Couleurs",
    stack: "Tapis effectif", role: "Ta position",
    sb: "Petite blinde (tout le monde a passé)", bb: "Grosse blinde, face au tapis de la petite blinde",
    shove: "Tapis", call: "Paie", fold: "Couche-toi",
    mixShove: (p: number) => `Mixte : tapis ${p} % du temps`, mixCall: (p: number) => `Mixte : paie ${p} % du temps`,
    whyMix: "Main de frontière : à l'équilibre, tapis et fold rapportent presque autant. Les deux sont acceptables ; la fréquence dit lequel l'équilibre préfère.",
    share: (s: number, role: Role, p: string) => role === "sb" ? `À ${s} bb, la petite blinde pousse avec ${p} des mains.` : `À ${s} bb, la grosse blinde paie avec ${p} des mains.`,
    across: "La même main aux autres tapis", pair: "Paire", pct: (x: string) => `${x} %`,
    verdictFor: (h: string, s: number) => `${h} à ${s} bb`,
    model: "Équilibre de Nash heads-up, chip-EV, sans antes. Près de la bulle (ICM), paie plus serré.",
  },
  en: {
    card1: "First card", card2: "Second card", suited: "Suited", offsuit: "Offsuit", suitLegend: "Suits",
    stack: "Effective stack", role: "Your seat",
    sb: "Small blind (folded to you)", bb: "Big blind, facing the small blind's shove",
    shove: "Shove", call: "Call", fold: "Fold",
    mixShove: (p: number) => `Mixed: shove ${p}% of the time`, mixCall: (p: number) => `Mixed: call ${p}% of the time`,
    whyMix: "Borderline hand: at equilibrium, shoving and folding earn almost the same. Both are fine; the frequency tells you which one the equilibrium leans to.",
    share: (s: number, role: Role, p: string) => role === "sb" ? `At ${s}bb, the small blind shoves ${p} of hands.` : `At ${s}bb, the big blind calls with ${p} of hands.`,
    across: "Same hand at the other stack sizes", pair: "Pair", pct: (x: string) => `${x}%`,
    verdictFor: (h: string, s: number) => `${h} at ${s}bb`,
    model: "Heads-up Nash equilibrium, chip-EV, no antes. Near the bubble (ICM), call tighter.",
  },
  es: {
    card1: "Primera carta", card2: "Segunda carta", suited: "Suited", offsuit: "Offsuit", suitLegend: "Palos",
    stack: "Stack efectivo", role: "Tu posición",
    sb: "Ciega pequeña (todos foldean hasta ti)", bb: "Ciega grande, ante el all-in de la ciega pequeña",
    shove: "All-in", call: "Paga", fold: "Foldea",
    mixShove: (p: number) => `Mixto: all-in el ${p} % de las veces`, mixCall: (p: number) => `Mixto: paga el ${p} % de las veces`,
    whyMix: "Mano frontera: en el equilibrio, ir all-in y foldear rinden casi lo mismo. Ambas opciones valen; la frecuencia indica hacia cuál se inclina el equilibrio.",
    share: (s: number, role: Role, p: string) => role === "sb" ? `Con ${s}bb, la ciega pequeña va all-in con el ${p} de las manos.` : `Con ${s}bb, la ciega grande paga con el ${p} de las manos.`,
    across: "La misma mano con los otros stacks", pair: "Pareja", pct: (x: string) => `${x} %`,
    verdictFor: (h: string, s: number) => `${h} con ${s}bb`,
    model: "Equilibrio de Nash heads-up, chip-EV, sin antes. Cerca de la burbuja (ICM), paga más cerrado.",
  },
} as const;

/** Notation de classe (« AKs », « AKo », « 77 ») à partir de deux rangs, rangée haute d'abord. */
export function handOf(r1: string, r2: string, suited: boolean): string {
  const [hi, lo] = RANKS.indexOf(r1) <= RANKS.indexOf(r2) ? [r1, r2] : [r2, r1];
  return hi === lo ? hi + lo : hi + lo + (suited ? "s" : "o");
}

type Kind = "pure" | "mix" | "fold";
function kindOf(f: number): Kind { return f >= 100 ? "pure" : f <= 0 ? "fold" : "mix"; }

export function mountPushFold(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  const dec = lang === "en" ? "." : ",";
  const fmt = (x: number) => x.toFixed(1).replace(".", dec);
  const uid = "pf" + Math.random().toString(36).slice(2, 7);
  const opts = (sel: string) => [...RANKS].map((r) => `<option value="${r}"${r === sel ? " selected" : ""}>${r === "T" ? "10" : r}</option>`).join("");

  root.innerHTML = `
    <div class="pp-calc po pf-tool">
      <div class="po-row">
        <label>${s.card1}<select id="${uid}-r1">${opts("K")}</select></label>
        <label>${s.card2}<select id="${uid}-r2">${opts("7")}</select></label>
      </div>
      <fieldset class="po-eq pf-choice" id="${uid}-suit"><legend>${s.suitLegend}</legend>
        <label><input type="radio" name="${uid}-suit" value="o" checked> ${s.offsuit}</label>
        <label><input type="radio" name="${uid}-suit" value="s"> ${s.suited}</label>
      </fieldset>
      <fieldset class="po-eq pf-choice"><legend>${s.stack}</legend>
        ${STACKS.map((x) => `<label><input type="radio" name="${uid}-stack" value="${x}"${x === 12 ? " checked" : ""}> ${x} bb</label>`).join("")}
      </fieldset>
      <fieldset class="po-eq pf-choice pf-role"><legend>${s.role}</legend>
        <label><input type="radio" name="${uid}-role" value="sb" checked> ${s.sb}</label>
        <label><input type="radio" name="${uid}-role" value="bb"> ${s.bb}</label>
      </fieldset>
      <div class="pf-out">
        <div id="${uid}-out" aria-live="polite" aria-atomic="true"></div>
        <div id="${uid}-more"></div>
      </div>
      <p class="sub pf-model">${s.model}</p>
    </div>`;

  const $ = <T extends Element>(q: string) => root.querySelector(q) as T;
  const r1 = $<HTMLSelectElement>(`#${uid}-r1`), r2 = $<HTMLSelectElement>(`#${uid}-r2`);
  const suitBox = $<HTMLFieldSetElement>(`#${uid}-suit`), out = $<HTMLElement>(`#${uid}-out`), more = $<HTMLElement>(`#${uid}-more`);

  function label(f: number, role: Role): { text: string; sym: string; kind: Kind } {
    const k = kindOf(f);
    if (k === "fold") return { text: s.fold, sym: "–", kind: k };
    if (k === "pure") return { text: role === "sb" ? s.shove : s.call, sym: "●", kind: k };
    return { text: role === "sb" ? s.mixShove(f) : s.mixCall(f), sym: "◐", kind: k };
  }

  function render() {
    const isPair = r1.value === r2.value;
    suitBox.disabled = isPair;
    const suited = !isPair && ($<HTMLInputElement>(`input[name="${uid}-suit"]:checked`)?.value === "s");
    const stack = Number($<HTMLInputElement>(`input[name="${uid}-stack"]:checked`).value) as Stack;
    const role = $<HTMLInputElement>(`input[name="${uid}-role"]:checked`).value as Role;
    const hand = handOf(r1.value, r2.value, suited);
    const f = frequencyOf(hand, stack, role) ?? 0;
    const v = label(f, role);
    const row = STACKS.map((x) => {
      const w = label(frequencyOf(hand, x, role) ?? 0, role);
      return `<li class="pf-${w.kind}${x === stack ? " cur" : ""}"><span class="pf-stk">${x} bb</span> <span aria-hidden="true">${w.sym}</span> ${w.text}</li>`;
    }).join("");
    out.innerHTML = `
      <p class="pf-verdict pf-${v.kind}"><span class="pf-hand">${s.verdictFor(hand, stack)}</span>
        <strong><span aria-hidden="true">${v.sym}</span> ${v.text}</strong></p>
      ${v.kind === "mix" ? `<p class="sub">${s.whyMix}</p>` : ""}
      <p class="sub">${s.share(stack, role, s.pct(fmt(SHARE[stack][role])))}</p>`;
    more.innerHTML = `<p class="pf-across-h">${s.across}</p><ul class="pf-across">${row}</ul>`;
  }

  root.addEventListener("change", render);
  render();
}

const target = typeof document !== "undefined" && document.getElementById("push-fold-tool");
if (target) {
  const l = (target as HTMLElement).dataset.lang;
  mountPushFold(target as HTMLElement, (l === "en" || l === "es" ? l : "fr") as Lang);
}
