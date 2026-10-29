// Small DOM helpers shared by the UI classes.

/** Escapes text for safe use inside HTML templates. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns the first element matching a selector inside root, or throws if it is missing. */
export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error("Missing element: " + selector);
  return el;
}

/** Sets a field's value only when the user is not typing in it, so the caret never jumps. */
export function setValueIfIdle(input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  if (document.activeElement === input) return;
  if (input.value !== value) input.value = value;
}

/** Finds the nearest element with a data-action attribute from an event target. */
export function actionTarget(event: Event): HTMLElement | null {
  const target = event.target as Element | null;
  return target ? target.closest<HTMLElement>("[data-action]") : null;
}
