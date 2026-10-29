// The ordered list of database migrations. The database version equals the list length.
// RULE: only ever add new migrations to the END of this list. Never edit or remove an old one,
// because browsers that already ran it will not run it again.

export interface Migration {
  /** What this migration changes, in plain words. */
  description: string;
  /** Runs inside the IndexedDB upgrade transaction. */
  upgrade: (db: IDBDatabase, tx: IDBTransaction) => void;
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
  }
];
