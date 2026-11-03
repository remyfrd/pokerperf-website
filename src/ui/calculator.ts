// Widget calculateur d'équité — vanilla TS, monté dans une page Jekyll.
// Bilingue : les libellés viennent de STRINGS[lang] ; la langue est lue sur
// l'élément hôte (`data-lang="fr|en"`, défaut fr). Un seul bundle pour FR + EN.
import { Card, RANKS, SUIT_SYMBOL, makeCard, formatCard, suitOf } from "../equity/cards";
import { computeEquity, Hand } from "../equity/equity";

type Lang = "fr" | "en";
interface Strings {
  suitLabel: string[]; // par couleur s,h,d,c
  suitShort: string[];
  you: string;
  opponent: (i: number) => string;
  board: string;
  random: string;
  removeOpp: (i: number) => string;
  addOpp: string;
  calc: string;
  reset: string;
  pickTitle: string;
  clearSlot: string;
  emptyAria: string;
  calcInProgress: string;
  errComplete: string;
  errBoard: string;
  randomName: string;
  cardAria: (rank: string, suitLabel: string) => string;
  sub: (win: string, tie: string) => string;
  modeExact: (n: number) => string;
  modeMc: (n: number) => string;
}

const STRINGS: Record<Lang, Strings> = {
  fr: {
    suitLabel: ["pique", "cœur", "carreau", "trèfle"],
    suitShort: ["P", "Cœ", "Ca", "T"],
    you: "Toi",
    opponent: (i) => `Adversaire ${i}`,
    board: "Board",
    random: "main aléatoire",
    removeOpp: (i) => `retirer l'adversaire ${i}`,
    addOpp: "+ Adversaire",
    calc: "Calculer l'équité",
    reset: "Réinitialiser",
    pickTitle: "Choisis une carte",
    clearSlot: "Vider cet emplacement",
    emptyAria: "emplacement vide, choisir une carte",
    calcInProgress: "Calcul en cours…",
    errComplete: "Complète les 2 cartes de chaque joueur (ou coche « aléatoire »).",
    errBoard: "Le board doit avoir 0, 3, 4 ou 5 cartes.",
    randomName: "Aléatoire",
    cardAria: (rank, sl) => `${rank} de ${sl}`,
    sub: (w, t) => `victoire ${w} % · partage ${t} %`,
    modeExact: (n) => `calcul exact (${n} runouts)`,
    modeMc: (n) => `estimation Monte-Carlo (${n} tirages, ±~0,4 %)`,
  },
  en: {
    suitLabel: ["spades", "hearts", "diamonds", "clubs"],
    suitShort: ["S", "H", "D", "C"],
    you: "You",
    opponent: (i) => `Opponent ${i}`,
    board: "Board",
    random: "random hand",
    removeOpp: (i) => `remove opponent ${i}`,
    addOpp: "+ Opponent",
    calc: "Calculate equity",
    reset: "Reset",
    pickTitle: "Pick a card",
    clearSlot: "Clear this card",
    emptyAria: "empty slot, pick a card",
    calcInProgress: "Calculating…",
    errComplete: 'Fill both cards for each player (or check "random").',
    errBoard: "The board must have 0, 3, 4 or 5 cards.",
    randomName: "Random",
    cardAria: (rank, sl) => `${rank} of ${sl}`,
    sub: (w, t) => `win ${w}% · split ${t}%`,
    modeExact: (n) => `exact calculation (${n} runouts)`,
    modeMc: (n) => `Monte-Carlo estimate (${n} samples, ±~0.4%)`,
  },
};

type Slot = Card | null;
interface PlayerState { cards: [Slot, Slot]; random: boolean; }

const isRed = (suit: number) => suit === 1 || suit === 2; // cœur / carreau

