// Entry point: creates the app state and the UI pieces, connects them, and starts loading.

// Fonts are bundled with the app so cards look the same offline and nothing loads from third parties.
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/400-italic.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow/700.css";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/500-italic.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./styles.css";
import { AppState, type StateSnapshot } from "./state/appState";
import { Editor } from "./ui/editor";
import { Preview } from "./ui/preview";
import { Sidebar } from "./ui/sidebar";
import { qs } from "./ui/dom";

/** Header text for each save status. */
function saveStatusText(state: StateSnapshot): string {
  if (state.saveStatus === "error") return state.errorMessage;
  if (state.storageMode === "memory") return "Not saved: storage is blocked";
  if (state.saveStatus === "saving") return "Saving changes";
  if (state.saveStatus === "saved") return "All changes saved";
  return "";
}

/** Waits for the card fonts so the preview is drawn with them, then redraws once. */
function redrawWhenFontsLoad(preview: Preview): void {
  if (!("fonts" in document)) return;
  const faces = ['700 40px "Barlow Condensed"', 'italic 500 30px "Barlow Condensed"', '600 20px "Barlow Condensed"', '400 30px "Barlow"', '700 30px "Barlow"'];
  Promise.all(faces.map((f) => document.fonts.load(f)))
    .then(() => preview.render())
    .catch(() => { /* offline: the system font fallback is already in use */ });
}

/** Builds the app and starts it. */
function start(): void {
  const app = new AppState();
  const sidebar = new Sidebar(qs("#sidebar"), app);
  const editor = new Editor(qs("#editor"), app);
  const preview = new Preview(qs<HTMLCanvasElement>("#card-canvas"), qs("#mat-hint"), app);
  const status = qs("#save-status");
  const banner = qs("#storage-banner");
  const workspace = qs("#workspace");

  app.subscribe((state) => {
    sidebar.render(state);
    editor.render(state);
    preview.render(state);
    status.textContent = saveStatusText(state);
    status.classList.toggle("is-error", state.saveStatus === "error");
    banner.hidden = state.storageMode !== "memory";
    workspace.classList.toggle("is-welcome", state.ready && state.sets.length === 0);
  });

  preview.render();
  redrawWhenFontsLoad(preview);
  window.addEventListener("pagehide", () => { void app.flushSaves(); });
  void app.init();
}

start();
