// Widget « calculateur d'équité PLO / Omaha » — vanilla TS, trilingue (data-lang fr|en|es), 100 % client-side.
// PLO4 / PLO5, 2 à 6 joueurs, mains adverses aléatoires possibles, board 0/3/4/5.
// Exact dès le flop (énumération), Monte-Carlo par paquets préflop (UI réactive).
import { Card, RANKS, SUIT_SYMBOL, makeCard, formatCard, suitOf, parseCards } from "../equity/cards";
import { categoryOf } from "../equity/evaluator";
import { computeOmahaEquityAsync, evaluateOmaha, OmahaHand, OmahaResult, MAX_PLAYERS } from "../omaha/omaha";

type Lang = "fr" | "en" | "es";
const STR = {
  fr: {
    suitLabel: ["pique", "cœur", "carreau", "trèfle"], suitShort: ["P", "Cœ", "Ca", "T"],
    variant: "Variante", plo4: "PLO (4 cartes)", plo5: "PLO5 (5 cartes)",
    you: "Toi", opponent: (i: number) => `Adversaire ${i}`, board: "Board",
    random: "main aléatoire", removeOpp: (i: number) => `retirer l'adversaire ${i}`, addOpp: "+ Adversaire",
    calc: "Calculer l'équité", reset: "Réinitialiser", pickTitle: "Choisis une carte", clearSlot: "Vider cet emplacement",
    emptyAria: "emplacement vide, choisir une carte", cardAria: (r: string, s: string) => `${r} de ${s}`,
    slotAria: (who: string, i: number) => `${who}, carte ${i}`, boardAria: (i: number) => `Board, carte ${i}`,
    progress: (n: number) => `Calcul en cours… ${n} tirages`,
    errComplete: (n: number) => `Complète les ${n} cartes de chaque joueur (ou coche « aléatoire » pour un adversaire).`,
    errBoard: "Le board doit avoir 0, 3, 4 ou 5 cartes.",
    randomName: "Aléatoire",
    catNames: ["Carte haute", "Paire", "Double paire", "Brelan", "Quinte", "Couleur", "Full", "Carré", "Quinte flush"],
    sub: (w: string, t: string) => `victoire ${w} % · partage ${t} %`,
    modeExact: (n: number) => `calcul exact (${n.toLocaleString("fr-FR")} runouts)`,
    modeMc: (n: number) => `estimation Monte-Carlo (${n.toLocaleString("fr-FR")} tirages, ±~0,5 %)`,
    examples: "Exemples", ex1: "AAKK double-couleur contre JT98 double-couleur", ex2: "Brelan contre wrap au flop", ex3: "AAKK double-couleur contre une main aléatoire",
    best: "meilleur", pct: (x: number) => `${x.toFixed(1).replace(".", ",")} %`, num: (x: number) => x.toFixed(1).replace(".", ","),
  },
  en: {
    suitLabel: ["spades", "hearts", "diamonds", "clubs"], suitShort: ["S", "H", "D", "C"],
    variant: "Game", plo4: "PLO (4 cards)", plo5: "PLO5 (5 cards)",
    you: "You", opponent: (i: number) => `Opponent ${i}`, board: "Board",
    random: "random hand", removeOpp: (i: number) => `remove opponent ${i}`, addOpp: "+ Opponent",
    calc: "Calculate equity", reset: "Reset", pickTitle: "Pick a card", clearSlot: "Clear this card",
    emptyAria: "empty slot, pick a card", cardAria: (r: string, s: string) => `${r} of ${s}`,
    slotAria: (who: string, i: number) => `${who}, card ${i}`, boardAria: (i: number) => `Board, card ${i}`,
    progress: (n: number) => `Calculating… ${n} samples`,
    errComplete: (n: number) => `Fill all ${n} cards for each player (or check "random" for an opponent).`,
    errBoard: "The board must have 0, 3, 4 or 5 cards.",
    randomName: "Random",
    catNames: ["High card", "Pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"],
    sub: (w: string, t: string) => `win ${w}% · split ${t}%`,
    modeExact: (n: number) => `exact calculation (${n.toLocaleString("en-US")} runouts)`,
    modeMc: (n: number) => `Monte-Carlo estimate (${n.toLocaleString("en-US")} samples, ±~0.5%)`,
    examples: "Examples", ex1: "AAKK double-suited vs JT98 double-suited", ex2: "Set vs wrap on the flop", ex3: "AAKK double-suited vs a random hand",
    best: "best", pct: (x: number) => `${x.toFixed(1)}%`, num: (x: number) => x.toFixed(1),
  },
  es: {
    suitLabel: ["picas", "corazones", "diamantes", "tréboles"], suitShort: ["P", "Co", "D", "T"],
    variant: "Modalidad", plo4: "PLO (4 cartas)", plo5: "PLO5 (5 cartas)",
    you: "Tú", opponent: (i: number) => `Rival ${i}`, board: "Board",
    random: "mano aleatoria", removeOpp: (i: number) => `quitar al rival ${i}`, addOpp: "+ Rival",
    calc: "Calcular equity", reset: "Reiniciar", pickTitle: "Elige una carta", clearSlot: "Quitar esta carta",
    emptyAria: "casilla vacía, elige una carta", cardAria: (r: string, s: string) => `${r} de ${s}`,
    slotAria: (who: string, i: number) => `${who}, carta ${i}`, boardAria: (i: number) => `Board, carta ${i}`,
    progress: (n: number) => `Calculando… ${n} simulaciones`,
    errComplete: (n: number) => `Completa las ${n} cartas de cada jugador (o marca «aleatoria» para un rival).`,
    errBoard: "El board debe tener 0, 3, 4 o 5 cartas.",
    randomName: "Aleatoria",
    catNames: ["Carta alta", "Pareja", "Doble pareja", "Trío", "Escalera", "Color", "Full", "Póquer", "Escalera de color"],
    sub: (w: string, t: string) => `victoria ${w} % · empate ${t} %`,
    modeExact: (n: number) => `cálculo exacto (${n.toLocaleString("es-ES")} runouts)`,
    modeMc: (n: number) => `estimación Monte-Carlo (${n.toLocaleString("es-ES")} simulaciones, ±~0,5 %)`,
    examples: "Ejemplos", ex1: "AAKK doble suited contra JT98 doble suited", ex2: "Trío contra wrap en el flop", ex3: "AAKK doble suited contra una mano aleatoria",
    best: "mejor", pct: (x: number) => `${x.toFixed(1).replace(".", ",")} %`, num: (x: number) => x.toFixed(1).replace(".", ","),
  },
};

