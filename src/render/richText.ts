// Parses effect text (**bold** and {symbol}) and lays it out into wrapped lines for the canvas.
// Knows nothing about cards; the card renderer passes in a box, fonts and a symbol painter.

import { getSymbol } from "../model/symbols";

export interface TextItem {
  kind: "word" | "space" | "symbol";
  /** Word text, or the symbol id for symbols. */
  text: string;
  bold: boolean;
  /** Set by layout: offset from the line start and measured width. */
  x: number;
  width: number;
}

export interface TextLine { items: TextItem[]; width: number; paragraphEnd: boolean; }
export interface FittedText { lines: TextLine[]; size: number; lineHeight: number; }
export interface Box { x: number; y: number; w: number; h: number; }

export type SymbolPainter = (ctx: CanvasRenderingContext2D, symbolId: string, cx: number, cy: number, r: number) => void;

/** Splits effect text into paragraphs of words, spaces and symbols. Bold carries across lines. */
export function parse(text: string): TextItem[][] {
  const paragraphs: TextItem[][] = [];
  let bold = false;
  for (const line of String(text || "").split(/\r?\n/)) {
    const items: TextItem[] = [];
    const pattern = /\*\*|\{([a-zA-Z]+)\}|\s+|[^\s*{]+|[*{]/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line)) !== null) {
      const token = match[0];
      const symbolId = match[1] ? match[1].toLowerCase() : "";
      if (token === "**") bold = !bold;
      else if (symbolId && getSymbol(symbolId)) items.push({ kind: "symbol", text: symbolId, bold, x: 0, width: 0 });
      else if (/^\s+$/.test(token)) items.push({ kind: "space", text: " ", bold, x: 0, width: 0 });
      else items.push({ kind: "word", text: token, bold, x: 0, width: 0 });
    }
    paragraphs.push(items);
  }
  return paragraphs;
}

/** Builds the canvas font string for body text. */
function fontFor(size: number, bold: boolean, family: string): string {
  return (bold ? "700 " : "400 ") + size + "px " + family;
}

/** Measures every item and wraps paragraphs into lines no wider than maxWidth. */
export function layout(ctx: CanvasRenderingContext2D, paragraphs: TextItem[][], maxWidth: number, size: number, family: string): TextLine[] {
  const symbolWidth = size * 1.05;
  const lines: TextLine[] = [];
  ctx.font = fontFor(size, false, family);
  const spaceWidth = ctx.measureText(" ").width;

  for (const items of paragraphs) {
    // Group consecutive non-space items into chunks; lines only break between chunks.
    const chunks: TextItem[][] = [];
    let current: TextItem[] = [];
    for (const item of items) {
      if (item.kind === "space") {
        if (current.length) chunks.push(current);
        current = [];
        continue;
      }
      ctx.font = fontFor(size, item.bold, family);
      item.width = item.kind === "symbol" ? symbolWidth : ctx.measureText(item.text).width;
      current.push(item);
    }
    if (current.length) chunks.push(current);

    let line: TextLine = { items: [], width: 0, paragraphEnd: false };
    for (const chunk of chunks) {
      const chunkWidth = chunk.reduce((sum, it) => sum + it.width, 0);
      const gap = line.items.length ? spaceWidth : 0;
      if (line.items.length && line.width + gap + chunkWidth > maxWidth) {
        lines.push(line);
        line = { items: [], width: 0, paragraphEnd: false };
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

/** Finds the largest font size (maxSize down to minSize) whose wrapped text fits the box. */
export function fit(ctx: CanvasRenderingContext2D, text: string, box: Box, family: string, maxSize: number, minSize: number): FittedText {
  const paragraphs = parse(text);
  let result: FittedText = { lines: [], size: maxSize, lineHeight: maxSize * 1.22 };
  for (let size = maxSize; size >= minSize; size--) {
    const lineHeight = size * 1.22;
    const lines = layout(ctx, paragraphs, box.w, size, family);
    const paraGap = size * 0.35;
    const paragraphCount = lines.filter((l) => l.paragraphEnd).length;
    const height = lines.length * lineHeight + (paragraphCount - 1) * paraGap;
    result = { lines, size, lineHeight };
    if (height <= box.h) break;
  }
  return result;
}

/** Draws fitted lines inside the box, painting inline symbols with the given painter. */
export function draw(ctx: CanvasRenderingContext2D, fitted: FittedText, box: Box, family: string, color: string, paintSymbol: SymbolPainter): void {
  const size = fitted.size;
  const paraGap = size * 0.35;
  let y = box.y + size;
  ctx.textBaseline = "alphabetic";
  for (const line of fitted.lines) {
    for (const it of line.items) {
      const x = box.x + it.x;
      if (it.kind === "symbol") {
        paintSymbol(ctx, it.text, x + it.width / 2, y - size * 0.34, size * 0.47);
      } else {
        ctx.fillStyle = color;
        ctx.font = fontFor(size, it.bold, family);
        ctx.fillText(it.text, x, y);
      }
    }
    y += fitted.lineHeight + (line.paragraphEnd ? paraGap : 0);
  }
}
