// Draws a card onto a canvas from card data. Pure drawing: reads data, changes nothing.
// All coordinates are card pixels: 750 x 1050, which is 2.5 x 3.5 inches at 300 dpi.
// The frame is an original design that places information where UniVersus players expect it:
// difficulty top left, block shield top right, name tab over the bottom of the art,
// speed, damage and check stacked on the right edge of the text box, symbols bottom left,
// collector line bottom right. Characters are full art with hand size and health beside the name.

import { formatNumber, type Card, type CardSymbol } from "../model/card";
import { getCardType, getZone, typeShowsStat, ZONES } from "../model/cardTypes";
import { getSymbol } from "../model/symbols";
import { draw as drawRichText, fit as fitRichText, type Box } from "./richText";

export const CARD_WIDTH = 750;
export const CARD_HEIGHT = 1050;

const DISPLAY = '"Barlow Condensed", "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
const BODY = 'Barlow, "Segoe UI", Arial, sans-serif';
const INK = "#16181C";
const STRIP = "#2B2F36";
const PAPER = "#F6F4EF";
const RED = "#C8392E";
const GREEN = "#2F9157";

/** Width of the dark border around the card. */
const EDGE = 18;
/** Top of the footer band, where the text box (or character text panel) ends. */
const FOOTER_TOP = 962;
/** Center line of the right-hand stat column. */
const COLUMN_X = 662;
/** Text stops here when the right-hand column or check value is printed. */
const COLUMN_LEFT = 600;

/** Art window for form cards (everything except characters). */
const FORM_ART: Box = { x: EDGE, y: EDGE, w: CARD_WIDTH - EDGE * 2, h: 630 };
/** Art window for characters: the whole card above the footer. */
const CHARACTER_ART: Box = { x: EDGE, y: EDGE, w: CARD_WIDTH - EDGE * 2, h: FOOTER_TOP - EDGE };

/** Top of the name tab for each layout. */
const FORM_NAME_Y = 596;
const CHARACTER_NAME_Y = 532;
const NAME_H = 64;
const KEYWORD_H = 38;

export interface DrawOptions {
  artImage?: HTMLImageElement | null;
  setCode?: string;
}

/** Returns the art window for a card: full art for characters, the top of the card otherwise. */
export function artRectFor(card: Pick<Card, "type">): Box {
  return card.type === "character" ? CHARACTER_ART : FORM_ART;
}

/** Returns a stat's trimmed value when the card's type shows it, otherwise "". */
function stat(card: Card, key: keyof Card): string {
  if (!typeShowsStat(card, key)) return "";
  return String(card[key] ?? "").trim();
}

/** Traces a rounded rectangle path (does not fill or stroke). */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Mixes a hex color toward black (negative amount) or white (positive amount), with optional alpha. */
function shade(hex: string, amount: number, alpha = 1): string {
  const n = parseInt(hex.slice(1), 16);
  const target = amount < 0 ? 0 : 255;
  const mix = (c: number) => Math.round(c + (target - c) * Math.abs(amount));
  return `rgba(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)},${alpha})`;
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
  const a = artRectFor(card);
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

/** Draws the dark card body that shows as the border and footer band. */
function drawFrame(ctx: CanvasRenderingContext2D): void {
  roundRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 38);
  ctx.fillStyle = INK;
  ctx.fill();
}

/** Draws the art window: the image if there is one, otherwise a quiet placeholder. */
function drawArt(ctx: CanvasRenderingContext2D, card: Card, img: HTMLImageElement | null, color: string): void {
  const a = artRectFor(card);
  ctx.save();
  roundRect(ctx, a.x, a.y, a.w, a.h, [24, 24, 0, 0]);
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
    const cx = a.x + a.w / 2, cy = a.y + Math.min(a.h, 630) / 2;
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
}

/** Draws the difficulty disc in the top-left corner. */
function drawDifficulty(ctx: CanvasRenderingContext2D, value: string): void {
  ctx.beginPath();
  ctx.arc(92, 92, 56, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, 92, 92, 72, 90, INK);
}

/** Draws the block shield in the top-right corner, with zone tabs on its right edge. */
function drawShield(ctx: CanvasRenderingContext2D, modifier: string, zoneId: string): void {
  const x = 618, y = 34, w = 82, h = 108;
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
    ctx.fillStyle = active ? zone.color : "rgba(22,24,28,0.55)";
    ctx.fill();
    ctx.lineWidth = active ? 3 : 2;
    ctx.strokeStyle = active ? INK : "rgba(255,255,255,0.5)";
    ctx.stroke();
  });
}

/** Traces a bar that starts at the card's left edge and ends in a slanted cut. */
function slantedBar(ctx: CanvasRenderingContext2D, y: number, w: number, h: number): void {
  const slant = h * 0.4;
  ctx.beginPath();
  ctx.moveTo(EDGE, y);
  ctx.lineTo(EDGE + w + slant, y);
  ctx.lineTo(EDGE + w, y + h);
  ctx.lineTo(EDGE, y + h);
  ctx.closePath();
}

