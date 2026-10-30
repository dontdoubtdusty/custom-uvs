// The live card preview on the cutting mat. Redraws when state changes and lets you drag the art.

import { createCard, type Card } from "../model/card";
import { artPlacement, artRectFor, CARD_HEIGHT, CARD_WIDTH, drawCard } from "../render/cardRenderer";
import type { AppState, StateSnapshot } from "../state/appState";

/** A sample card shown before any set exists, so the first screen is not empty. */
function sampleCard(): Card {
  return {
    ...createCard("sample", 1),
    name: "Ember Step",
    keywords: "Kick, Combo",
    text: "[[Enhance]]: Your attack gets +1 speed.\n[[Response]] {fire}: After this attack is blocked, draw 1 card.",
    symbols: [{ id: "fire", attuned: false }, { id: "chaos", attuned: false }],
    rarity: "R"
  };
}

const PAN_STEP = 12;

export class Preview {
  private readonly ctx: CanvasRenderingContext2D;
  private frameRequested = false;
  /** Drag state while the art is being moved. */
  private drag: { pointerId: number; startX: number; startY: number; panX: number; panY: number } | null = null;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly hint: HTMLElement, private readonly app: AppState) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported");
    this.ctx = ctx;
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
    canvas.addEventListener("pointerup", (e) => this.endDrag(e));
    canvas.addEventListener("pointercancel", (e) => this.endDrag(e));
    canvas.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  /** Schedules a redraw on the next animation frame; many changes in one frame draw once. */
  render(_state?: StateSnapshot): void {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      this.draw();
    });
  }

  /** Draws the selected card, or the sample card when nothing is selected. */
  private draw(): void {
    const card = this.app.currentCard();
    const shown = card ?? sampleCard();
    const art = card ? this.app.getArtImage(card.artId) : null;
    drawCard(this.ctx, shown, { artImage: art, setCode: this.app.currentSet()?.code ?? "MYS" });
    const canPan = Boolean(art);
    this.hint.hidden = !canPan;
    this.canvas.classList.toggle("can-pan", canPan);
    this.canvas.tabIndex = canPan ? 0 : -1;
    this.canvas.setAttribute("aria-label", `Preview of ${shown.name.trim() || "Untitled"}` + (canPan ? ". Use arrow keys to move the art." : ""));
  }

  /** Converts a pointer position to card pixels. */
  private toCardPoint(e: PointerEvent): { x: number; y: number; scale: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scale = CARD_WIDTH / rect.width;
    return { x: (e.clientX - rect.left) * scale, y: (e.clientY - rect.top) * scale, scale };
  }

  /** Starts dragging when the pointer goes down on the art window of a card with art. */
  private onPointerDown(e: PointerEvent): void {
    const card = this.app.currentCard();
    if (!card || !this.app.getArtImage(card.artId)) return;
    const p = this.toCardPoint(e);
    const a = artRectFor(card);
    if (p.x < a.x || p.x > a.x + a.w || p.y < a.y || p.y > a.y + a.h) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.classList.add("is-dragging");
    this.drag = { pointerId: e.pointerId, startX: p.x, startY: p.y, panX: card.artPanX, panY: card.artPanY };
  }

  /** Moves the art with the pointer, keeping it inside the art window. */
  private onPointerMove(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    const p = this.toCardPoint(e);
    this.panTo(this.drag.panX + (p.x - this.drag.startX), this.drag.panY + (p.y - this.drag.startY));
  }

  /** Ends a drag. */
  private endDrag(e: PointerEvent): void {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    this.drag = null;
    this.canvas.classList.remove("is-dragging");
  }

  /** Arrow keys nudge the art when the preview has focus. */
  private onKeyDown(e: KeyboardEvent): void {
    const card = this.app.currentCard();
    if (!card || !this.app.getArtImage(card.artId)) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-PAN_STEP, 0], ArrowRight: [PAN_STEP, 0], ArrowUp: [0, -PAN_STEP], ArrowDown: [0, PAN_STEP]
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    this.panTo(card.artPanX + move[0], card.artPanY + move[1]);
  }

  /** Saves a new pan, clamped so the art still covers the window. */
  private panTo(panX: number, panY: number): void {
    const card = this.app.currentCard();
    const img = card ? this.app.getArtImage(card.artId) : null;
    if (!card || !img) return;
    const placed = artPlacement(img, { ...card, artPanX: panX, artPanY: panY });
    this.app.updateCard({ artPanX: Math.round(placed.panX), artPanY: Math.round(placed.panY) });
  }
}
