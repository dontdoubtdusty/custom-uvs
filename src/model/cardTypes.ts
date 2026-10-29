// Card type definitions: which stat fields each type shows, its color, and the option lists.
// Type colors follow the official convention of identifying a card type by its text box color.

import type { Card } from "./card";

export type CardTypeId = "attack" | "foundation" | "action" | "asset" | "backup" | "character" | "token";
export type ZoneId = "high" | "mid" | "low";

/** Card properties that hold a short stat value. */
export type StatKey =
  | "difficulty" | "check" | "blockModifier" | "speed" | "damage"
  | "handSize" | "health" | "stamina" | "version";

/** A stat field shown in the editor. "zone" fields pick High, Mid or Low. */
export type StatField =
  | { kind: "text"; key: StatKey; label: string; optional?: boolean }
  | { kind: "zone"; key: "blockZone" | "attackZone"; label: string; allowNone: boolean };

export interface CardTypeDef {
  id: CardTypeId;
  name: string;
  /** Text box and type line color. */
  color: string;
  stats: readonly StatField[];
  /** Shown under the stats when part of the layout is not yet confirmed. */
  note?: string;
}

const DIFFICULTY: StatField = { kind: "text", key: "difficulty", label: "Difficulty" };
const CHECK: StatField = { kind: "text", key: "check", label: "Check" };
const BLOCK_MOD: StatField = { kind: "text", key: "blockModifier", label: "Block modifier" };
const BLOCK_ZONE: StatField = { kind: "zone", key: "blockZone", label: "Block zone", allowNone: true };

/** Stats shared by foundations, actions, assets and the base of attacks and backups. */
const FORM_STATS: readonly StatField[] = [DIFFICULTY, CHECK, BLOCK_MOD, BLOCK_ZONE];

export const CARD_TYPES: readonly CardTypeDef[] = [
  { id: "attack", name: "Attack", color: "#D9752B",
    stats: [...FORM_STATS,
      { kind: "text", key: "speed", label: "Speed" },
      { kind: "text", key: "damage", label: "Damage" },
      { kind: "zone", key: "attackZone", label: "Attack zone", allowNone: false }] },
  { id: "foundation", name: "Foundation", color: "#7C8591", stats: FORM_STATS },
  { id: "action", name: "Action", color: "#2F79C4", stats: FORM_STATS },
  { id: "asset", name: "Asset", color: "#3F9A4E", stats: FORM_STATS },
  { id: "backup", name: "Backup", color: "#D35B95",
    stats: [...FORM_STATS, { kind: "text", key: "stamina", label: "Stamina" }] },
  { id: "character", name: "Character", color: "#B48A2C",
    stats: [
      { kind: "text", key: "handSize", label: "Hand size" },
      { kind: "text", key: "health", label: "Health" },
      { kind: "text", key: "version", label: "Version", optional: true },
      { kind: "text", key: "blockModifier", label: "Block modifier", optional: true },
      BLOCK_ZONE,
      { kind: "text", key: "difficulty", label: "Difficulty", optional: true },
      { kind: "text", key: "check", label: "Check", optional: true }] },
  { id: "token", name: "Token", color: "#7A5AA6",
    stats: [
      { kind: "text", key: "difficulty", label: "Difficulty", optional: true },
      { kind: "text", key: "check", label: "Check", optional: true },
      { kind: "text", key: "blockModifier", label: "Block modifier", optional: true },
      BLOCK_ZONE],
    note: "The official token layout is still to confirm. Leave a stat blank to hide it." }
];

export interface ZoneDef { id: ZoneId; name: string; color: string; }

/** Zones for blocks and attacks, with their highlight colors. */
export const ZONES: readonly ZoneDef[] = [
  { id: "high", name: "High", color: "#E0483E" },
  { id: "mid", name: "Mid", color: "#EE9A2E" },
  { id: "low", name: "Low", color: "#E8C531" }
];

export interface RarityDef { id: string; name: string; }

/** Rarity codes printed in the card footer. */
export const RARITIES: readonly RarityDef[] = [
  { id: "C", name: "Common" },
  { id: "U", name: "Uncommon" },
  { id: "R", name: "Rare" },
  { id: "UR", name: "Ultra rare" },
  { id: "SR", name: "Secret rare" },
  { id: "P", name: "Promo" }
];

/** Returns the type definition for an id, falling back to Attack. */
export function getCardType(id: string): CardTypeDef {
  return CARD_TYPES.find((t) => t.id === id) ?? CARD_TYPES[0];
}

/** Returns the zone definition for an id, or undefined for "none" or blank. */
export function getZone(id: string): ZoneDef | undefined {
  return ZONES.find((z) => z.id === id);
}

/** True when the card's type shows this stat in the editor (and so on the card). */
export function typeShowsStat(card: Card, key: string): boolean {
  return getCardType(card.type).stats.some((s) => s.key === key);
}
