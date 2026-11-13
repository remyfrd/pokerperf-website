// Widget « calculateur de range » — % → mains & combos. Vanilla TS, bilingue (data-lang).
//
// Classement « top X % » : équité préflop à tapis contre UNE main aléatoire (convention
// PokerStove / Equilab). Valeurs précalculées avec notre moteur (200 000 tirages
// Monte-Carlo par main, ± 0,25 pt), arrondies à 2 décimales.
//
// Règle du seuil : on ajoute les mains dans l'ordre du classement TANT QUE le total
// de combos reste ≤ X % de 1 326. La main qui ferait dépasser le seuil n'est PAS
// incluse (on s'arrête là, on ne saute pas aux mains suivantes).
//
// Cartes (bloqueurs) : id = rangDesc * 4 + couleur, rangDesc 0..12 = A..2, couleur 0..3 = ♠♥♦♣.

type Lang = "fr" | "en";
type Kind = "pair" | "suited" | "offsuit";

export const RANKS_DESC = "AKQJT98765432";
export const TOTAL_COMBOS = 1326;

// Grille 13×13 (ligne i, colonne j, A en haut à gauche) : diagonale = paires,
// au-dessus = assorties (suited), en dessous = dépareillées (offsuit).
// prettier-ignore
const EQ_GRID: number[] = [
  85.32,66.94,66.21,65.35,64.71,62.73,61.98,60.90,59.73,60.00,59.05,58.12,57.19,
  65.27,82.40,63.35,62.68,61.87,59.76,58.32,57.66,56.93,55.77,54.68,54.00,53.09,
  64.41,61.48,79.93,60.15,59.35,57.52,55.99,54.26,53.61,52.92,51.88,50.99,50.34,
  63.45,60.56,58.08,77.44,57.74,55.69,53.87,52.34,50.65,50.21,49.03,48.27,47.30,
  62.81,59.81,57.30,55.49,75.02,54.01,52.28,50.54,48.95,47.15,46.48,45.84,44.88,
  60.72,57.88,55.32,53.35,51.66,71.86,50.80,49.30,47.40,45.81,43.89,43.26,42.48,
  59.75,56.05,53.73,51.58,49.66,48.17,69.25,47.77,46.15,44.39,42.58,40.76,40.41,
  58.87,55.10,51.67,49.69,47.76,46.16,44.99,66.18,45.34,43.60,41.78,40.11,38.24,
  57.71,54.23,51.09,47.84,45.87,44.53,43.18,42.31,63.26,43.17,41.22,39.53,37.75,
  57.77,53.27,50.11,47.27,44.14,42.71,41.32,40.45,39.94,60.28,41.38,39.49,37.68,
  56.82,52.40,49.25,46.27,43.39,40.80,39.27,38.51,37.91,38.07,57.00,38.72,36.81,
  55.87,51.35,48.10,45.04,42.66,39.92,37.58,36.65,36.19,36.50,35.23,53.72,35.94,
  54.90,50.60,47.13,44.29,41.59,39.16,36.97,34.79,34.01,34.25,33.20,32.29,50.49,
];

export interface HandClass {
  /** index dans la grille = row * 13 + col */
  idx: number;
  row: number;
  col: number;
  label: string;
  kind: Kind;
  /** rangs (0 = A … 12 = 2), hi ≤ lo */
  hi: number;
  lo: number;
  /** équité vs main aléatoire, en % */
  eq: number;
  /** les combos (paires de cartes) de cette main */
  combos: [number, number][];
}

function buildHands(): HandClass[] {
  const out: HandClass[] = [];
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const kind: Kind = row === col ? "pair" : row < col ? "suited" : "offsuit";
      const hi = Math.min(row, col), lo = Math.max(row, col);
      const label = RANKS_DESC[hi] + RANKS_DESC[lo] + (kind === "pair" ? "" : kind === "suited" ? "s" : "o");
      const combos: [number, number][] = [];
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          if (kind === "pair" && b <= a) continue;
          if (kind === "suited" && a !== b) continue;
          if (kind === "offsuit" && a === b) continue;
          combos.push([hi * 4 + a, lo * 4 + b]);
        }
      }
      out.push({ idx: row * 13 + col, row, col, label, kind, hi, lo, eq: EQ_GRID[row * 13 + col], combos });
    }
  }
  return out;
}

export const HANDS: HandClass[] = buildHands();
const BY_LABEL = new Map(HANDS.map((h) => [h.label, h]));

