// Storage backends. IndexedDB when the browser allows it, otherwise an in-memory stand-in with
// the same methods, so the rest of the app never needs to know which one it got.

import { MIGRATIONS } from "./migrations";

export type StoreName = "sets" | "cards" | "art";
export type StorageMode = "indexeddb" | "memory";

/** Anything stored has a string id. */
export interface Keyed { id: string; }

/** The operations the repository needs; both backends implement it. */
export interface StorageBackend {
  readonly mode: StorageMode;
  get<T extends Keyed>(store: StoreName, key: string): Promise<T | undefined>;
  getAll<T extends Keyed>(store: StoreName): Promise<T[]>;
  getAllBySet<T extends Keyed>(store: StoreName, setId: string): Promise<T[]>;
  put<T extends Keyed>(store: StoreName, value: T): Promise<void>;
  remove(store: StoreName, key: string): Promise<void>;
}

const DB_NAME = "uvs-card-creator";

/** Storage backed by IndexedDB. Each call runs in its own short transaction. */
class IndexedDbBackend implements StorageBackend {
  readonly mode = "indexeddb" as const;

  constructor(private readonly db: IDBDatabase) {}

  /** Runs one request against a store and resolves when its transaction completes. */
  private run<R>(store: StoreName, mode: IDBTransactionMode, makeRequest: (s: IDBObjectStore) => IDBRequest): Promise<R> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, mode);
      const request = makeRequest(tx.objectStore(store));
      let result: R;
      request.onsuccess = () => { result = request.result as R; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  get<T extends Keyed>(store: StoreName, key: string) {
    return this.run<T | undefined>(store, "readonly", (s) => s.get(key));
  }

  getAll<T extends Keyed>(store: StoreName) {
    return this.run<T[]>(store, "readonly", (s) => s.getAll());
  }

  getAllBySet<T extends Keyed>(store: StoreName, setId: string) {
    return this.run<T[]>(store, "readonly", (s) => s.index("bySet").getAll(setId));
  }

  async put<T extends Keyed>(store: StoreName, value: T) {
    await this.run<IDBValidKey>(store, "readwrite", (s) => s.put(value));
  }

  async remove(store: StoreName, key: string) {
    await this.run<undefined>(store, "readwrite", (s) => s.delete(key));
  }
}

/** Storage kept in memory only; used when IndexedDB is blocked or broken. */
class MemoryBackend implements StorageBackend {
  readonly mode = "memory" as const;
  private readonly stores = new Map<StoreName, Map<string, Keyed>>();

  /** Returns the Map for a store, creating it on first use. */
  private storeFor(name: StoreName): Map<string, Keyed> {
    let store = this.stores.get(name);
    if (!store) {
      store = new Map();
      this.stores.set(name, store);
    }
    return store;
  }

  async get<T extends Keyed>(store: StoreName, key: string) {
    return this.storeFor(store).get(key) as T | undefined;
  }

  async getAll<T extends Keyed>(store: StoreName) {
    return Array.from(this.storeFor(store).values()) as T[];
  }

  async getAllBySet<T extends Keyed>(store: StoreName, setId: string) {
    return (Array.from(this.storeFor(store).values()) as (T & { setId?: string })[])
      .filter((v) => v.setId === setId);
  }

  async put<T extends Keyed>(store: StoreName, value: T) {
    this.storeFor(store).set(value.id, value);
  }

  async remove(store: StoreName, key: string) {
    this.storeFor(store).delete(key);
  }
}

/** Opens IndexedDB and runs any migrations this browser has not run yet. */
function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, MIGRATIONS.length);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = request.transaction as IDBTransaction;
      for (let i = event.oldVersion; i < MIGRATIONS.length; i++) {
        MIGRATIONS[i].upgrade(db, tx);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Database upgrade blocked by another open tab"));
  });
}

/** Returns a storage backend, preferring IndexedDB and falling back to memory. */
export async function openStorage(): Promise<StorageBackend> {
  try {
    if (typeof indexedDB === "undefined") throw new Error("IndexedDB is not available");
    return new IndexedDbBackend(await openIndexedDb());
  } catch (err) {
    console.warn("Storage unavailable, running in memory:", err);
    return new MemoryBackend();
  }
}
