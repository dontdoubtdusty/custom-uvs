// The sidebar: pick or create a set, edit its name and code, and pick a card from the list.

import { formatNumber } from "../model/card";
import { getCardType } from "../model/cardTypes";
import type { CardSet } from "../model/set";
import type { AppState, StateSnapshot } from "../state/appState";
import { actionTarget, escapeHtml as esc, qs, setValueIfIdle } from "./dom";
import { icon } from "./icons";

export class Sidebar {
  /** Whether the "new set" form is open. Local to the sidebar, not app state. */
  private creatingSet = false;
  /** Last set options rendered, so the dropdown is only rebuilt when sets change. */
  private lastOptionsHtml = "";

  constructor(private readonly root: HTMLElement, private readonly app: AppState) {
    root.innerHTML = this.skeletonHtml();
    root.addEventListener("click", (e) => this.onClick(e));
    qs<HTMLSelectElement>("#set-select", root).addEventListener("change", (e) => {
      void app.selectSet((e.target as HTMLSelectElement).value);
    });
    qs<HTMLInputElement>("#set-name", root).addEventListener("change", (e) => {
      void app.updateSet({ name: (e.target as HTMLInputElement).value });
    });
    qs<HTMLInputElement>("#set-code", root).addEventListener("change", (e) => {
      void app.updateSet({ code: (e.target as HTMLInputElement).value });
    });
    qs<HTMLFormElement>("#new-set-form", root).addEventListener("submit", (e) => {
      e.preventDefault();
      const name = qs<HTMLInputElement>("#new-set-name", root).value;
      const code = qs<HTMLInputElement>("#new-set-code", root).value;
      this.creatingSet = false;
      void app.createSet(name, code);
    });
  }

  /** The fixed structure of the sidebar; render() only fills in the changing parts. */
  private skeletonHtml(): string {
    return `
      <div class="panel-block">
        <label class="field-label" for="set-select">Set</label>
        <div class="set-picker">
          <select id="set-select" class="input"></select>
          <button type="button" class="icon-button" data-action="new-set" title="New set" aria-label="New set">${icon("plus")}</button>
        </div>
        <form class="new-set-form" id="new-set-form" hidden>
          <div class="field"><label class="field-label" for="new-set-name">Set name</label>
            <input id="new-set-name" class="input" maxlength="60" required></div>
          <div class="field"><label class="field-label" for="new-set-code">Code</label>
            <input id="new-set-code" class="input input-code" maxlength="5" placeholder="MYS"></div>
          <div class="button-row">
            <button type="submit" class="button button-primary">Create set</button>
            <button type="button" class="button" data-action="cancel-new-set">Cancel</button>
          </div>
        </form>
        <details class="set-details">
          <summary>Set details</summary>
          <div class="field"><label class="field-label" for="set-name">Name</label>
            <input id="set-name" class="input" maxlength="60"></div>
          <div class="field"><label class="field-label" for="set-code">Code</label>
            <input id="set-code" class="input input-code" maxlength="5"></div>
          <button type="button" class="button button-danger" data-action="delete-set">${icon("trash")}Delete set</button>
        </details>
      </div>
      <div class="panel-block cards-block">
        <div class="cards-heading">
          <h2 id="cards-title">Cards</h2>
          <button type="button" class="button button-primary button-small" data-action="new-card">${icon("plus")}Add card</button>
        </div>
        <ol class="card-list" id="card-list" aria-labelledby="cards-title"></ol>
      </div>`;
  }

  /** Handles every button in the sidebar via its data-action. */
  private onClick(event: Event): void {
    const button = actionTarget(event);
    if (!button) return;
    switch (button.dataset.action) {
      case "new-set":
        this.creatingSet = true;
        this.render(this.app.state);
        qs<HTMLInputElement>("#new-set-name", this.root).focus();
        break;
      case "cancel-new-set":
        this.creatingSet = false;
        this.render(this.app.state);
        break;
      case "delete-set": {
        const set = this.app.currentSet();
        const count = this.app.state.cards.length;
        if (set && window.confirm(`Delete the set "${set.name}" and its ${count} card${count === 1 ? "" : "s"}? This cannot be undone.`)) {
          void this.app.deleteSet();
        }
        break;
      }
      case "new-card":
        void this.app.createCard();
        break;
      case "select-card":
        void this.app.selectCard(button.dataset.id ?? "");
        break;
    }
  }

  /** Updates the sidebar to match state without disturbing fields the user is typing in. */
  render(state: StateSnapshot): void {
    this.root.hidden = !state.ready || state.sets.length === 0;
    const set = this.app.currentSet();

    const select = qs<HTMLSelectElement>("#set-select", this.root);
    const optionsHtml = state.sets.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} (${esc(s.code)})</option>`).join("");
    if (optionsHtml !== this.lastOptionsHtml) {
      select.innerHTML = optionsHtml;
      this.lastOptionsHtml = optionsHtml;
    }
    select.value = state.currentSetId ?? "";

    const form = qs<HTMLFormElement>("#new-set-form", this.root);
    if (form.hidden === this.creatingSet) {
      form.hidden = !this.creatingSet;
      if (!this.creatingSet) form.reset();
    }

    if (set) {
      setValueIfIdle(qs<HTMLInputElement>("#set-name", this.root), set.name);
      setValueIfIdle(qs<HTMLInputElement>("#set-code", this.root), set.code);
    }
    this.renderCardList(state, set);
  }

  /** Rebuilds the card list and keeps keyboard focus on the selected card. */
  private renderCardList(state: StateSnapshot, set: CardSet | null): void {
    const list = qs("#card-list", this.root);
    const hadFocus = list.contains(document.activeElement);
    qs("#cards-title", this.root).textContent = `Cards (${state.cards.length})`;
    if (!state.cards.length) {
      list.innerHTML = '<li class="card-list-empty">No cards yet. Add one to start.</li>';
      return;
    }
    list.innerHTML = state.cards.map((c) => {
      const typeDef = getCardType(c.type);
      const active = c.id === state.currentCardId;
      return `<li><button type="button" class="card-row${active ? " is-active" : ""}" data-action="select-card" data-id="${esc(c.id)}"${active ? ' aria-current="true"' : ""}>` +
        `<span class="card-row-number">${esc((set?.code ?? "") + " " + formatNumber(c.number))}</span>` +
        `<span class="card-row-name">${esc(c.name.trim() || "Untitled")}</span>` +
        `<span class="type-tag" style="--type-color:${typeDef.color}">${esc(typeDef.name)}</span>` +
        `</button></li>`;
    }).join("");
    if (hadFocus) list.querySelector<HTMLElement>(".is-active")?.focus();
  }
}
