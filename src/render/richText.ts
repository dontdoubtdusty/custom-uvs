// Parses effect text (**bold**, {symbol} and [[ability label]]) and lays it out into wrapped lines
// for the canvas. Knows nothing about cards; the card renderer passes in a box, fonts and a symbol painter.

import { getSymbol } from "../model/symbols";

export interface TextItem {
  kind: "word" | "space" | "symbol" | "label";
  /** Word text, the symbol id for symbols, or the label text for ability labels. */
  text: string;
  bold: boolean;
  italic: boolean;
  /** Set by layout: offset from the line start and measured width. */
  x: number;
  width: number;
}

/** One paragraph of items. ruleBefore draws a thin divider above it (used before flavor text). */
export interface Paragraph { items: TextItem[]; ruleBefore: boolean; }
export interface TextLine { items: TextItem[]; width: number; paragraphEnd: boolean; ruleBefore: boolean; }
export interface FittedText { lines: TextLine[]; size: number; lineHeight: number; }
export interface Box { x: number; y: number; w: number; h: number; }

export type SymbolPainter = (ctx: CanvasRenderingContext2D, symbolId: string, cx: number, cy: number, r: number) => void;

/** Color of ability label chips and their text. */
const LABEL_FILL = "#1C2026";
const LABEL_INK = "#FFFFFF";