type Slot = Card | null;
interface PlayerState { cards: Slot[]; random: boolean; }
const isRed = (su: number) => su === 1 || su === 2;

export function mountPlo(root: HTMLElement, lang: Lang = "fr") {
  const s = STR[lang] ?? STR.fr;
  let holeSize: 4 | 5 = 4;
  const emptyHand = (): Slot[] => Array.from({ length: holeSize }, () => null);
  let players: PlayerState[] = [{ cards: emptyHand(), random: false }, { cards: emptyHand(), random: false }];
  let board: Slot[] = [null, null, null, null, null];
  type Active = { kind: "player" | "board"; p: number; i: number } | null;
  let active: Active = null;
  let runId = 0;

  const el = (tag: string, cls?: string, txt?: string) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const used = () => {
    const set = new Set<Card>();
    players.forEach((p) => p.cards.forEach((c) => c != null && set.add(c)));
    board.forEach((c) => c != null && set.add(c));
    return set;
  };
  const who = (pi: number) => (pi === 0 ? s.you : s.opponent(pi));

  root.innerHTML = "";
  const box = el("div", "pp-calc plo-calc");
  const variantWrap = el("fieldset", "plo-variant");
  const examplesWrap = el("div", "plo-examples");
  const playersWrap = el("div", "players");
  const boardWrap = el("div", "board");
  const picker = el("div", "picker");
  picker.setAttribute("role", "dialog");
  picker.setAttribute("aria-label", s.pickTitle);
  const controls = el("div", "controls");
  const results = el("div", "results");
  results.setAttribute("aria-live", "polite");
  results.setAttribute("aria-atomic", "true");

  // Variante PLO4 / PLO5
  variantWrap.appendChild(el("legend", undefined, s.variant));
  ([4, 5] as const).forEach((n) => {
    const lab = el("label", "plo-radio");
    const r = el("input") as HTMLInputElement;
    r.type = "radio"; r.name = "plo-variant-" + lang; r.value = String(n); r.checked = n === holeSize;
    r.addEventListener("change", () => {
      if (!r.checked) return;
      holeSize = n;
      players = players.map((p) => ({ random: p.random, cards: Array.from({ length: n }, (_, i) => p.cards[i] ?? null) }));
      active = null; results.innerHTML = ""; renderAll();
    });
    lab.append(r, document.createTextNode(" " + (n === 4 ? s.plo4 : s.plo5)));
    variantWrap.appendChild(lab);
  });

  // Exemples
  const loadExample = (hands: (string | null)[], b: string) => {
    const v = (parseCards(hands.find((h) => h) ?? "").length === 5 ? 5 : 4) as 4 | 5;
    holeSize = v;
    (variantWrap.querySelectorAll("input") as NodeListOf<HTMLInputElement>).forEach((r) => (r.checked = r.value === String(v)));
    players = hands.map((h) => (h ? { cards: parseCards(h), random: false } : { cards: emptyHand(), random: true }));
    const bc = parseCards(b);
    board = Array.from({ length: 5 }, (_, i) => bc[i] ?? null);
    active = null; renderAll(); run();
  };
  examplesWrap.appendChild(el("span", "plo-ex-label", s.examples));
  ([[s.ex1, ["As Ah Ks Kh", "Jd Td 9c 8c"], ""], [s.ex2, ["9s 9d Kc 4h", "Jh Tc 7d 6s"], "9h 8c 2d"], [s.ex3, ["As Ah Ks Kh", null], ""]] as [string, (string | null)[], string][])
    .forEach(([label, h, b]) => {
      const btn = el("button", "ctl small", label) as HTMLButtonElement;
      btn.type = "button";
      btn.addEventListener("click", () => loadExample(h, b));
      examplesWrap.appendChild(btn);
    });

  const cardFace = (c: Slot, aria: string, isActive: boolean): HTMLButtonElement => {
    const b = el("button", "card" + (isActive ? " active" : "")) as HTMLButtonElement;
    b.type = "button";
    if (c == null) {
      b.classList.add("empty"); b.textContent = "+";
      b.setAttribute("aria-label", `${aria} : ${s.emptyAria}`);
    } else {
      const su = suitOf(c);
      b.classList.add(isRed(su) ? "red" : "black");
      b.setAttribute("aria-label", `${aria} : ${s.cardAria(RANKS[c >> 2], s.suitLabel[su])}`);
      b.innerHTML = `<span class="r">${RANKS[c >> 2]}</span><span class="s" aria-hidden="true">${SUIT_SYMBOL[su]}</span><span class="t" aria-hidden="true">${s.suitShort[su]}</span>`;
    }
    if (isActive) b.setAttribute("aria-expanded", "true");
    return b;
  };

  function focusActiveSlot(kind: "player" | "board", p: number, i: number) {
    const sel = kind === "board" ? `.board .card[data-i="${i}"]` : `.player[data-p="${p}"] .card[data-i="${i}"]`;
    (box.querySelector(sel) as HTMLElement | null)?.focus();
  }

  function setActive(a: Active) {
    active = a; renderAll();
    (picker.querySelector(".pick:not([disabled])") as HTMLElement | null)?.focus();
  }

  function assign(c: Slot) {
    if (!active) return;
    const a = active;
    if (a.kind === "player") players[a.p].cards[a.i] = c; else board[a.i] = c;
    // avance automatique vers l'emplacement vide suivant de la même zone
    let next: Active = null;
    if (c != null) {
      if (a.kind === "player") {
        const j = players[a.p].cards.findIndex((x) => x == null);
        if (j >= 0) next = { kind: "player", p: a.p, i: j };
      } else {
        const j = board.findIndex((x, k) => x == null && k > a.i && k < (a.i < 3 ? 3 : 5));
        if (j >= 0) next = { kind: "board", p: 0, i: j };
      }
    }
    active = next; renderAll();
    if (next) (picker.querySelector(".pick:not([disabled])") as HTMLElement | null)?.focus();
    else focusActiveSlot(a.kind, a.p, a.i);
  }

  function renderPicker() {
    picker.innerHTML = "";
    if (!active) { picker.classList.remove("open"); return; }
    picker.classList.add("open");
    picker.appendChild(el("p", "picker-title", s.pickTitle));
    const u = used();
    for (let su = 0; su < 4; su++) {
      const row = el("div", `picker-row ${isRed(su) ? "red" : "black"}`);
      row.setAttribute("role", "group"); row.setAttribute("aria-label", s.suitLabel[su]);
      for (let ri = 12; ri >= 0; ri--) {
        const c = makeCard(ri, su);
        const b = el("button", "pick " + (isRed(su) ? "red" : "black")) as HTMLButtonElement;
        b.type = "button";
        b.innerHTML = `${RANKS[ri]}<span class="s" aria-hidden="true">${SUIT_SYMBOL[su]}</span>`;
        b.setAttribute("aria-label", s.cardAria(RANKS[ri], s.suitLabel[su]));
        if (u.has(c)) b.disabled = true;
        b.addEventListener("click", () => assign(c));
        row.appendChild(b);
      }
      picker.appendChild(row);
    }
    const clear = el("button", "picker-clear", s.clearSlot) as HTMLButtonElement;
    clear.type = "button"; clear.addEventListener("click", () => assign(null));
    picker.appendChild(clear);
    picker.onkeydown = (e) => { if (e.key === "Escape" && active) { const a = active; active = null; renderAll(); focusActiveSlot(a.kind, a.p, a.i); } };
  }

  function renderPlayers() {
    playersWrap.innerHTML = "";
    players.forEach((p, pi) => {
      const row = el("div", "player");
      row.dataset.p = String(pi);
      row.appendChild(el("span", "pname", who(pi)));
      const slots = el("div", "slots");
      p.cards.forEach((c, i) => {
        const isAct = active?.kind === "player" && active.p === pi && active.i === i;
        const f = cardFace(p.random ? null : c, s.slotAria(who(pi), i + 1), isAct);
        f.dataset.i = String(i);
        if (p.random) { f.disabled = true; f.classList.add("dim"); }
        else f.addEventListener("click", () => setActive({ kind: "player", p: pi, i }));
        slots.appendChild(f);
      });
      row.appendChild(slots);
      if (pi > 0) {
        const lab = el("label", "rnd");
        const cb = el("input") as HTMLInputElement;
        cb.type = "checkbox"; cb.checked = p.random;
        cb.addEventListener("change", () => { p.random = cb.checked; if (p.random) p.cards = emptyHand(); active = null; renderAll(); });
        lab.append(cb, document.createTextNode(" " + s.random));
        row.appendChild(lab);
        if (players.length > 2) {
          const del = el("button", "del", "✕") as HTMLButtonElement;
          del.type = "button"; del.setAttribute("aria-label", s.removeOpp(pi));
          del.addEventListener("click", () => { players.splice(pi, 1); active = null; renderAll(); });
          row.appendChild(del);
        }
      }
      playersWrap.appendChild(row);
    });
  }

  function renderBoard() {
    boardWrap.innerHTML = "";
    boardWrap.appendChild(el("span", "blabel", s.board));
    const slots = el("div", "slots");
    board.forEach((c, i) => {
      const f = cardFace(c, s.boardAria(i + 1), active?.kind === "board" && active.i === i);
      f.dataset.i = String(i);
      f.addEventListener("click", () => setActive({ kind: "board", p: 0, i }));
      slots.appendChild(f);
    });
    boardWrap.appendChild(slots);
  }

  function renderControls() {
    controls.innerHTML = "";
    const add = el("button", "ctl", s.addOpp) as HTMLButtonElement;
    add.type = "button"; add.disabled = players.length >= MAX_PLAYERS;
    add.addEventListener("click", () => { players.push({ cards: emptyHand(), random: false }); renderAll(); });
    const calc = el("button", "ctl primary", s.calc) as HTMLButtonElement;
    calc.type = "button"; calc.addEventListener("click", run);
    const reset = el("button", "ctl", s.reset) as HTMLButtonElement;
    reset.type = "button";
    reset.addEventListener("click", () => {
      runId++;
      players = [{ cards: emptyHand(), random: false }, { cards: emptyHand(), random: false }];
      board = [null, null, null, null, null]; active = null; results.innerHTML = ""; renderAll();
    });
    controls.append(add, calc, reset);
  }

  const message = (cls: string, txt: string) => { results.innerHTML = ""; results.appendChild(el("p", cls, txt)); };

  function run() {
    const hands: OmahaHand[] = [];
    for (const p of players) {
      if (p.random) { hands.push({ cards: [], random: true }); continue; }
      if (p.cards.some((c) => c == null)) return message("err", s.errComplete(holeSize));
      hands.push({ cards: p.cards as Card[], random: false });
    }
    const b = board.filter((c): c is Card => c != null);
    if (![0, 3, 4, 5].includes(b.length)) return message("err", s.errBoard);
    const id = ++runId;
    message("calc", s.progress(0));
    computeOmahaEquityAsync(hands, b, {
      holeSize,
      onProgress: (r) => { if (id === runId) { const p = results.querySelector(".calc"); if (p) p.textContent = s.progress(r.iterations); } },
    }).then((r) => { if (id === runId) renderResults(r, hands, b); })
      .catch((e: Error) => { if (id === runId) message("err", e.message); });
  }

  function renderResults(r: OmahaResult, hands: OmahaHand[], b: Card[]) {
    results.innerHTML = "";
    const order = r.results.map((_, i) => i).sort((x, y) => r.results[y].equity - r.results[x].equity);
    order.forEach((i, rank) => {
      const h = hands[i];
      const res = r.results[i];
      const row = el("div", "resrow");
      const head = el("div", "rhead");
      const name = el("span", "rname", (h.random ? s.randomName : who(i)));
      if (rank === 0) { const star = el("span", undefined, "⭐ "); star.setAttribute("aria-label", s.best); name.prepend(star); }
      const handTxt = h.random ? "? ? ? ?" : h.cards.map(formatCard).join(" ") + (b.length === 5 ? " · " + s.catNames[categoryOf(evaluateOmaha(h.cards, b))] : "");
      head.append(name, el("span", "rhand", handTxt), el("strong", "req", s.pct(res.equity)));
      const bar = el("div", "bar");
      bar.setAttribute("aria-hidden", "true");
      const fill = el("span"); fill.style.width = res.equity.toFixed(1) + "%"; bar.appendChild(fill);
      row.append(head, bar, el("p", "sub", s.sub(s.num(res.win), s.num(res.tie))));
      results.appendChild(row);
    });
    results.appendChild(el("p", "mode", r.exact ? s.modeExact(r.iterations) : s.modeMc(r.iterations)));
  }

  function renderAll() { renderPlayers(); renderBoard(); renderPicker(); renderControls(); }

  box.append(variantWrap, examplesWrap, playersWrap, boardWrap, picker, controls, results);
  root.appendChild(box);
  renderAll();
}

const target = typeof document !== "undefined" && document.getElementById("plo-calculator");
if (target) { const dl = (target as HTMLElement).dataset.lang; mountPlo(target as HTMLElement, dl === "en" || dl === "es" ? dl : "fr"); }