export function mountCalculator(root: HTMLElement, lang: Lang = "fr") {
  const s = STRINGS[lang] ?? STRINGS.fr;
  let players: PlayerState[] = [
    { cards: [null, null], random: false },
    { cards: [null, null], random: false },
  ];
  let board: Slot[] = [null, null, null, null, null];
  let active: { kind: "player" | "board"; p?: number; i: number } | null = null;

  root.innerHTML = "";
  const el = (tag: string, cls?: string, txt?: string) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  const usedCards = (): Set<Card> => {
    const set = new Set<Card>();
    players.forEach((p) => p.cards.forEach((c) => c != null && set.add(c)));
    board.forEach((c) => c != null && set.add(c));
    return set;
  };

  const cardFace = (c: Slot, extraCls = ""): HTMLElement => {
    const b = el("button", `card ${extraCls}`) as HTMLButtonElement;
    b.type = "button";
    if (c == null) {
      b.classList.add("empty");
      b.setAttribute("aria-label", s.emptyAria);
      b.textContent = "+";
    } else {
      const su = suitOf(c);
      b.classList.add(isRed(su) ? "red" : "black");
      b.setAttribute("aria-label", s.cardAria(RANKS[c >> 2], s.suitLabel[su]));
      b.innerHTML = `<span class="r">${RANKS[c >> 2]}</span><span class="s">${SUIT_SYMBOL[su]}</span><span class="t">${s.suitShort[su]}</span>`;
    }
    return b;
  };

  const container = el("div", "pp-calc");
  const playersWrap = el("div", "players");
  const boardWrap = el("div", "board");
  const picker = el("div", "picker");
  const controls = el("div", "controls");
  const resultsWrap = el("div", "results");
  resultsWrap.setAttribute("aria-live", "polite");

  function renderPicker() {
    picker.innerHTML = "";
    if (!active) { picker.classList.remove("open"); return; }
    picker.classList.add("open");
    picker.appendChild(el("p", "picker-title", s.pickTitle));
    const used = usedCards();
    for (let su = 0; su < 4; su++) {
      const rowEl = el("div", `picker-row ${isRed(su) ? "red" : "black"}`);
      rowEl.setAttribute("role", "group");
      rowEl.setAttribute("aria-label", s.suitLabel[su]);
      for (let ri = 12; ri >= 0; ri--) {
        const c = makeCard(ri, su);
        const b = el("button", "pick") as HTMLButtonElement;
        b.type = "button";
        b.classList.add(isRed(su) ? "red" : "black");
        b.innerHTML = `${RANKS[ri]}<span class="s">${SUIT_SYMBOL[su]}</span>`;
        b.setAttribute("aria-label", s.cardAria(RANKS[ri], s.suitLabel[su]));
        if (used.has(c)) { b.disabled = true; b.setAttribute("aria-disabled", "true"); }
        b.addEventListener("click", () => assign(c));
        rowEl.appendChild(b);
      }
      picker.appendChild(rowEl);
    }
    const clear = el("button", "picker-clear", s.clearSlot) as HTMLButtonElement;
    clear.type = "button";
    clear.addEventListener("click", () => assign(null));
    picker.appendChild(clear);
  }

  function assign(c: Slot) {
    if (!active) return;
    if (active.kind === "player" && active.p != null) players[active.p].cards[active.i] = c;
    else if (active.kind === "board") board[active.i] = c;
    active = null;
    renderAll();
  }

  function setActive(a: typeof active) {
    active = a;
    renderAll();
    picker.querySelector("button:not([disabled])")?.scrollIntoView?.({ block: "nearest" });
  }

  function renderPlayers() {
    playersWrap.innerHTML = "";
    players.forEach((p, pi) => {
      const row = el("div", "player");
      row.appendChild(el("span", "pname", pi === 0 ? s.you : s.opponent(pi)));
      const slots = el("div", "slots");
      [0, 1].forEach((i) => {
        const face = cardFace(p.random ? null : p.cards[i], active?.kind === "player" && active.p === pi && active.i === i ? "active" : "");
        if (p.random) { (face as HTMLButtonElement).disabled = true; face.classList.add("dim"); }
        else face.addEventListener("click", () => setActive({ kind: "player", p: pi, i }));
        slots.appendChild(face);
      });
      row.appendChild(slots);
      if (pi > 0) {
        const rnd = el("label", "rnd");
        const cb = el("input") as HTMLInputElement;
        cb.type = "checkbox"; cb.checked = p.random;
        cb.addEventListener("change", () => { p.random = cb.checked; if (p.random) p.cards = [null, null]; renderAll(); });
        rnd.appendChild(cb); rnd.appendChild(document.createTextNode(" " + s.random));
        row.appendChild(rnd);
        const del = el("button", "del", "✕") as HTMLButtonElement;
        del.type = "button"; del.setAttribute("aria-label", s.removeOpp(pi));
        del.addEventListener("click", () => { players.splice(pi, 1); renderAll(); });
        row.appendChild(del);
      }
      playersWrap.appendChild(row);
    });
  }

  function renderBoard() {
    boardWrap.innerHTML = "";
    boardWrap.appendChild(el("span", "blabel", s.board));
    const slots = el("div", "slots");
    board.forEach((c, i) => {
      const face = cardFace(c, active?.kind === "board" && active.i === i ? "active" : "");
      face.addEventListener("click", () => setActive({ kind: "board", i }));
      slots.appendChild(face);
    });
    boardWrap.appendChild(slots);
  }

  function renderControls() {
    controls.innerHTML = "";
    const add = el("button", "ctl", s.addOpp) as HTMLButtonElement;
    add.type = "button"; add.disabled = players.length >= 6;
    add.addEventListener("click", () => { if (players.length < 6) { players.push({ cards: [null, null], random: false }); renderAll(); } });
    const calc = el("button", "ctl primary", s.calc) as HTMLButtonElement;
    calc.type = "button"; calc.addEventListener("click", run);
    const reset = el("button", "ctl", s.reset) as HTMLButtonElement;
    reset.type = "button";
    reset.addEventListener("click", () => {
      players = [{ cards: [null, null], random: false }, { cards: [null, null], random: false }];
      board = [null, null, null, null, null]; active = null; resultsWrap.innerHTML = ""; renderAll();
    });
    controls.append(add, calc, reset);
  }

  function run() {
    const hands: Hand[] = [];
    for (const p of players) {
      if (p.random) hands.push({ cards: [], random: true });
      else {
        if (p.cards[0] == null || p.cards[1] == null) { resultsWrap.innerHTML = `<p class="err"></p>`; resultsWrap.querySelector(".err")!.textContent = s.errComplete; return; }
        hands.push({ cards: [p.cards[0], p.cards[1]], random: false });
      }
    }
    const b = board.filter((c): c is Card => c != null);
    if (![0, 3, 4, 5].includes(b.length)) { resultsWrap.innerHTML = `<p class="err"></p>`; resultsWrap.querySelector(".err")!.textContent = s.errBoard; return; }
    resultsWrap.innerHTML = `<p class="calc"></p>`; resultsWrap.querySelector(".calc")!.textContent = s.calcInProgress;
    setTimeout(() => {
      try {
        renderResults(computeEquity(hands, b, { mcSamples: 30000 }), hands);
      } catch (e) {
        resultsWrap.innerHTML = `<p class="err"></p>`; resultsWrap.querySelector(".err")!.textContent = (e as Error).message;
      }
    }, 30);
  }

  function renderResults(r: ReturnType<typeof computeEquity>, hands: Hand[]) {
    resultsWrap.innerHTML = "";
    const order = r.results.map((_, i) => i).sort((a, b) => r.results[b].equity - r.results[a].equity);
    order.forEach((i, rank) => {
      const label = hands[i].random ? s.randomName : (i === 0 ? s.you : s.opponent(i));
      const hand = hands[i].random ? "? ?" : hands[i].cards.map(formatCard).join(" ");
      const res = r.results[i];
      const rowEl = el("div", "resrow");
      rowEl.innerHTML =
        `<div class="rhead"><span class="rname">${rank === 0 ? "⭐ " : ""}${label}</span><span class="rhand">${hand}</span>` +
        `<strong class="req">${res.equity.toFixed(1)} %</strong></div>` +
        `<div class="bar"><span style="width:${res.equity.toFixed(1)}%"></span></div>`;
      const sub = el("p", "sub", s.sub(res.win.toFixed(1), res.tie.toFixed(1)));
      rowEl.appendChild(sub);
      resultsWrap.appendChild(rowEl);
    });
    resultsWrap.appendChild(el("p", "mode", r.exact ? s.modeExact(r.iterations) : s.modeMc(r.iterations)));
  }

  function renderAll() { renderPlayers(); renderBoard(); renderPicker(); renderControls(); }

  container.append(playersWrap, boardWrap, picker, controls, resultsWrap);
  root.appendChild(container);
  renderAll();
}

// Auto-montage : langue lue sur l'élément hôte (data-lang).
const target = typeof document !== "undefined" && document.getElementById("equity-calculator");
if (target) {
  const lang = ((target as HTMLElement).dataset.lang === "en" ? "en" : "fr") as Lang;
  mountCalculator(target as HTMLElement, lang);
}
