// Resource symbol definitions: id, display name, colors and an original line glyph.
// Glyph paths live in a 24x24 box and are drawn as strokes, both in the UI (SVG) and on the card (canvas).

export type SymbolId =
  | "air" | "all" | "chaos" | "death" | "earth" | "evil" | "fire"
  | "good" | "infinity" | "life" | "order" | "void" | "water";

export interface SymbolDef {
  id: SymbolId;
  name: string;
  /** Background color of the symbol disc. */
  fill: string;
  /** Stroke color of the glyph. */
  ink: string;
  /** SVG path data in a 24x24 box. */
  path: string;
}

export const SYMBOLS: readonly SymbolDef[] = [
  { id: "air", name: "Air", fill: "#7FB3C8", ink: "#FFFFFF",
    path: "M3 9h11a3 3 0 1 0-3-3 M3 13h15a3 3 0 1 1-3 3 M3 17h7" },
  { id: "all", name: "All", fill: "#C9CCD1", ink: "#2A2F36",
    path: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z" },
  { id: "chaos", name: "Chaos", fill: "#A23A7E", ink: "#FFFFFF",
    path: "M12 3v18 M3 12h18 M5.6 5.6l12.8 12.8 M18.4 5.6L5.6 18.4" },
  { id: "death", name: "Death", fill: "#33363B", ink: "#FFFFFF",
    path: "M6 12a6 6 0 1 1 12 0v3h-2.5v4h-7v-4H6z M9.5 11.5h.5 M14 11.5h.5" },
  { id: "earth", name: "Earth", fill: "#8A6A3B", ink: "#FFFFFF",
    path: "M3 19l6-10 4 6 2-3 6 7z" },
  { id: "evil", name: "Evil", fill: "#6E1E2E", ink: "#FFFFFF",
    path: "M12 20L4 7h16z M8 7L6 3 M16 7l2-4" },
  { id: "fire", name: "Fire", fill: "#D9502E", ink: "#FFFFFF",
    path: "M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-6 2 1 3 3 3 3s2-3 1-8z" },
  { id: "good", name: "Good", fill: "#E7BE3A", ink: "#3A2E08",
    path: "M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3 M5.3 5.3l2.1 2.1 M16.6 16.6l2.1 2.1 M5.3 18.7l2.1-2.1 M16.6 7.4l2.1-2.1" },
  { id: "infinity", name: "Infinity", fill: "#2D6BB5", ink: "#FFFFFF",
    path: "M12 12c-2-2.7-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.3 6-4s4-4 6-4a4 4 0 0 1 0 8c-2 0-4-1.3-6-4z" },
  { id: "life", name: "Life", fill: "#4C9A3F", ink: "#FFFFFF",
    path: "M5 19C5 10 10 5 19 5c0 9-5 14-14 14z M5 19l8-8" },
  { id: "order", name: "Order", fill: "#3A5FA0", ink: "#FFFFFF",
    path: "M12 3l9 9-9 9-9-9z M12 8v8 M8 12h8" },
  { id: "void", name: "Void", fill: "#4E3F86", ink: "#FFFFFF",
    path: "M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4z" },
  { id: "water", name: "Water", fill: "#2E86C1", ink: "#FFFFFF",
    path: "M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11z" }
];

/** Looks up a symbol by id; returns undefined for unknown ids. */
export function getSymbol(id: string): SymbolDef | undefined {
  return SYMBOLS.find((s) => s.id === id);
}