/** Joins keywords with dots and adds the character version, as printed in the keyword strip. */
function keywordStripText(card: Card): string {
  const keywords = card.keywords.split(",").map((k) => k.trim()).filter(Boolean).join("  •  ");
  const version = stat(card, "version");
  return [keywords.toUpperCase(), version ? "Version " + version : ""].filter(Boolean).join("     ");
}

/** Returns where the name block ends: below the keyword strip if there is one. */
function nameBlockBottom(card: Card, top: number): number {
  return top + NAME_H + (keywordStripText(card) ? KEYWORD_H : 0);
}

/**
 * Draws the name tab over the bottom of the art and, if there are keywords or a version,
 * the keyword strip below it. Returns the bottom of the lowest bar drawn.
 */
function drawNameBlock(ctx: CanvasRenderingContext2D, card: Card, top: number, maxWidth: number, color: string): number {
  const name = card.name.trim() || "Untitled";
  ctx.textBaseline = "middle";
  fitFont(ctx, name, "700", 48, 22, maxWidth - 60);
  const nameWidth = Math.min(maxWidth, ctx.measureText(name).width + 60);
  slantedBar(ctx, top, nameWidth, NAME_H);
  ctx.fillStyle = INK;
  ctx.fill();
  // A type-colored stripe on the tab's leading edge ties the name to the card type.
  ctx.fillStyle = color;
  ctx.fillRect(EDGE, top, 12, NAME_H);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(name, EDGE + 30, top + NAME_H / 2 + 2);

  const strip = keywordStripText(card);
  if (!strip) return top + NAME_H;

  const y = top + NAME_H;
  fitFont(ctx, strip, "italic 600", 26, 14, maxWidth - 70);
  const stripWidth = Math.min(maxWidth - 20, ctx.measureText(strip).width + 56);
  slantedBar(ctx, y, stripWidth, KEYWORD_H);
  ctx.fillStyle = STRIP;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fillText(strip, EDGE + 30, y + KEYWORD_H / 2 + 1);
  return y + KEYWORD_H;
}

/** Draws the type-tinted text box below the art (form cards). */
function drawTextBox(ctx: CanvasRenderingContext2D, color: string): void {
  const top = FORM_ART.y + FORM_ART.h;
  ctx.fillStyle = shade(color, 0.8);
  ctx.fillRect(EDGE, top, CARD_WIDTH - EDGE * 2, FOOTER_TOP - top);
  ctx.fillStyle = color;
  ctx.fillRect(EDGE, top, CARD_WIDTH - EDGE * 2, 6);
}

/** Draws the see-through text panel over a character's art. */
function drawCharacterPanel(ctx: CanvasRenderingContext2D, top: number, color: string): void {
  const grad = ctx.createLinearGradient(0, top - 40, 0, top + 30);
  grad.addColorStop(0, shade(color, 0.88, 0));
  grad.addColorStop(1, shade(color, 0.88, 0.9));
  ctx.fillStyle = grad;
  ctx.fillRect(EDGE, top - 40, CARD_WIDTH - EDGE * 2, FOOTER_TOP - top + 40);
}

/** Lays out and draws the effect text inside the given box. */
function drawEffectText(ctx: CanvasRenderingContext2D, card: Card, inner: Box): void {
  const fitted = fitRichText(ctx, card.text, inner, BODY, 32, 18);
  drawRichText(ctx, fitted, inner, BODY, "#1C2026", (c, id, cx, cy, r) => drawSymbol(c, id, cx, cy, r));
}

/** Draws speed in a circle with an arrow whose angle and color show the attack zone. */
function drawSpeed(ctx: CanvasRenderingContext2D, cx: number, cy: number, value: string, zoneId: string): void {
  const r = 42;
  const zoneIndex = Math.max(0, ZONES.findIndex((z) => z.id === zoneId));
  const zone = ZONES[zoneIndex];
  // High points up and right, mid straight right, low down and right.
  const angle = (zoneIndex - 1) * (Math.PI / 5);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(r - 6, -20);
  ctx.lineTo(r + 22, 0);
  ctx.lineTo(r - 6, 20);
  ctx.closePath();
  ctx.fillStyle = zone.color;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, cx, cy, 46, r * 1.5, INK);
}

/** Draws damage inside a burst centered on (cx, cy). */
function drawDamage(ctx: CanvasRenderingContext2D, cx: number, cy: number, value: string): void {
  const r = 48;
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
  centerText(ctx, value, cx, cy, 44, r * 1.3, "#FFFFFF");
}

/** Draws a number on a heart centered on (cx, cy): health is red, stamina green. */
function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, value: string, fill: string): void {
  const s = 104;
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
}

