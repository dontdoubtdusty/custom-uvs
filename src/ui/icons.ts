// Inline SVG icons for the interface, and SVG versions of the resource symbols.

import { getSymbol } from "../model/symbols";

/** Line icon paths in a 24x24 box, drawn with currentColor. */
const PATHS = {
  plus: "M12 5v14 M5 12h14",
  copy: "M9 9h10v10H9z M5 15V5h10",
  trash: "M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v6 M14 11v6",
  upload: "M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4",
  reset: "M4 12a8 8 0 1 0 2.3-5.7 M4 4v4h4",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7z M7 12h7a3.5 3.5 0 0 1 0 7H7z"
} as const;

export type IconName = keyof typeof PATHS;

/** Returns an inline SVG icon by name. */
export function icon(name: IconName): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${PATHS[name]}"/></svg>`;
}

/** Returns an inline SVG for a resource symbol, matching the card: a disc, or a square when attuned. */
export function symbolSvg(symbolId: string, attuned = false): string {
  const def = getSymbol(symbolId);
  if (!def) return "";
  const shape = attuned
    ? `<rect x="1.5" y="1.5" width="29" height="29" rx="5" fill="${def.fill}" stroke="#16181C" stroke-width="1.5"/>`
    : `<circle cx="16" cy="16" r="14.5" fill="${def.fill}" stroke="#16181C" stroke-width="1.5"/>`;
  return `<svg class="symbol" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${shape}` +
    `<g transform="translate(4 4)"><path d="${def.path}" fill="none" stroke="${def.ink}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
}
