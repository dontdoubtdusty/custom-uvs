// The ordered list of database migrations. The database version equals the list length.
// RULE: only ever add new migrations to the END of this list. Never edit or remove an old one,
// because browsers that already ran it will not run it again.

export interface Migration {
  /** What this migration changes, in plain words. */
  description: string;
  /** Runs inside the IndexedDB upgrade transaction. */
  upgrade: (db: IDBDatabase, tx: IDBTransaction) => void;
}

/**
 * Sets a field on every record in a store that does not have it yet.
 * Used by migrations; never change what it does, write a new helper instead.
 */
function backfill(tx: IDBTransaction, store: string, field: string, value: unknown): void {
  const request = tx.objectStore(store).openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    const record = cursor.value as Record<string, unknown>;
    if (record[field] === undefined) cursor.update({ ...record, [field]: value });
    cursor.continue();
  };
}

export const MIGRATIONS: readonly Migration[] = [
  // Version 1: initial stores for sets, cards (indexed by set) and art images.
  {
    description: "Create sets, cards and art stores",
    upgrade: (db) => {
      db.createObjectStore("sets", { keyPath: "id" });
      const cards = db.createObjectStore("cards", { keyPath: "id" });
      cards.createIndex("bySet", "setId", { unique: false });
      db.createObjectStore("art", { keyPath: "id" });
    }
  },
  // Version 2: cards get flavor text.
  {
    description: "Add empty flavor text to existing cards",
    upgrade: (_db, tx) => backfill(tx, "cards", "flavor", "")
  },
  // Version 3: sets get a size, printed as 21/185. 0 means not printed.
  {
    description: "Add set size 0 to existing sets",
    upgrade: (_db, tx) => backfill(tx, "sets", "size", 0)
  }
];