/** Splits text into paragraphs of words, spaces, symbols and labels. Bold carries across lines. */
export function parse(text: string, italic = false): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let bold = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    const items: TextItem[] = [];
    const pattern = /\[\[([^\]]*)\]\]|\*\*|\{([a-zA-Z]+)\}|\s+|[^\s*{[]+|[*{[]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      const token = match[0];
      const label = match[1] !== undefined ? match[1].trim() : "";
      const symbolId = match[2] ? match[2].toLowerCase() : "";
      const item = (kind: TextItem["kind"], value: string): TextItem => ({ kind, text: value, bold, italic, x: 0, width: 0 });
      if (match[1] !== undefined) { if (label) items.push(item("label", label.toUpperCase())); }
      else if (token === "**") bold = !bold;
      else if (symbolId && getSymbol(symbolId)) items.push(item("symbol", symbolId));
      else if (/^\s+$/.test(token)) items.push(item("space", " "));
      else items.push(item("word", token));
    }
    paragraphs.push({ items, ruleBefore: false });
  }
  return paragraphs;
}

/** Builds the canvas font string for body text. */
function fontFor(size: number, bold: boolean, italic: boolean, family: string): string {
  return (italic ? "italic " : "") + (bold ? "700 " : "400 ") + size + "px " + family;
}

/** Font for the text inside an ability label chip. */
function labelFont(size: number, family: string): string {
  return `700 ${Math.round(size * 0.78)}px ${family}`;
}

/** Measures every item and wraps paragraphs into lines no wider than maxWidth. */
export function layout(ctx: CanvasRenderingContext2D, paragraphs: Paragraph[], maxWidth: number, size: number, family: string): TextLine[] {
  const symbolWidth = size * 1.05;
  const lines: TextLine[] = [];
  ctx.font = fontFor(size, false, false, family);
  const spaceWidth = ctx.measureText(" ").width;

  for (const paragraph of paragraphs) {
    // Group consecutive non-space items into chunks; lines only break between chunks.
    const chunks: TextItem[][] = [];
    let current: TextItem[] = [];
    for (const item of paragraph.items) {
      if (item.kind === "space") {
        if (current.length) chunks.push(current);
        current = [];
        continue;
      }
      if (item.kind === "symbol") {
        item.width = symbolWidth;
      } else if (item.kind === "label") {
        ctx.font = labelFont(size, family);
        item.width = ctx.measureText(item.text).width + size * 0.6;
      } else {
        ctx.font = fontFor(size, item.bold, item.italic, family);
        item.width = ctx.measureText(item.text).width;
      }
      current.push(item);
    }
    if (current.length) chunks.push(current);

    let line: TextLine = { items: [], width: 0, paragraphEnd: false, ruleBefore: paragraph.ruleBefore };
    for (const chunk of chunks) {
      const chunkWidth = chunk.reduce((sum, it) => sum + it.width, 0);
      const gap = line.items.length ? spaceWidth : 0;
      if (line.items.length && line.width + gap + chunkWidth > maxWidth) {
        lines.push(line);
        line = { items: [], width: 0, paragraphEnd: false, ruleBefore: false };
      }
      let x = line.width + (line.items.length ? spaceWidth : 0);
      for (const it of chunk) {
        it.x = x;
        x += it.width;
        line.items.push(it);
      }
      line.width = x;
    }
    line.paragraphEnd = true;
    lines.push(line);
  }
  return lines;
}

/** Total height of laid-out lines, including paragraph gaps and divider space. */
function measureHeight(lines: TextLine[], size: number, lineHeight: number): number {
  const paraGap = size * 0.35;
  const ruleGap = size * 0.9;
  let height = lines.length * lineHeight;
  lines.forEach((line, i) => {
    if (line.paragraphEnd && i < lines.length - 1) height += paraGap;
    if (line.ruleBefore) height += ruleGap;
  });
  return height;
}

/**
 * Finds the largest font size (maxSize down to minSize) whose wrapped text fits the box.
 * Flavor text, when given, follows the effect text in italics below a thin divider.
 */
export function fit(ctx: CanvasRenderingContext2D, text: string, box: Box, family: string, maxSize: number, minSize: number, flavor = ""): FittedText {
  const paragraphs = String(text || "").trim() ? parse(text) : [];
  if (String(flavor || "").trim()) {
    const flavorParagraphs = parse(flavor.trim(), true);
    if (paragraphs.length) flavorParagraphs[0].ruleBefore = true;
    paragraphs.push(...flavorParagraphs);
  }
  let result: FittedText = { lines: [], size: maxSize, lineHeight: maxSize * 1.22 };
  for (let size = maxSize; size >= minSize; size--) {
    const lineHeight = size * 1.22;
    const lines = layout(ctx, paragraphs, box.w, size, family);
    result = { lines, size, lineHeight };
    if (measureHeight(lines, size, lineHeight) <= box.h) break;
  }
  return result;
}

/** Draws an ability label: a dark rounded chip with the label in white capitals. */
function drawLabel(ctx: CanvasRenderingContext2D, item: TextItem, x: number, baseline: number, size: number, family: string): void {
  const h = size * 1.02;
  const top = baseline - size * 0.82;
  ctx.beginPath();
  ctx.roundRect(x + size * 0.04, top, item.width - size * 0.08, h, size * 0.18);
  ctx.fillStyle = LABEL_FILL;
  ctx.fill();
  ctx.fillStyle = LABEL_INK;
  ctx.font = labelFont(size, family);
  ctx.textAlign = "center";
  ctx.fillText(item.text, x + item.width / 2, baseline - size * 0.06);
  ctx.textAlign = "left";
}

/** Draws fitted lines inside the box, painting inline symbols with the given painter. */
export function draw(ctx: CanvasRenderingContext2D, fitted: FittedText, box: Box, family: string, color: string, paintSymbol: SymbolPainter): void {
  const size = fitted.size;
  const paraGap = size * 0.35;
  const ruleGap = size * 0.9;
  let y = box.y + size;
  ctx.textBaseline = "alphabetic";
  for (const line of fitted.lines) {
    if (line.ruleBefore) {
      // A short divider halfway into the gap above the flavor text.
      const ruleY = y - size - paraGap / 2 + ruleGap / 2;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(box.x, ruleY, box.w * 0.4, 2);
      ctx.globalAlpha = 1;
      y += ruleGap;
    }
    for (const it of line.items) {
      const x = box.x + it.x;
      if (it.kind === "symbol") {
        paintSymbol(ctx, it.text, x + it.width / 2, y - size * 0.34, size * 0.47);
      } else if (it.kind === "label") {
        drawLabel(ctx, it, x, y, size, family);
      } else {
        ctx.fillStyle = color;
        ctx.font = fontFor(size, it.bold, it.italic, family);
        ctx.fillText(it.text, x, y);
      }
    }
    y += fitted.lineHeight + (line.paragraphEnd ? paraGap : 0);
  }
}
