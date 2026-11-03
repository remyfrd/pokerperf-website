// Modèle de cartes — Texas Hold'em.
// Une carte = un entier 0..51 pour la vitesse (Monte-Carlo), avec helpers lisibles.
//   id = rankIndex * 4 + suit        rankIndex 0..12 (2..A)   suit 0..3 (s,h,d,c)

export const RANKS = "23456789TJQKA"; // index 0..12  → valeur 2..14
export const SUITS = "shdc"; // s=pique h=cœur d=carreau c=trèfle
export const SUIT_SYMBOL = ["♠", "♥", "♦", "♣"] as const;

export type Card = number; // 0..51

export function makeCard(rankIndex: number, suit: number): Card {
  return rankIndex * 4 + suit;
}

/** Valeur de rang 2..14 (A=14). */
export function rankValue(c: Card): number {
  return (c >> 2) + 2;
}

/** Couleur 0..3 (s,h,d,c). */
export function suitOf(c: Card): number {
  return c & 3;
}

export const FULL_DECK: Card[] = Array.from({ length: 52 }, (_, i) => i);

/** "As" → id.  Rangs 2..A, couleurs shdc. Insensible à la casse. */
export function parseCard(tok: string): Card {
  const t = tok.trim();
  if (t.length !== 2) throw new Error(`Carte invalide : "${tok}" (attendu rang+couleur, ex. As)`);
  const ri = RANKS.indexOf(t[0].toUpperCase());
  const su = SUITS.indexOf(t[1].toLowerCase());
  if (ri < 0 || su < 0) throw new Error(`Carte invalide : "${tok}" (rangs ${RANKS}, couleurs ${SUITS})`);
  return makeCard(ri, su);
}

/** "As Ks" ou "AsKs" → [id, id]. Chaîne vide → []. */
export function parseCards(s: string): Card[] {
  const str = s.trim();
  if (!str) return [];
  const toks = str.includes(" ") ? str.split(/\s+/) : (str.match(/.{1,2}/g) ?? []);
  return toks.map(parseCard);
}

export function formatCard(c: Card): string {
  return RANKS[c >> 2] + SUIT_SYMBOL[c & 3];
}

export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(" ");
}
