// Unique id generation for sets, cards and art.

/** Returns a unique id; falls back to time plus random when crypto.randomUUID is missing. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
