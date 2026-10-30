// The editor panel: the welcome screen when there are no sets, otherwise the form for the selected card.
// The form is rebuilt only when the card or its type changes; typing just updates state.

import type { Card } from "../model/card";
import { CARD_TYPES, getCardType, RARITIES, ZONES, type CardTypeId, type StatField } from "../model/cardTypes";
import { SYMBOLS, type SymbolId } from "../model/symbols";
import type { AppState, StateSnapshot } from "../state/appState";
import { actionTarget, escapeHtml as esc, setValueIfIdle } from "./dom";
import { icon, symbolSvg } from "./icons";

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export class Editor {
  /** Identifies what the panel currently shows, so it is only rebuilt when that changes. */
  private shownKey = "";

  constructor(private readonly root: HTMLElement, private readonly app: AppState) {
    root.addEventListener("input", (e) => this.onInput(e));
    root.addEventListener("change", (e) => this.onChange(e));
    root.addEventListener("click", (e) => this.onClick(e));
    root.addEventListener("submit", (e) => this.onSubmit(e));
    root.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  /** Shows the right view for the current state and syncs field values. */
  render(state: StateSnapshot): void {
    if (!state.ready) return;
    const card = this.app.currentCard();
    const key = !state.sets.length ? "welcome" : !card ? "empty:" + state.currentSetId : `card:${card.id}:${card.type}`;
    if (key !== this.shownKey) {
      this.shownKey = key;
      this.root.innerHTML = key === "welcome" ? this.welcomeHtml() : card ? this.cardFormHtml(card) : this.emptySetHtml();
    }
    if (card) this.sync(card);
  }

  /** The first-run screen: explains sets and creates the first one. */
  private welcomeHtml(): string {
    return `
      <div class="welcome">
        <h2>Start your first set</h2>
        <p>A set groups your cards under one short code, so they print as MYS 001, MYS 002 and so on.</p>
        <form class="welcome-form" data-form="create-set">
          <div class="field"><label class="field-label" for="welcome-name">Set name</label>
            <input id="welcome-name" class="input" name="name" maxlength="60" placeholder="My first set" required></div>
          <div class="field"><label class="field-label" for="welcome-code">Code</label>
            <input id="welcome-code" class="input input-code" name="code" maxlength="5" placeholder="MYS"></div>
          <button type="submit" class="button button-primary">Create set</button>
        </form>
        <p class="muted">Everything is saved in this browser. Nothing is uploaded.</p>
      </div>`;
  }

  /** Shown when the selected set has no cards. */
  private emptySetHtml(): string {
    return `
      <div class="welcome">
        <h2>This set has no cards yet</h2>
        <p>Add a card to start filling in its name, stats and effect.</p>
        <button type="button" class="button button-primary" data-action="new-card">${icon("plus")}Add card</button>
      </div>`;
  }

  /** Builds one labelled text input bound to a card field. */
  private textField(key: string, label: string, attrs = ""): string {
    return `<div class="field"><label class="field-label" for="f-${key}">${esc(label)}</label>` +
      `<input id="f-${key}" class="input" data-field="${key}" ${attrs}></div>`;
  }

  /** Builds the input for one stat: a short text box or a zone dropdown. */
  private statField(stat: StatField): string {
    if (stat.kind === "text") {
      const placeholder = stat.optional ? 'placeholder="Blank hides it"' : "";
      return this.textField(stat.key, stat.label, `maxlength="5" autocomplete="off" ${placeholder}`);
    }
    const options = ZONES.map((z) => `<option value="${z.id}">${z.name}</option>`);
    if (stat.allowNone) options.push('<option value="none">None</option>');
    return `<div class="field"><label class="field-label" for="f-${stat.key}">${esc(stat.label)}</label>` +
      `<select id="f-${stat.key}" class="input" data-field="${stat.key}">${options.join("")}</select></div>`;
  }

  /** Builds the full card form for the card's type. */
  private cardFormHtml(card: Card): string {
    const typeDef = getCardType(card.type);
    const typeOptions = CARD_TYPES.map((t) =>
      `<label class="type-option" style="--type-color:${t.color}">` +
      `<input type="radio" name="card-type" value="${t.id}"${t.id === card.type ? " checked" : ""}><span>${t.name}</span></label>`
    ).join("");
    const symbolChips = SYMBOLS.map((s) =>
      `<button type="button" class="symbol-chip" data-action="cycle-symbol" data-symbol="${s.id}" data-state="off">` +
      `<span class="symbol-chip-icon"></span><span class="symbol-chip-name">${s.name}</span>` +
      `<span class="symbol-chip-state"></span></button>`
    ).join("");
    const insertButtons = SYMBOLS.map((s) =>
      `<button type="button" class="insert-symbol" data-action="insert-symbol" data-symbol="${s.id}" title="Insert ${s.name}" aria-label="Insert ${s.name} symbol">${symbolSvg(s.id)}</button>`
    ).join("");
    const rarityOptions = RARITIES.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");

    return `
      <form class="card-form" data-form="card" novalidate>
        <section class="form-section">
          <h2>Basics</h2>
          ${this.textField("name", "Name", 'maxlength="60" autocomplete="off"')}
          <fieldset class="field"><legend class="field-label">Type</legend><div class="type-options">${typeOptions}</div></fieldset>
          ${this.textField("keywords", "Keywords", 'maxlength="80" placeholder="Powerful: 2, Ranged, Weapon" autocomplete="off"')}
          <p class="hint">Separate keywords with commas.</p>
        </section>

        <section class="form-section">
          <h2>Stats</h2>
          <div class="stat-grid">${typeDef.stats.map((s) => this.statField(s)).join("")}</div>
          ${typeDef.note ? `<p class="hint">${esc(typeDef.note)}</p>` : ""}
        </section>

        <section class="form-section">
          <h2>Resource symbols</h2>
          <div class="symbol-grid">${symbolChips}</div>
          <p class="hint">Click once to add a symbol, again to make it attuned (printed as a square), and once more to remove it.</p>
        </section>

        <section class="form-section">
          <h2>Effect text</h2>
          <div class="text-toolbar" role="toolbar" aria-label="Effect text tools">
            <button type="button" class="tool-button" data-action="bold" title="Bold" aria-label="Bold">${icon("bold")}</button>
            <button type="button" class="tool-button" data-action="label" title="Ability label" aria-label="Ability label">${icon("label")}</button>
            <span class="toolbar-divider" aria-hidden="true"></span>${insertButtons}
          </div>
          <label class="visually-hidden" for="f-text">Effect text</label>
          <textarea id="f-text" class="input textarea" data-field="text" rows="6" placeholder="[[Enhance]]: Your attack gets +1 speed."></textarea>
          <p class="hint">Wrap words in ** to make them bold. Wrap an ability name in double brackets, like [[Enhance]], to print it as a label. Type a symbol name in braces, like {fire}, or use the buttons above.</p>
        </section>

        <section class="form-section">
          <h2>Art</h2>
          <input type="file" id="f-art" class="visually-hidden" accept="image/*" tabindex="-1">
          <div class="button-row">
            <button type="button" class="button" data-action="pick-art">${icon("upload")}<span id="art-button-label">Upload art</span></button>
          </div>
          <div class="art-controls" data-art-only hidden>
            <div class="field"><label class="field-label" for="f-artZoom">Zoom</label>
              <input id="f-artZoom" type="range" min="1" max="4" step="0.01" data-field="artZoom" class="range"></div>
            <div class="button-row">
              <button type="button" class="button" data-action="reset-art">${icon("reset")}Reset position</button>
              <button type="button" class="button button-danger" data-action="remove-art">${icon("trash")}Remove art</button>
            </div>
            <p class="hint">Drag the art on the card to move it.</p>
          </div>
        </section>

        <section class="form-section">
          <h2>Card details</h2>
          <div class="stat-grid">
            ${this.textField("number", "Number", 'type="number" min="1" max="999" inputmode="numeric"')}
            <div class="field"><label class="field-label" for="f-rarity">Rarity</label>
              <select id="f-rarity" class="input" data-field="rarity">${rarityOptions}</select></div>
          </div>
          ${this.textField("artist", "Artist", 'maxlength="60" autocomplete="off" placeholder="Who made the art"')}
        </section>

        <div class="editor-actions">
          <button type="button" class="button" data-action="duplicate-card">${icon("copy")}Duplicate card</button>
          <button type="button" class="button button-danger" data-action="delete-card">${icon("trash")}Delete card</button>
        </div>
      </form>`;
  }

  /** Copies card values into the form, skipping the field being typed in. */
  private sync(card: Card): void {
    const values = card as unknown as Record<string, unknown>;
    this.root.querySelectorAll<Field>("[data-field]").forEach((input) => {
      const key = input.dataset.field ?? "";
      setValueIfIdle(input, String(values[key] ?? ""));
    });
    this.root.querySelectorAll<HTMLElement>('[data-action="cycle-symbol"]').forEach((chip) => {
      const symbol = card.symbols.find((s) => s.id === chip.dataset.symbol);
      const state = !symbol ? "off" : symbol.attuned ? "attuned" : "on";
      if (chip.dataset.state === state && chip.dataset.drawn) return;
      chip.dataset.state = state;
      chip.dataset.drawn = "1";
      chip.querySelector(".symbol-chip-icon")!.innerHTML = symbolSvg(chip.dataset.symbol ?? "", state === "attuned");
      chip.querySelector(".symbol-chip-state")!.textContent = state === "attuned" ? "Attuned" : "";
      const name = chip.querySelector(".symbol-chip-name")!.textContent;
      chip.setAttribute("aria-label", `${name}: ${state === "off" ? "not on card" : state === "on" ? "on card" : "attuned"}`);
    });
    const artControls = this.root.querySelector<HTMLElement>("[data-art-only]");
    if (artControls) artControls.hidden = !card.artId;
    const artLabel = this.root.querySelector("#art-button-label");
    if (artLabel) artLabel.textContent = card.artId ? "Replace art" : "Upload art";
  }

  /** Sends typed values to state, converting numbers where needed. */
  private onInput(event: Event): void {
    const el = event.target as Field;
    const key = el.dataset?.field;
    if (!key) return;
    if (key === "artZoom") {
      this.app.updateCard({ artZoom: parseFloat(el.value) || 1 });
    } else if (key === "number") {
      const n = parseInt(el.value, 10);
      if (n >= 1 && n <= 999) this.app.updateCard({ number: n });
    } else {
      this.app.updateCard({ [key]: el.value } as Partial<Card>);
    }
  }

  /** Handles the type radios and the art file picker. */
  private onChange(event: Event): void {
    const el = event.target as HTMLInputElement;
    if (el.name === "card-type") {
      this.app.updateCard({ type: el.value as CardTypeId });
      this.root.querySelector<HTMLInputElement>(`input[name="card-type"][value="${el.value}"]`)?.focus();
    } else if (el.id === "f-art" && el.files?.[0]) {
      void this.app.setArt(el.files[0]);
      el.value = "";
    } else if (el.id === "f-number") {
      // Snap an out-of-range number back to the saved one when the field is left.
      const card = this.app.currentCard();
      if (card) el.value = String(card.number);
    }
  }

  /** Handles the create-set form on the welcome screen. */
  private onSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    if (form.dataset.form !== "create-set") return;
    const data = new FormData(form);
    void this.app.createSet(String(data.get("name") ?? ""), String(data.get("code") ?? ""));
  }

  /** Stops Enter in single-line card fields from submitting the form. */
  private onKeyDown(event: KeyboardEvent): void {
    const el = event.target as HTMLElement;
    if (event.key === "Enter" && el.tagName === "INPUT" && el.closest('[data-form="card"]')) event.preventDefault();
  }

  /** Wraps the selected effect text in markers (like ** or [[ ]]), or inserts an empty pair at the caret. */
  private wrapSelection(textarea: HTMLTextAreaElement, open: string, close: string): void {
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    textarea.value = value.slice(0, start) + open + value.slice(start, end) + close + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + open.length, end + open.length);
    this.app.updateCard({ text: textarea.value });
  }

  /** Inserts a {symbol} token at the caret. */
  private insertSymbol(textarea: HTMLTextAreaElement, symbolId: string): void {
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const token = `{${symbolId}}`;
    textarea.value = value.slice(0, start) + token + value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(start + token.length, start + token.length);
    this.app.updateCard({ text: textarea.value });
  }

  /** Handles every button in the panel via its data-action. */
  private onClick(event: Event): void {
    const button = actionTarget(event);
    if (!button) return;
    const textarea = this.root.querySelector<HTMLTextAreaElement>("#f-text");
    switch (button.dataset.action) {
      case "cycle-symbol": this.app.cycleSymbol(button.dataset.symbol as SymbolId); break;
      case "bold": if (textarea) this.wrapSelection(textarea, "**", "**"); break;
      case "label": if (textarea) this.wrapSelection(textarea, "[[", "]]"); break;
      case "insert-symbol": if (textarea) this.insertSymbol(textarea, button.dataset.symbol ?? ""); break;
      case "pick-art": this.root.querySelector<HTMLInputElement>("#f-art")?.click(); break;
      case "reset-art": this.app.updateCard({ artPanX: 0, artPanY: 0, artZoom: 1 }); break;
      case "remove-art": void this.app.removeArt(); break;
      case "new-card": void this.app.createCard(); break;
      case "duplicate-card": void this.app.duplicateCard(); break;
      case "delete-card": {
        const card = this.app.currentCard();
        if (card && window.confirm(`Delete "${card.name.trim() || "Untitled"}"? This cannot be undone.`)) void this.app.deleteCard();
        break;
      }
    }
  }
}
