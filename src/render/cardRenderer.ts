// Draws a card onto a canvas from card data. Pure drawing: reads data, changes nothing.
// All coordinates are card pixels: 750 x 1050, which is 2.5 x 3.5 inches at 300 dpi.
// The frame is an original design that places information where UniVersus players expect it:
// difficulty top left, block shield top right, check value bottom right, attack zone on the right edge.

import { formatNumber, type Card, type CardSymbol } from "../model/card";
import { getCardType, getZone, typeShowsStat, ZONES } from "../model/cardTypes";
import { getSymbol } from "../model/symbols";
import { draw as drawRichText, fit as fitRichText, type Box } from "./richText";

export const CARD_WIDTH = 750;
export const CARD_HEIGHT = 1050;

const DISPLAY = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
const BODY = 'Barlow, "Segoe UI", Arial, sans-serif';
const INK = "#16181C";
const PAPER = "#F6F4EF";
const RED = "#C8392E";
const GREEN = "#2F9157";

/** Fixed regions of the frame. */
export const ART_RECT: Box = { x: 44, y: 128, w: 662, h: 432 };
const TYPE_LINE: Box = { x: 44, y: 572, w: 662, h: 54 };
const TEXT_BOX: Box = { x: 44, y: 636, w: 662, h: 250 };
const BAND_Y = 944;

export interface DrawOptions {
  artImage?: HTMLImageElement | null;
  setCode?: string;
}

/** Returns a stat's trimmed value when the card's type shows it, otherwise "". */
function stat(card: Card, key: keyof Card): string {
  if (!typeShowsStat(card, key)) return "";
  return String(card[key] ?? "").trim();
}

/** Traces a rounded rectangle path (does not fill or stroke). */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Mixes a hex color toward black (negative amount) or white (positive amount). */
function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const mix = (c: number) => Math.round(c + (target - c) * Math.abs(amount));
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/** Sets the font, shrinking from maxSize until the text fits maxWidth. Returns the size used. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, style: string, maxSize: number, minSize: number, maxWidth: number): number {
  let size = maxSize;
  for (; size > minSize; size--) {
    ctx.font = `${style} ${size}px ${DISPLAY}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.font = `${style} ${size}px ${DISPLAY}`;
  return size;
}

/** Writes centered display text, shrinking it to fit. */
function centerText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, maxWidth: number, color: string): void {
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, text, "700", size, 16, maxWidth);
  ctx.fillText(text, cx, cy + size * 0.05);
  ctx.textAlign = "left";
}

/** Draws a resource symbol at (cx, cy): a disc, or a rounded square when attuned. */
export function drawSymbol(ctx: CanvasRenderingContext2D, symbolId: string, cx: number, cy: number, r: number, attuned = false): void {
  const def = getSymbol(symbolId);
  if (!def) return;
  ctx.save();
  if (attuned) {
    const side = r * 1.84;
    roundRect(ctx, cx - side / 2, cy - side / 2, side, side, r * 0.3);
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  }
  ctx.fillStyle = def.fill;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.strokeStyle = INK;
  ctx.stroke();
  const scale = (r * 1.25) / 24;
  ctx.translate(cx - 12 * scale, cy - 12 * scale);
  ctx.scale(scale, scale);
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = def.ink;
  ctx.stroke(new Path2D(def.path));
  ctx.restore();
}

/** Position and size of the art for a card's pan and zoom, clamped so the art always covers the window. */
export function artPlacement(img: HTMLImageElement, card: Card) {
  const a = ART_RECT;
  const zoom = Math.max(1, card.artZoom || 1);
  const scale = Math.max(a.w / img.naturalWidth, a.h / img.naturalHeight) * zoom;
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const maxX = (w - a.w) / 2;
  const maxY = (h - a.h) / 2;
  const panX = Math.max(-maxX, Math.min(maxX, card.artPanX || 0));
  const panY = Math.max(-maxY, Math.min(maxY, card.artPanY || 0));
  return { x: a.x + (a.w - w) / 2 + panX, y: a.y + (a.h - h) / 2 + panY, w, h, panX, panY };
}

