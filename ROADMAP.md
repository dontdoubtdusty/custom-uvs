# UVS Card Creator: roadmap

custom-uvs is the UniVersus counterpart to the slim Magic Set Editor fork
(`D:\My Documents\rpret\GitHub\MagicSetEditor2`, branch `slim`). It stays a browser app. Instead of
sharing code, it borrows proven features from MSE, rebuilt in TypeScript.

## Decisions

| Date | Decision |
|---|---|
| 2026-11-08 | custom-uvs stays a web app on GitHub Pages. MSE is a reference for features, not a code base to merge. MSE is GPL, so ideas are borrowed but code is not copied. |

## Already planned

- [ ] v0.04: PNG export of a card, and JSON backup and restore of all sets
- [ ] v0.05: print sheets
- [ ] v0.06: Tabletop Simulator deck sheets

## Borrowed from MSE

Each item names the MSE feature it comes from. They're in rough priority order and not yet scheduled.

| Feature | Comes from (MSE) | Notes |
|---|---|---|
| Export all card images, with a file name pattern like `{code}-{number}-{name}.png` | Export > All card images | Extends v0.04 from one card to the whole set |
| Undo and redo | Edit menu | No undo exists yet. Changes save automatically, so a mistake can't be taken back |
| Card list with sortable columns (number, name, type, difficulty, check) and a search box | Cards tab card list | The sidebar has no search or filter yet |
| Keyword database: define a keyword once with reminder text, then `[[Keyword]]` fills it in | Keywords tab | Keywords are a plain text field today |
| Set statistics: counts by card type, difficulty curve, symbol spread | Statistics tab | Helps balance a set |
| Print sheets with bleed and cut lines | Print window | Feeds v0.05 |
| Text spoiler export (a plain list of all cards) | HTML/text export templates | Good for sharing a set for review |
| Auto replace while typing, for example `(c)` to `©` or `--` to `—` | Auto replace window | Small feature |
| Random pack generator | Random Pack tab | Low priority, for playtesting draft |
| Frame variants per card (alternate frames, full art, foil-style) | Style tab | Larger feature, after the basics |

## Not borrowing

- MSE's scripting language and console: too heavy for a web app.
- Package manager and installer: there's nothing to install.
- Symbol editor: use uploaded images instead.
