// The set data shape: a named group of cards with a short code printed on each card.

import { newId } from "./ids";

/** One set as it is saved. Changing this shape needs a migration. */
export interface CardSet {
  id: string;
  name: string;
  /** Short code printed in the card footer, e.g. "MYS". */
  code: string;
  /** Number of cards in the set, printed as 21/185. 0 prints just the card number. */
  size: number;
  createdAt: number;
  updatedAt: number;
}

/** Keeps only letters and digits, uppercased, max 5 characters. */
export function cleanCode(code: string): string {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

/** Keeps a set size a whole number from 0 to 999; anything else becomes 0. */
export function cleanSize(size: unknown): number {
  const n = Math.floor(Number(size));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 999) : 0;
}

/** Fills in fields that sets saved by older versions may lack. Used when reading saved sets. */
export function normalizeSet(set: CardSet): CardSet {
  return { ...set, size: cleanSize(set.size) };
}

/** Builds a new set, filling in a name and code when they are blank. */
export function createSet(name: string, code: string): CardSet {
  const now = Date.now();
  return {
    id: newId(),
    name: name.trim() || "My set",
    code: cleanCode(code) || "SET",
    size: 0,
    createdAt: now,
    updatedAt: now
  };
}