/** Draws hand size over a two-card icon centered on (cx, cy). */
function drawHandSize(ctx: CanvasRenderingContext2D, cx: number, cy: number, value: string): void {
  const w = 66, h = 88;
  ctx.save();
  ctx.translate(cx + 14, cy);
  ctx.rotate(0.18);
  roundRect(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fillStyle = "#C9CED6";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
  roundRect(ctx, cx - 8 - w / 2, cy - h / 2, w, h, 9);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, cx - 8, cy, 42, w - 10, INK);
}

/** Draws the large check value at the bottom of the right-hand column. */
function drawCheck(ctx: CanvasRenderingContext2D, value: string): void {
  const w = 104, h = 96, x = COLUMN_X - w / 2, y = FOOTER_TOP - h + 8;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  centerText(ctx, value, x + w / 2, y + h / 2, 78, w - 14, INK);
}

/** Draws the resource symbols in a row from the bottom-left corner, shrinking to fit maxWidth. */
function drawSymbols(ctx: CanvasRenderingContext2D, symbols: CardSymbol[], maxWidth: number): void {
  if (!symbols.length) return;
  const r = 24, gap = 10;
  const total = symbols.length * r * 2 + (symbols.length - 1) * gap;
  const scale = Math.min(1, maxWidth / total);
  const rr = r * scale, gg = gap * scale;
  let x = 40 + rr;
  const cy = (FOOTER_TOP + CARD_HEIGHT - EDGE) / 2;
  for (const s of symbols) {
    drawSymbol(ctx, s.id, x, cy, rr, s.attuned);
    x += rr * 2 + gg;
  }
}

/** Draws the collector line (type, rarity, set code, number) and the artist credit, bottom right. */
function drawFooter(ctx: CanvasRenderingContext2D, card: Card, typeName: string, setCode: string): void {
  const right = CARD_WIDTH - 40;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const collector = [typeName, card.rarity, setCode, formatNumber(card.number)].filter(Boolean).join("  ");
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  fitFont(ctx, collector, "600", 22, 14, 380);
  ctx.fillText(collector, right, 984);
  if (card.artist.trim()) {
    const credit = "Art: " + card.artist.trim();
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    fitFont(ctx, credit, "500", 18, 12, 380);
    ctx.fillText(credit, right, 1011);
  }
  ctx.textAlign = "left";
}

/** Draws a full card at card-pixel size. Scale the context first to draw it smaller or larger. */
export function drawCard(ctx: CanvasRenderingContext2D, card: Card, options: DrawOptions = {}): void {
  const typeDef = getCardType(card.type);
  const color = typeDef.color;
  const isCharacter = card.type === "character";
  ctx.save();
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  drawFrame(ctx);
  drawArt(ctx, card, options.artImage ?? null, color);

  const check = stat(card, "check");
  const speed = stat(card, "speed");
  const damage = stat(card, "damage");
  const stamina = stat(card, "stamina");
  const handSize = stat(card, "handSize");
  const health = stat(card, "health");

  // The text box, then the name block over its top edge, then the text below the name block.
  let textTop: number;
  if (isCharacter) {
    const statsBottom = health ? 700 : handSize ? 604 : 0;
    textTop = Math.max(nameBlockBottom(card, CHARACTER_NAME_Y), statsBottom) + 12;
    drawCharacterPanel(ctx, textTop, color);
    drawNameBlock(ctx, card, CHARACTER_NAME_Y, COLUMN_LEFT - EDGE - 10, color);
  } else {
    drawTextBox(ctx, color);
    textTop = drawNameBlock(ctx, card, FORM_NAME_Y, 560, color);
  }
  const hasColumn = Boolean(check) || card.type === "attack" || Boolean(stamina);
  const textRight = hasColumn ? COLUMN_LEFT : CARD_WIDTH - 40;
  drawEffectText(ctx, card, { x: 40, y: textTop + 14, w: textRight - 40, h: FOOTER_TOP - textTop - 30 });

  // Right-hand column: attack speed and damage, backup stamina, character hand size and health.
  if (card.type === "attack") {
    drawSpeed(ctx, COLUMN_X - 10, 714, speed || "-", getZone(card.attackZone)?.id ?? "mid");
    drawDamage(ctx, COLUMN_X, 810, damage || "-");
  } else if (stamina) {
    drawHeart(ctx, COLUMN_X, 790, stamina, GREEN);
  } else if (isCharacter) {
    if (handSize) drawHandSize(ctx, COLUMN_X, 560, handSize);
    if (health) drawHeart(ctx, COLUMN_X, handSize ? 656 : 572, health, RED);
  }
  if (check) drawCheck(ctx, check);

  // Corner stats go last so they sit on top of the art.
  const difficulty = stat(card, "difficulty");
  const blockModifier = stat(card, "blockModifier");
  const blockZone = typeShowsStat(card, "blockZone") ? card.blockZone : "none";
  if (difficulty) drawDifficulty(ctx, difficulty);
  if (Boolean(blockModifier) || blockZone !== "none") drawShield(ctx, blockModifier, blockZone);

  drawSymbols(ctx, card.symbols, 280);
  drawFooter(ctx, card, typeDef.name, options.setCode ?? "");
  ctx.restore();
}
