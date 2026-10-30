// App state and every action that changes it. UI classes read state and call these actions;
// they never touch storage directly. Listeners are told after each change.

import { cloneCard, createCard, type Card } from "../model/card";
import { cleanCode, cleanSize, createSet, type CardSet } from "../model/set";
import type { SymbolId } from "../model/symbols";
import { newId } from "../model/ids";
import type { StorageMode } from "../storage/backends";
import { Repository } from "../storage/repository";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** The data the UI renders from. Read it; change it only through AppState methods. */
export interface StateSnapshot {
  ready: boolean;
  storageMode: StorageMode;
  sets: CardSet[];
  currentSetId: string | null;
  cards: Card[];
  currentCardId: string | null;
  saveStatus: SaveStatus;
  errorMessage: string;
}

type Listener = (state: StateSnapshot) => void;

const SAVE_DELAY_MS = 400;
const LAST_SELECTION_KEY = "uvs.lastSelection";

export class AppState {
  readonly state: StateSnapshot = {
    ready: false,
    storageMode: "indexeddb",
    sets: [],
    currentSetId: null,
    cards: [],
    currentCardId: null,
    saveStatus: "idle",
    errorMessage: ""
  };

  private readonly repo = new Repository();
  private readonly listeners: Listener[] = [];
  /** Cards waiting to be written, keyed by card id. */
  private readonly pendingSaves = new Map<string, { card: Card; timer: number }>();
  /** Decoded art images keyed by art id, so the renderer can draw them without waiting. */
  private readonly artImages = new Map<string, HTMLImageElement>();

  /** Registers a function to call whenever state changes. */
  subscribe(listener: Listener): void {
    this.listeners.push(listener);
  }