/** Index de grille d'une main en notation standard ("AKs", "QQ", "T9o"). */
export function handIndex(label: string): number {
  const h = BY_LABEL.get(label);
  if (!h) throw new Error("main inconnue : " + label);
  return h.idx;
}

/** Les 169 index triés du meilleur au pire (équité décroissante, égalité → libellé). */
export const RANKED: number[] = HANDS.slice()
  .sort((a, b) => b.eq - a.eq || (a.label < b.label ? -1 : 1))
  .map((h) => h.idx);

/** Nombre de combos d'une main, après retrait des cartes mortes (tes cartes). */
export function combosOf(idx: number, dead: ReadonlySet<number> = new Set()): number {
  let n = 0;
  for (const [a, b] of HANDS[idx].combos) if (!dead.has(a) && !dead.has(b)) n++;
  return n;
}

export function countCombos(sel: Iterable<number>, dead: ReadonlySet<number> = new Set()): number {
  let n = 0;
  for (const i of sel) n += combosOf(i, dead);
  return n;
}

/** Top X % : mains ajoutées dans l'ordre tant que le total reste ≤ X % de 1 326. */
export function topPercent(pct: number): Set<number> {
  const limit = (Math.max(0, Math.min(100, pct)) / 100) * TOTAL_COMBOS + 1e-9;
  const sel = new Set<number>();
  let cum = 0;
  for (const i of RANKED) {
    const c = HANDS[i].combos.length;
    if (cum + c > limit) break;
    cum += c;
    sel.add(i);
  }
  return sel;
}

/** Parse une liste simple ("JJ+, AK, A5s-A2s, KQo") → index. Utilisé pour les préréglages et les tests. */
export function parseRange(text: string): Set<number> {
  const sel = new Set<number>();
  const add = (l: string) => sel.add(handIndex(l));
  const r = (c: string) => RANKS_DESC.indexOf(c);
  for (const raw of text.split(",")) {
    const t = raw.trim();
    if (!t) continue;
    let m = /^([AKQJT2-9])\1(\+)?$/.exec(t);
    if (m) {
      const lo = r(m[1]);
      for (let k = m[2] ? 0 : lo; k <= lo; k++) add(RANKS_DESC[k] + RANKS_DESC[k]);
      continue;
    }
    m = /^([AKQJT2-9])\1-([AKQJT2-9])\2$/.exec(t);
    if (m) { for (let k = r(m[1]); k <= r(m[2]); k++) add(RANKS_DESC[k] + RANKS_DESC[k]); continue; }
    m = /^([AKQJT2-9])([AKQJT2-9])([so])?(\+)?$/.exec(t);
    if (m) {
      const kinds = m[3] ? [m[3]] : ["s", "o"];
      const hi = r(m[1]), lo = r(m[2]);
      for (const k of kinds) for (let x = m[4] ? hi + 1 : lo; x <= lo; x++) add(m[1] + RANKS_DESC[x] + k);
      continue;
    }
    m = /^([AKQJT2-9])([AKQJT2-9])([so])-\1([AKQJT2-9])\3$/.exec(t);
    if (m) { for (let x = r(m[2]); x <= r(m[4]); x++) add(m[1] + RANKS_DESC[x] + m[3]); continue; }
    throw new Error("notation non reconnue : " + t);
  }
  return sel;
}

