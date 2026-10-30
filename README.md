# UVS Card Creator

Make your own custom cards in the style of the UniVersus card game, with your own art and effects.

Use it at **https://dontdoubtdusty.github.io/custom-uvs/**. Nothing to install. Your sets, cards and art are saved in your browser and never uploaded.

This is a fan-made tool. The card frame is an original design that follows the UniVersus information layout; it does not reproduce official card art or logos.

## Features (v0.03)

- Create several sets, each with a name, a short code (printed as `MYS 001`) and an optional size, which prints card numbers as `21/185`.
- Edit cards of every type: attack, foundation, action, asset, backup, character and token.
- Live card preview as you type, on a cutting-mat workspace.
- A frame laid out the way current UniVersus cards are read: name tab over the bottom of the art with a keyword strip below it, speed, damage and check stacked on the right edge of the text box, symbols bottom left, collector line bottom right. Characters are full art with hand size and health beside the name.
- Stats in current-rules terms: difficulty, check value, block modifier and zone, speed, damage, attack zone, hand size, health, stamina and character version. A blank stat is not printed.
- Resource symbols, including attuned symbols (printed as squares).
- Effect text with `**bold**`, ability labels like `[[Enhance]]` (printed as dark chips) and inline symbols like `{fire}`.
- Optional flavor text, printed in italics under the effect text.
- Upload art, then drag it on the card and zoom to frame it.
- Duplicate and delete cards. Changes save automatically.
- Works on phones and desktops, in light and dark mode. If the browser blocks storage, the app still runs and says your work will not be kept.

Coming next: PNG export and JSON backup (v0.04), print sheets (v0.05), Tabletop Simulator deck sheets (v0.06).

## Developing

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # local site that reloads as you edit
npm run typecheck  # TypeScript type check only
npm run build      # type check, then build the site into dist/
```

Pushing to `main` builds and publishes the site to GitHub Pages through `.github/workflows/deploy.yml`.

### Code layout

- `src/model` - data shapes and definitions (cards, sets, card types, symbols). No UI.
- `src/storage` - IndexedDB access, the in-memory fallback and the migrations list.
- `src/state` - `AppState`, the single place that changes data. The UI only calls its methods.
- `src/render` - draws a card onto a canvas from card data.
- `src/ui` - the sidebar, editor and preview.
- `src/main.ts` - wires everything together.

### Saved data rules

- Saved data shapes are `Card` (`src/model/card.ts`) and `CardSet` (`src/model/set.ts`).
- Any change to how data is stored needs a new migration added to the end of `src/storage/migrations.ts`. Never edit an existing migration.