  /** Tells every listener that state changed. */
  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }

  /** Records a failed action so the header can show it. */
  private fail(message: string, err: unknown): void {
    console.error(message, err);
    this.state.saveStatus = "error";
    this.state.errorMessage = message;
    this.emit();
  }

  /** Marks everything as saved and tells listeners. */
  private markSaved(): void {
    this.state.saveStatus = "saved";
    this.state.errorMessage = "";
    this.emit();
  }

  /** Returns the selected set, or null. */
  currentSet(): CardSet | null {
    return this.state.sets.find((s) => s.id === this.state.currentSetId) ?? null;
  }

  /** Returns the selected card, or null. */
  currentCard(): Card | null {
    return this.state.cards.find((c) => c.id === this.state.currentCardId) ?? null;
  }

  /** Remembers the selected set and card between visits (best effort). */
  private rememberSelection(): void {
    try {
      localStorage.setItem(LAST_SELECTION_KEY, JSON.stringify({ setId: this.state.currentSetId, cardId: this.state.currentCardId }));
    } catch { /* storage blocked; the selection just won't be remembered */ }
  }

  /** Reads the remembered selection, or an empty object. */
  private readSelection(): { setId?: string; cardId?: string } {
    try {
      return JSON.parse(localStorage.getItem(LAST_SELECTION_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  /** Connects storage, loads sets and restores the last selection. */
  async init(): Promise<void> {
    try {
      this.state.storageMode = await this.repo.init();
      this.state.sets = await this.repo.getSets();
      const last = this.readSelection();
      const startSet = this.state.sets.find((s) => s.id === last.setId) ?? this.state.sets[0];
      if (startSet) await this.loadSet(startSet.id, last.cardId);
    } catch (err) {
      this.fail("Could not load your sets.", err);
    }
    this.state.ready = true;
    this.emit();
  }

  /** Loads a set's cards and selects a card (the preferred one if it exists). */
  private async loadSet(setId: string, preferredCardId?: string): Promise<void> {
    this.state.currentSetId = setId;
    this.state.cards = await this.repo.getCards(setId);
    const preferred = this.state.cards.find((c) => c.id === preferredCardId);
    this.state.currentCardId = preferred?.id ?? this.state.cards[0]?.id ?? null;
    await Promise.all(this.state.cards.map((c) => this.ensureArtLoaded(c.artId)));
    this.rememberSelection();
  }

  /** Creates a set, selects it and starts it with one card. */
  async createSet(name: string, code: string): Promise<void> {
    try {
      await this.flushSaves();
      const set = createSet(name, code);
      await this.repo.saveSet(set);
      this.state.sets.push(set);
      this.state.currentSetId = set.id;
      this.state.cards = [];
      this.state.currentCardId = null;
      await this.createCard();
    } catch (err) { this.fail("Could not create the set.", err); }
  }

  /** Changes the selected set's name, code or size; a blank name or code keeps the old one. */
  async updateSet(patch: { name?: string; code?: string; size?: string }): Promise<void> {
    const set = this.currentSet();
    if (!set) return;
    if (patch.name !== undefined) set.name = patch.name.trim() || set.name;
    if (patch.code !== undefined) set.code = cleanCode(patch.code) || set.code;
    if (patch.size !== undefined) set.size = cleanSize(patch.size);
    set.updatedAt = Date.now();
    this.emit();
    try {
      await this.repo.saveSet(set);
      this.markSaved();
    } catch (err) { this.fail("Could not save the set.", err); }
  }

  /** Deletes the selected set and all its cards, then selects another set. */
  async deleteSet(): Promise<void> {
    const set = this.currentSet();
    if (!set) return;
    try {
      this.pendingSaves.forEach((p) => clearTimeout(p.timer));
      this.pendingSaves.clear();
      await this.repo.deleteSet(set.id);
      this.state.sets = this.state.sets.filter((s) => s.id !== set.id);
      this.state.cards = [];
      this.state.currentCardId = null;
      this.state.currentSetId = null;
      if (this.state.sets[0]) await this.loadSet(this.state.sets[0].id);
      this.rememberSelection();
      this.markSaved();
    } catch (err) { this.fail("Could not delete the set.", err); }
  }

  /** Switches to another set. */
  async selectSet(setId: string): Promise<void> {
    try {
      await this.flushSaves();
      await this.loadSet(setId);
      this.emit();
    } catch (err) { this.fail("Could not open the set.", err); }
  }

  /** Returns the next free card number in the current set. */
  private nextNumber(): number {
    return this.state.cards.reduce((max, c) => Math.max(max, c.number), 0) + 1;
  }

  /** Adds a new card to the current set and selects it. */
  async createCard(): Promise<void> {
    if (!this.state.currentSetId) return;
    try {
      await this.flushSaves();
      const card = createCard(this.state.currentSetId, this.nextNumber());
      await this.repo.saveCard(card);
      this.state.cards.push(card);
      this.state.currentCardId = card.id;
      this.rememberSelection();
      this.markSaved();
    } catch (err) { this.fail("Could not create the card.", err); }
  }

  /** Copies the selected card, including its own copy of the art, and selects the copy. */
  async duplicateCard(): Promise<void> {
    const source = this.currentCard();
    if (!source) return;
    try {
      await this.flushSaves();
      const now = Date.now();
      const copy: Card = {
        ...cloneCard(source),
        id: newId(),
        number: this.nextNumber(),
        name: source.name + " copy",
        createdAt: now,
        updatedAt: now
      };
      if (source.artId) {
        const blob = await this.repo.getArt(source.artId);
        copy.artId = blob ? await this.repo.saveArt(blob) : null;
        await this.ensureArtLoaded(copy.artId);
      }
      await this.repo.saveCard(copy);
      this.state.cards.push(copy);
      this.state.currentCardId = copy.id;
      this.rememberSelection();
      this.markSaved();
    } catch (err) { this.fail("Could not duplicate the card.", err); }
  }

  /** Selects a card in the current set. */
  async selectCard(cardId: string): Promise<void> {
    await this.flushSaves();
    this.state.currentCardId = cardId;
    this.rememberSelection();
    this.emit();
  }

  /** Applies changes to the selected card right away and saves them shortly after. */
  updateCard(patch: Partial<Card>): void {
    const card = this.currentCard();
    if (!card) return;
    Object.assign(card, patch, { updatedAt: Date.now() });
    if (patch.number !== undefined) this.state.cards.sort((a, b) => a.number - b.number);
    this.scheduleSave(card);
    this.emit();
  }

  /** Cycles a resource symbol on the selected card: off, then on, then attuned, then off. */
  cycleSymbol(symbolId: SymbolId): void {
    const card = this.currentCard();
    if (!card) return;
    const existing = card.symbols.find((s) => s.id === symbolId);
    let symbols;
    if (!existing) symbols = [...card.symbols, { id: symbolId, attuned: false }];
    else if (!existing.attuned) symbols = card.symbols.map((s) => (s.id === symbolId ? { ...s, attuned: true } : s));
    else symbols = card.symbols.filter((s) => s.id !== symbolId);
    this.updateCard({ symbols });
  }

  /** Deletes the selected card and selects its neighbour. */
  async deleteCard(): Promise<void> {
    const card = this.currentCard();
    if (!card) return;
    try {
      const pending = this.pendingSaves.get(card.id);
      if (pending) clearTimeout(pending.timer);
      this.pendingSaves.delete(card.id);
      const index = this.state.cards.indexOf(card);
      await this.repo.deleteCard(card);
      if (card.artId) this.forgetArt(card.artId);
      this.state.cards.splice(index, 1);
      const next = this.state.cards[index] ?? this.state.cards[index - 1] ?? null;
      this.state.currentCardId = next ? next.id : null;
      this.rememberSelection();
      this.markSaved();
    } catch (err) { this.fail("Could not delete the card.", err); }
  }

  /** Stores an uploaded image as the selected card's art, replacing any old art. */
  async setArt(file: File): Promise<void> {
    const card = this.currentCard();
    if (!card) return;
    if (!file.type.startsWith("image/")) {
      this.fail("That file is not an image. Choose a PNG, JPG, WEBP or GIF.", file.type);
      return;
    }
    try {
      const oldArtId = card.artId;
      const artId = await this.repo.saveArt(file);
      await this.ensureArtLoaded(artId);
      if (!this.artImages.has(artId)) {
        await this.repo.deleteArt(artId);
        this.fail("That image could not be read. Try saving it as PNG or JPG.", file.name);
        return;
      }
      this.updateCard({ artId, artPanX: 0, artPanY: 0, artZoom: 1 });
      if (oldArtId) {
        await this.repo.deleteArt(oldArtId);
        this.forgetArt(oldArtId);
      }
    } catch (err) { this.fail("Could not save the art.", err); }
  }

  /** Removes the selected card's art. */
  async removeArt(): Promise<void> {
    const card = this.currentCard();
    if (!card || !card.artId) return;
    const artId = card.artId;
    try {
      this.updateCard({ artId: null, artPanX: 0, artPanY: 0, artZoom: 1 });
      await this.repo.deleteArt(artId);
      this.forgetArt(artId);
    } catch (err) { this.fail("Could not remove the art.", err); }
  }

  /** Returns the decoded image for an art id, or null if not loaded. */
  getArtImage(artId: string | null): HTMLImageElement | null {
    return (artId && this.artImages.get(artId)) || null;
  }

  /** Loads and decodes an art image into the cache if it is not there yet. */
  private async ensureArtLoaded(artId: string | null): Promise<void> {
    if (!artId || this.artImages.has(artId)) return;
    const blob = await this.repo.getArt(artId);
    if (!blob) return;
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    try {
      await img.decode();
      this.artImages.set(artId, img);
    } catch (err) {
      URL.revokeObjectURL(img.src);
      console.warn("Could not decode art", artId, err);
    }
  }

  /** Drops a cached image and frees its object URL. */
  private forgetArt(artId: string): void {
    const img = this.artImages.get(artId);
    if (img) URL.revokeObjectURL(img.src);
    this.artImages.delete(artId);
  }

  /** Queues a card to be saved after a short pause in typing. */
  private scheduleSave(card: Card): void {
    const existing = this.pendingSaves.get(card.id);
    if (existing) clearTimeout(existing.timer);
    const timer = window.setTimeout(() => { void this.saveNow(card.id); }, SAVE_DELAY_MS);
    this.pendingSaves.set(card.id, { card, timer });
    this.state.saveStatus = "saving";
  }

  /** Writes one queued card to storage. */
  private async saveNow(cardId: string): Promise<void> {
    const pending = this.pendingSaves.get(cardId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pendingSaves.delete(cardId);
    try {
      await this.repo.saveCard(pending.card);
      if (this.pendingSaves.size === 0) this.markSaved();
    } catch (err) { this.fail("Could not save the card.", err); }
  }

  /** Writes every queued card immediately. */
  async flushSaves(): Promise<void> {
    for (const id of Array.from(this.pendingSaves.keys())) {
      await this.saveNow(id);
    }
  }
}
