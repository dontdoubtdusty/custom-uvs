// The card data shape and helpers to create and copy cards. No rendering or storage here.
// Stats are strings so values like "X" or "*" work. A blank stat is not printed.

import type { CardTypeId, ZoneId } from "./cardTypes";
import type { SymbolId } from "./symbols";
import { newId } from "./ids";

/** One resource symbol on a card. Attuned symbols print as squares instead of circles. */
export interface CardSymbol {
  id: SymbolId;
  attuned: boolean;
}

/** One custom card as it is saved. Changing this shape needs a migration. */
export interface Card {
  id: string;
  setId: string;
  /** Position within its set, printed as 001. */
  number: number;
  name: string;
  type: CardTypeId;
  /** Comma separated; printed on the type line joined with dots. */
  keywords: string;
  /** Effect text; supports **bold**, [[ability label]] and {symbol}. */
  text: string;
  /** Flavor text, printed in italics below the effect text. Blank prints nothing. */
  flavor: string;
  difficulty: string;
  check: string;
  blockModifier: string;
  blockZone: ZoneId | "none";
  speed: string;
  damage: string;
  attackZone: ZoneId;
  handSize: string;
  health: string;
  stamina: string;
  /** Character version, printed as a roman numeral, e.g. "II". */
  version: string;
  symbols: CardSymbol[];
  /** Key of the image in the art store, or null when there is no art. */
  artId: string | null;
  /** Art offset from centered, in card pixels. */
  artPanX: number;
  artPanY: number;
  /** 1 means the art exactly covers the art window. */
  artZoom: number;
  artist: string;
  rarity: string;
  createdAt: number;
  updatedAt: number;
}

/** Builds a new attack card with sensible starting values. */
export function createCard(setId: string, number: number): Card {
  const now = Date.now();
  return {
    id: newId(),
    setId,
    number,
    name: "New card",
    type: "attack",
    keywords: "",
    text: "",
    flavor: "",
    difficulty: "3",
    check: "4",
    blockModifier: "2",
    blockZone: "mid",
    speed: "4",
    damage: "4",
    attackZone: "mid",
    handSize: "6",
    health: "20",
    stamina: "3",
    version: "",
    symbols: [],
    artId: null,
    artPanX: 0,
    artPanY: 0,
    artZoom: 1,
    artist: "",
    rarity: "C",
    createdAt: now,
    updatedAt: now
  };
}

/** Fills in fields that cards saved by older versions may lack. Used when reading saved cards. */
export function normalizeCard(card: Card): Card {
  return { ...card, flavor: typeof card.flavor === "string" ? card.flavor : "" };
}

/** Returns a deep copy so callers can change it without touching the original. */
export function cloneCard(card: Card): Card {
  return { ...card, symbols: card.symbols.map((s) => ({ ...s })) };
}

/** Formats the card number as three digits, e.g. 7 becomes "007". */
export function formatNumber(n: number): string {
  return String(n).padStart(3, "0");
}