/** Draws the outer border and the dark frame with a thin type-colored inner line. */
function drawFrame(ctx: CanvasRenderingContext2D, color: string): void {
  roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 38);
  ctx.fillStyle = INK;
  ctx.fill();
  const grad = ctx.createLinearGradient(0, 22, 0, CARD_HEIGHT - 22);
  grad.addColorStop(0, "#353A42");
  grad.addColorStop(1, "#1F2228");
  roundRect(ctx, 22, 22, CARD_WIDTH - 44, CARD_HEIGHT - 44, 24);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  roundRect(ctx, 30, 30, CARD_WIDTH - 60, CARD_HEIGHT - 60, 18);
  ctx.stroke();
}

/** Draws the art window: the image if there is one, otherwise a quiet placeholder. */
function drawArt(ctx: CanvasRenderingContext2D, card: Card, img: HTMLImageElement | null, color: string): void {
  const a = ART_RECT;
  ctx.save();
  roundRect(ctx, a.x, a.y, a.w, a.h, 12);
  ctx.clip();
  if (img) {
    const p = artPlacement(img, card);
    ctx.drawImage(img, p.x, p.y, p.w, p.h);
  } else {
    ctx.fillStyle = shade(color, -0.45);
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 14;
    for (let x = a.x - a.h; x < a.x + a.w; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, a.y + a.h);
      ctx.lineTo(x + a.h, a.y);
      ctx.stroke();
    }
    // A simple mountain-and-sun mark so an empty window reads as "art goes here".
    const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 90, cy + 50);
    ctx.lineTo(cx - 30, cy - 30);
    ctx.lineTo(cx + 10, cy + 20);
    ctx.lineTo(cx + 40, cy - 10);
    ctx.lineTo(cx + 90, cy + 50);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 50, cy - 50, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  roundRect(ctx, a.x, a.y, a.w, a.h, 12);
  ctx.stroke();
}

/** Draws the difficulty disc in the top-left corner. */
function drawDifficulty(ctx: CanvasRenderingContext2D, value: string): void {
  ctx.beginPath();
  ctx.arc(96, 92, 56, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, 96, 92, 72, 90, INK);
}

/** Draws the block shield in the top-right corner, with zone tabs on its right edge. */
function drawShield(ctx: CanvasRenderingContext2D, modifier: string, zoneId: string): void {
  const x = 618, y = 36, w = 82, h = 108;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.quadraticCurveTo(x + w, y + h * 0.85, x + w / 2, y + h);
  ctx.quadraticCurveTo(x, y + h * 0.85, x, y + h * 0.55);
  ctx.closePath();
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (modifier) {
    const text = /^[+-]/.test(modifier) ? modifier : "+" + modifier;
    centerText(ctx, text, x + w / 2, y + 46, 46, w - 12, INK);
  }
  // Zone tabs: high, mid, low from top to bottom; the block zone is highlighted.
  ZONES.forEach((zone, i) => {
    const ty = y + 8 + i * 30;
    roundRect(ctx, x + w + 4, ty, 14, 24, 4);
    const active = zone.id === zoneId;
    ctx.fillStyle = active ? zone.color : "rgba(255,255,255,0.24)";
    ctx.fill();
    if (active) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
  });
}

/** Draws the name bar between the corner badges. */
function drawName(ctx: CanvasRenderingContext2D, card: Card, left: number, right: number): void {
  roundRect(ctx, left, 44, right - left, 70, 14);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  const name = card.name.trim() || "Untitled";
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "middle";
  fitFont(ctx, name, "700", 52, 22, right - left - 40);
  ctx.fillText(name, left + 20, 81);
}