/** Compression en notation standard : "TT+, 66-55, AQs+, A5s-A2s, KQs, AKo". */
export function compressRange(sel: ReadonlySet<number>): string {
  const parts: string[] = [];
  const P = (k: number) => RANKS_DESC[k] + RANKS_DESC[k];
  // Paires
  let k = 0;
  while (k < 13) {
    if (!sel.has(k * 13 + k)) { k++; continue; }
    let e = k;
    while (e + 1 < 13 && sel.has((e + 1) * 13 + e + 1)) e++;
    parts.push(k === 0 && e > 0 ? P(e) + "+" : e === k ? P(k) : P(k) + "-" + P(e));
    k = e + 1;
  }
  // Assorties puis dépareillées, par carte haute
  for (const suf of ["s", "o"]) {
    for (let hi = 0; hi < 12; hi++) {
      const has = (lo: number) => sel.has(suf === "s" ? hi * 13 + lo : lo * 13 + hi);
      let lo = hi + 1;
      while (lo < 13) {
        if (!has(lo)) { lo++; continue; }
        let e = lo;
        while (e + 1 < 13 && has(e + 1)) e++;
        const H = RANKS_DESC[hi], a = H + RANKS_DESC[lo] + suf, b = H + RANKS_DESC[e] + suf;
        parts.push(lo === hi + 1 && e > lo ? b + "+" : e === lo ? a : a + "-" + b);
        lo = e + 1;
      }
    }
  }
  return parts.join(", ");
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

interface S {
  topLabel: string; rule: string; presets: string; clear: string; all: string; exampleLabel: string;
  caption: string; hint: string; keys: string; region: string; combosSr: (n: number) => string;
  blockers: string; card1: string; card2: string; none: string; sameCard: string;
  combos: string; ofTotal: string; hands: string; list: string; empty: string; custom: string;
  afterBlock: (n: string, tot: string) => string; copy: string; copied: string;
  rankName: (r: string) => string; suitNames: string[]; model: string; pct: (x: string) => string;
}
const STR: Record<Lang, S> = {
  fr: {
    topLabel: "Top X\u00a0% des mains",
    rule: "On ajoute les mains de la meilleure à la moins bonne tant que le total reste ≤\u00a0X\u00a0% des 1\u202f326 combos : la main qui ferait dépasser le seuil n'est pas incluse.",
    presets: "Préréglages", clear: "Effacer", all: "Tout (100\u00a0%)", exampleLabel: "JJ+, AK (≈ 3\u00a0%)",
    caption: "Clique une case pour l'ajouter ou la retirer. Chiffre = nombre de combos ; ✓ = main dans la range.",
    hint: "← fais défiler la grille →", keys: "Flèches pour se déplacer dans la grille, Espace ou Entrée pour cocher.",
    region: "Grille des 169 mains", combosSr: (n) => `, ${n} combo${n > 1 ? "s" : ""}`,
    blockers: "Retirer les bloqueurs de ta main", card1: "Ta carte 1", card2: "Ta carte 2", none: "—", sameCard: "Choisis deux cartes différentes.",
    combos: "Combos", ofTotal: "Part des 1 326 combos", hands: "Mains", list: "Range", empty: "Aucune main sélectionnée.", custom: "range personnalisée",
    afterBlock: (n, tot) => `Avec tes cartes retirées : ${n} combos (sur ${tot} encore possibles)`,
    copy: "Copier la range", copied: "Range copiée.",
    rankName: (r) => r, suitNames: ["pique", "cœur", "carreau", "trèfle"],
    model: "Classement : équité à tapis contre une main aléatoire (comme PokerStove / Equilab). D'autres outils peuvent ordonner quelques mains un peu différemment.",
    pct: (x) => `${x}\u00a0%`,
  },
  en: {
    topLabel: "Top X% of hands",
    rule: "Hands are added from best to worst while the total stays ≤ X% of the 1,326 combos: the hand that would cross the threshold is not included.",
    presets: "Presets", clear: "Clear", all: "All (100%)", exampleLabel: "JJ+, AK (≈ 3%)",
    caption: "Click a cell to add or remove it. Number = combos; ✓ = hand in the range.",
    hint: "← scroll the grid →", keys: "Arrow keys move around the grid, Space or Enter toggles.",
    region: "Grid of the 169 hands", combosSr: (n) => `, ${n} combo${n === 1 ? "" : "s"}`,
    blockers: "Remove your hand's blockers", card1: "Your card 1", card2: "Your card 2", none: "—", sameCard: "Pick two different cards.",
    combos: "Combos", ofTotal: "Share of 1,326 combos", hands: "Hands", list: "Range", empty: "No hand selected.", custom: "custom range",
    afterBlock: (n, tot) => `With your cards removed: ${n} combos (out of ${tot} still possible)`,
    copy: "Copy range", copied: "Range copied.",
    rankName: (r) => r, suitNames: ["spades", "hearts", "diamonds", "clubs"],
    model: "Ranking: all-in equity against one random hand (as in PokerStove / Equilab). Other tools may order a few hands slightly differently.",
    pct: (x) => `${x}%`,
  },
};
const SUIT_SYM = ["♠", "♥", "♦", "♣"];

export function mountRange(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  const dec = (x: number, d = 1) => (lang === "fr" ? x.toFixed(d).replace(".", ",") : x.toFixed(d));
  const int = (n: number) => (lang === "fr" ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : n.toLocaleString("en-US"));
  const presets: [string, () => Set<number>, number | null][] = [
    ["Top 5" + (lang === "fr" ? "\u00a0%" : "%"), () => topPercent(5), 5],
    [lang === "fr" ? "Top 15\u00a0% (≈ open UTG)" : "Top 15% (≈ UTG open)", () => topPercent(15), 15],
    [lang === "fr" ? "Top 27\u00a0% (≈ CO)" : "Top 27% (≈ CO)", () => topPercent(27), 27],
    [lang === "fr" ? "Top 45\u00a0% (≈ BTN)" : "Top 45% (≈ BTN)", () => topPercent(45), 45],
    [s.exampleLabel, () => parseRange("JJ+, AK"), null],
  ];
  const cardOpts = ['<option value="">' + s.none + "</option>"]
    .concat(Array.from({ length: 52 }, (_, id) => {
      const r = RANKS_DESC[id >> 2], su = id & 3;
      return `<option value="${id}">${r}${SUIT_SYM[su]} (${r} ${lang === "fr" ? "de" : "of"} ${s.suitNames[su]})</option>`;
    })).join("");

  let rows = "";
  for (let r = 0; r < 13; r++) {
    rows += `<tr><th scope="row">${RANKS_DESC[r]}</th>`;
    for (let c = 0; c < 13; c++) {
      const h = HANDS[r * 13 + c];
      rows += `<td><button type="button" class="rc-cell rc-${h.kind}" data-i="${h.idx}" aria-pressed="false" tabindex="${h.idx === 0 ? 0 : -1}">` +
        `<span class="rc-l">${h.label}</span><span class="rc-n" aria-hidden="true"></span><span class="sr-only rc-sr"></span>` +
        `<span class="rc-m" aria-hidden="true">✓</span></button></td>`;
    }
    rows += "</tr>";
  }

  root.innerHTML = `
    <div class="pp-calc po rc">
      <div class="rc-top">
        <label for="rc-pct" class="rc-toplabel">${s.topLabel}</label>
        <div class="rc-slider">
          <input type="range" id="rc-range" min="0" max="100" step="0.5" value="0" aria-label="${s.topLabel}">
          <span class="rc-num"><input type="number" id="rc-pct" min="0" max="100" step="0.5" value="0" inputmode="decimal"><span aria-hidden="true">%</span></span>
        </div>
        <p class="sub rc-rule">${s.rule}</p>
      </div>
      <div class="rc-presets" role="group" aria-label="${s.presets}">
        ${presets.map((p, k) => `<button type="button" class="ctl" data-p="${k}">${p[0]}</button>`).join("")}
        <button type="button" class="ctl" data-all>${s.all}</button>
        <button type="button" class="ctl" data-clear>${s.clear}</button>
      </div>
      <p class="sub rc-caption" id="rc-cap">${s.caption}</p>
      <p class="sh-hint" aria-hidden="true">${s.hint}</p>
      <div class="sh-scroll rc-scroll">
        <table class="rc-grid" aria-describedby="rc-cap">
          <caption class="sr-only">${s.region}. ${s.keys}</caption>
          <thead><tr><td></td>${Array.from(RANKS_DESC).map((r) => `<th scope="col">${r}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <fieldset class="po-eq rc-block">
        <legend>${s.blockers}</legend>
        <div class="po-row">
          <label>${s.card1}<select id="rc-c1">${cardOpts}</select></label>
          <label>${s.card2}<select id="rc-c2">${cardOpts}</select></label>
        </div>
        <p class="sub err" id="rc-berr" role="alert"></p>
      </fieldset>
      <div class="po-out" id="rc-out" aria-live="polite" aria-atomic="true"></div>
      <div class="controls"><button type="button" class="ctl" id="rc-copy">${s.copy}</button><span class="sub" id="rc-copied" role="status"></span></div>
      <p class="mode">${s.model}</p>
    </div>`;

  const cells = Array.from(root.querySelectorAll<HTMLButtonElement>(".rc-cell"));
  const range = root.querySelector("#rc-range") as HTMLInputElement;
  const num = root.querySelector("#rc-pct") as HTMLInputElement;
  const out = root.querySelector("#rc-out") as HTMLElement;
  const c1 = root.querySelector("#rc-c1") as HTMLSelectElement;
  const c2 = root.querySelector("#rc-c2") as HTMLSelectElement;
  const berr = root.querySelector("#rc-berr") as HTMLElement;
  let sel = new Set<number>();
  let custom = false;

  function dead(): Set<number> {
    const d = new Set<number>();
    berr.textContent = "";
    if (c1.value !== "" && c1.value === c2.value) { berr.textContent = s.sameCard; return d; }
    for (const v of [c1.value, c2.value]) if (v !== "") d.add(+v);
    return d;
  }

  function render() {
    const d = dead();
    for (const b of cells) {
      const i = +b.dataset.i!;
      const on = sel.has(i), n = combosOf(i, d);
      b.setAttribute("aria-pressed", String(on));
      b.classList.toggle("on", on);
      b.classList.toggle("dead", n === 0);
      (b.querySelector(".rc-n") as HTMLElement).textContent = String(n);
      (b.querySelector(".rc-sr") as HTMLElement).textContent = s.combosSr(n);
    }
    const base = countCombos(sel);
    const row = (k: string, v: string) => `<div class="po-big"><span>${k}</span><strong>${v}</strong></div>`;
    let html = row(s.combos, int(base)) + row(s.ofTotal, s.pct(dec((base / TOTAL_COMBOS) * 100))) + row(s.hands, `${sel.size} / 169`);
    if (d.size) {
      const left = countCombos(sel, d);
      const rem = ((52 - d.size) * (51 - d.size)) / 2;
      html += `<p class="rc-after">${s.afterBlock(int(left), int(rem))}</p>`;
    }
    html += `<p class="rc-list"><span>${s.list}${custom ? ` (${s.custom})` : ""}</span> <code>${sel.size ? compressRange(sel) : s.empty}</code></p>`;
    out.innerHTML = html;
  }

  function setPct(p: number, from: "range" | "num" | "preset") {
    p = Math.max(0, Math.min(100, Math.round(p * 2) / 2));
    if (from !== "range") range.value = String(p);
    if (from !== "num") num.value = String(p);
    sel = topPercent(p);
    custom = false;
    render();
  }

  range.addEventListener("input", () => setPct(parseFloat(range.value), "range"));
  num.addEventListener("input", () => {
    const p = parseFloat(num.value.replace(",", "."));
    if (isFinite(p)) setPct(p, "num");
  });
  num.addEventListener("change", () => { const p = parseFloat(num.value.replace(",", ".")); setPct(isFinite(p) ? p : 0, "preset"); });

  root.querySelectorAll<HTMLButtonElement>(".rc-presets button").forEach((b) => b.addEventListener("click", () => {
    if (b.hasAttribute("data-clear")) { setPct(0, "preset"); return; }
    if (b.hasAttribute("data-all")) { setPct(100, "preset"); return; }
    const p = presets[+b.dataset.p!];
    if (p[2] !== null) { setPct(p[2], "preset"); return; }
    sel = p[1]();
    custom = true;
    render();
  }));

  cells.forEach((b) => {
    b.addEventListener("click", () => {
      const i = +b.dataset.i!;
      if (sel.has(i)) sel.delete(i); else sel.add(i);
      custom = true;
      render();
    });
    b.addEventListener("keydown", (e) => {
      const i = +b.dataset.i!, r = Math.floor(i / 13), c = i % 13;
      let t = -1;
      if (e.key === "ArrowRight") t = r * 13 + Math.min(12, c + 1);
      else if (e.key === "ArrowLeft") t = r * 13 + Math.max(0, c - 1);
      else if (e.key === "ArrowDown") t = Math.min(12, r + 1) * 13 + c;
      else if (e.key === "ArrowUp") t = Math.max(0, r - 1) * 13 + c;
      else if (e.key === "Home") t = r * 13;
      else if (e.key === "End") t = r * 13 + 12;
      if (t < 0) return;
      e.preventDefault();
      b.tabIndex = -1;
      cells[t].tabIndex = 0;
      cells[t].focus();
    });
  });

  c1.addEventListener("change", render);
  c2.addEventListener("change", render);

  const copied = root.querySelector("#rc-copied") as HTMLElement;
  (root.querySelector("#rc-copy") as HTMLButtonElement).addEventListener("click", async () => {
    const txt = compressRange(sel);
    try { await navigator.clipboard.writeText(txt); copied.textContent = s.copied; }
    catch { copied.textContent = txt; }
  });

  setPct(parseFloat(root.dataset.pct ?? "4") || 0, "preset");
}

const target = typeof document !== "undefined" && document.getElementById("range-calculator");
if (target) mountRange(target as HTMLElement, (target as HTMLElement).dataset.lang === "en" ? "en" : "fr");
