// The set data shape: a named group of cards with a short code printed on each card.

import { newId } from "./ids";

/** One set as it is saved. Changing this shape needs a migration. */
export interface CardSet {
  id: string;
  name: string;
  /** Short code printed in the card footer, e.g. "MYS". */
  code: string;
  createdAt: number;
  updatedAt: number;
}

/** Keeps only letters and digits, uppercased, max 5 characters. */
export function cleanCode(code: string): string {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

/** Builds a new set, filling in a name and code when they are blank. */
export function createSet(name: string, code: string): CardSet {
  const now = Date.now();
  return {
    id: newId(),
    name: name.trim() || "My set",
    code: cleanCode(code) || "SET",
    createdAt: now,
    updatedAt: now
  };
}