/** Draws the attack zone dial on the right edge: three arrows, the attack's zone highlighted. */
function drawAttackZone(ctx: CanvasRenderingContext2D, zoneId: string): void {
  const cx = 682, cy = 500, r = 44;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = PAPER;
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ZONES.forEach((zone, i) => {
    const ay = cy - 22 + i * 22;
    const active = zone.id === zoneId;
    ctx.strokeStyle = active ? zone.color : "rgba(255,255,255,0.28)";
    ctx.lineWidth = active ? 8 : 5;
    ctx.beginPath();
    ctx.moveTo(cx - 20, ay);
    ctx.lineTo(cx + 14, ay);
    ctx.moveTo(cx + 4, ay - 8);
    ctx.lineTo(cx + 14, ay);
    ctx.lineTo(cx + 4, ay + 8);
    ctx.stroke();
  });
  ctx.lineCap = "butt";
}

/** Draws the type line: type name, keywords joined with dots, and a character's version. */
function drawTypeLine(ctx: CanvasRenderingContext2D, card: Card, typeName: string, color: string): void {
  const b = TYPE_LINE;
  roundRect(ctx, b.x, b.y, b.w, b.h, 10);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();

  ctx.textBaseline = "middle";
  const cy = b.y + b.h / 2 + 1;
  let right = b.x + b.w - 18;
  const version = stat(card, "version");
  if (version) {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `700 30px ${DISPLAY}`;
    ctx.textAlign = "right";
    ctx.fillText(version, right, cy);
    right -= ctx.measureText(version).width + 16;
    ctx.textAlign = "left";
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 34px ${DISPLAY}`;
  ctx.fillText(typeName, b.x + 18, cy);
  const keywords = card.keywords.split(",").map((k) => k.trim()).filter(Boolean).join("  •  ");
  if (keywords) {
    const kx = b.x + 18 + ctx.measureText(typeName).width + 20;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    fitFont(ctx, keywords, "italic 500", 30, 14, right - kx);
    ctx.fillText(keywords, kx, cy);
  }
}

/** Draws the effect text box, tinted with the type color, with wrapped rich text. */
function drawTextBox(ctx: CanvasRenderingContext2D, card: Card, color: string): void {
  const b = TEXT_BOX;
  roundRect(ctx, b.x, b.y, b.w, b.h, 14);
  ctx.fillStyle = shade(color, 0.84);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const inner: Box = { x: b.x + 24, y: b.y + 18, w: b.w - 48, h: b.h - 36 };
  const fitted = fitRichText(ctx, card.text, inner, BODY, 32, 18);
  drawRichText(ctx, fitted, inner, BODY, "#1C2026", (c, id, cx, cy, r) => drawSymbol(c, id, cx, cy, r));
}

/** Draws a labelled stat pill (used for speed). Returns its right edge. */
function drawSpeed(ctx: CanvasRenderingContext2D, x: number, value: string): number {
  const w = 108, h = 80, y = BAND_Y - h / 2;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#4C535D";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `600 20px ${DISPLAY}`;
  ctx.fillText("Speed", x + w / 2, y + 24);
  ctx.textAlign = "left";
  centerText(ctx, value, x + w / 2, y + 52, 42, w - 16, INK);
  return x + w;
}

/** Draws damage inside a burst. Returns its right edge. */
function drawDamage(ctx: CanvasRenderingContext2D, left: number, value: string): number {
  const r = 46, cx = left + r, cy = BAND_Y;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.78;
    ctx.lineTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = RED;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, cx, cy, 42, r * 1.3, "#FFFFFF");
  return cx + r;
}

/** Draws a number on a heart (health is red, stamina green). Returns its right edge. */
function drawHeart(ctx: CanvasRenderingContext2D, left: number, value: string, fill: string): number {
  const s = 104, cx = left + s / 2, cy = BAND_Y + 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.42);
  ctx.bezierCurveTo(cx - s * 0.62, cy, cx - s * 0.5, cy - s * 0.62, cx, cy - s * 0.3);
  ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.62, cx + s * 0.62, cy, cx, cy + s * 0.42);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, cx, cy - 6, 40, s * 0.55, "#FFFFFF");
  return left + s;
}

/** Draws hand size over a two-card icon. Returns its right edge. */
function drawHandSize(ctx: CanvasRenderingContext2D, left: number, value: string): number {
  const w = 66, h = 88, y = BAND_Y - h / 2;
  ctx.save();
  ctx.translate(left + 22 + w / 2, BAND_Y);
  ctx.rotate(0.18);
  roundRect(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fillStyle = "#C9CED6";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
  roundRect(ctx, left, y, w, h, 9);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, left + w / 2, BAND_Y, 42, w - 10, INK);
  return left + w + 30;
}

/** Draws the large check value in the bottom-right corner. */
function drawCheck(ctx: CanvasRenderingContext2D, value: string): void {
  const x = 606, y = 896, w = 100, h = 92;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, x + w / 2, y + h / 2, 76, w - 14, INK);
}

/** Draws the resource symbols centered between left and right. */
function drawSymbols(ctx: CanvasRenderingContext2D, symbols: CardSymbol[], left: number, right: number): void {
  if (!symbols.length) return;
  const r = 30, gap = 10;
  const total = symbols.length * r * 2 + (symbols.length - 1) * gap;
  const scale = Math.min(1, (right - left) / total);
  const rr = r * scale, gg = gap * scale;
  let x = left + (right - left - total * scale) / 2 + rr;
  for (const s of symbols) {
    drawSymbol(ctx, s.id, x, BAND_Y, rr, s.attuned);
    x += rr * 2 + gg;
  }
}

/** Draws the footer: set code, number and rarity on the left, artist on the right. */
function drawFooter(ctx: CanvasRenderingContext2D, card: Card, setCode: string, hasCheck: boolean): void {
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.textBaseline = "middle";
  ctx.font = `600 20px ${DISPLAY}`;
  ctx.fillText(`${setCode}  ${formatNumber(card.number)}  ${card.rarity}`.trim(), 52, 1004);
  if (card.artist.trim()) {
    const credit = "Art: " + card.artist.trim();
    const right = hasCheck ? 590 : 698;
    fitFont(ctx, credit, "500", 20, 14, 300);
    ctx.textAlign = "right";
    ctx.fillText(credit, right, 1004);
    ctx.textAlign = "left";
  }
}

/** Draws a full card at card-pixel size. Scale the context first to draw it smaller or larger. */
export function drawCard(ctx: CanvasRenderingContext2D, card: Card, options: DrawOptions = {}): void {
  const typeDef = getCardType(card.type);
  const color = typeDef.color;
  ctx.save();
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawFrame(ctx, color);
  drawArt(ctx, card, options.artImage ?? null, color);

  const difficulty = stat(card, "difficulty");
  const blockModifier = stat(card, "blockModifier");
  const blockZone = typeShowsStat(card, "blockZone") ? card.blockZone : "none";
  const hasShield = Boolean(blockModifier) || blockZone !== "none";
  drawName(ctx, card, difficulty ? 164 : 44, hasShield ? 600 : 706);
  if (difficulty) drawDifficulty(ctx, difficulty);
  if (hasShield) drawShield(ctx, blockModifier, blockZone);
  if (card.type === "attack") drawAttackZone(ctx, getZone(card.attackZone)?.id ?? "mid");

  drawTypeLine(ctx, card, typeDef.name, color);
  drawTextBox(ctx, card, color);

  // Bottom band: type-specific stats on the left, symbols in the middle, check value on the right.
  let left = 44;
  if (card.type === "attack") {
    left = drawSpeed(ctx, left, stat(card, "speed") || "-") + 14;
    left = drawDamage(ctx, left, stat(card, "damage") || "-") + 14;
  } else if (card.type === "character") {
    if (stat(card, "handSize")) left = drawHandSize(ctx, left, stat(card, "handSize")) + 10;
    if (stat(card, "health")) left = drawHeart(ctx, left, stat(card, "health"), RED) + 14;
  } else if (card.type === "backup") {
    if (stat(card, "stamina")) left = drawHeart(ctx, left, stat(card, "stamina"), GREEN) + 14;
  }
  const check = stat(card, "check");
  if (check) drawCheck(ctx, check);
  drawSymbols(ctx, card.symbols, left, check ? 592 : 706);
  drawFooter(ctx, card, options.setCode ?? "", Boolean(check));
  ctx.restore();
}
