// Reads and writes sets, cards and art. The only place that knows the store names.

import { normalizeCard, type Card } from "../model/card";
import { normalizeSet, type CardSet } from "../model/set";
import { newId } from "../model/ids";
import { openStorage, type StorageBackend, type StorageMode } from "./backends";

/** An uploaded image as stored. */
interface ArtRecord { id: string; blob: Blob; }

export class Repository {
  private backend: StorageBackend | null = null;

  /** Returns the connected backend, or throws if init() has not run. */
  private get db(): StorageBackend {
    if (!this.backend) throw new Error("Repository used before init()");
    return this.backend;
  }

  /** Connects to storage and reports which kind it got. */
  async init(): Promise<StorageMode> {
    this.backend = await openStorage();
    return this.backend.mode;
  }

  /** Returns all sets, oldest first. */
  async getSets(): Promise<CardSet[]> {
    const sets = await this.db.getAll<CardSet>("sets");
    return sets.map(normalizeSet).sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Saves a set (insert or update). */
  saveSet(set: CardSet): Promise<void> {
    return this.db.put("sets", set);
  }

  /** Deletes a set along with every card in it and their art. */
  async deleteSet(setId: string): Promise<void> {
    for (const card of await this.getCards(setId)) {
      await this.deleteCard(card);
    }
    await this.db.remove("sets", setId);
  }

  /** Returns the cards in a set, ordered by card number. */
  async getCards(setId: string): Promise<Card[]> {
    const cards = await this.db.getAllBySet<Card>("cards", setId);
    return cards.map(normalizeCard).sort((a, b) => a.number - b.number);
  }

  /** Saves a card (insert or update). */
  saveCard(card: Card): Promise<void> {
    return this.db.put("cards", card);
  }

  /** Deletes a card and its art image. */
  async deleteCard(card: Card): Promise<void> {
    if (card.artId) await this.db.remove("art", card.artId);
    await this.db.remove("cards", card.id);
  }

  /** Stores an image and returns its new art id. */
  async saveArt(blob: Blob): Promise<string> {
    const id = newId();
    await this.db.put<ArtRecord>("art", { id, blob });
    return id;
  }

  /** Returns the image for an art id, or null. */
  async getArt(artId: string): Promise<Blob | null> {
    const record = await this.db.get<ArtRecord>("art", artId);
    return record ? record.blob : null;
  }

  /** Deletes an art image. */
  deleteArt(artId: string): Promise<void> {
    return this.db.remove("art", artId);
  }
}
