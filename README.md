# El Trineu del Kai · Kai's Sled 🛷

Christmas 2026 card: a small pixel-art game (in a Zelda: The Minish Cap-like style) where Kai rides a sled down a snowy hill,
switching between 3 lanes to collect gifts and dodge trees, snowmen and rocks. One hit and the run is over,
unless Kai grabs a star (6 seconds of invincibility).
Plays on phones (one hand, swipe or on-screen buttons) and on desktop (arrow keys or A / D).
English and Catalan. No ads, no tracking, no accounts.

## Run locally

```sh
npm install
npm run dev        # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
```

## Previewing without playing

Add these to the game URL (dev server on localhost) to jump straight to a moment. The run starts by
itself (tap once anywhere to turn the sound on). **They only work on localhost** (`localhost`, `127.0.0.1`;
see `src/debug.js`): on the online game, and on any other address, the parameters are ignored. While one
is on, nothing is saved or sent: no best score and no shared high-score table.

| URL | What you get |
| --- | --- |
| `?t=43` | start the run 43 s in (try `t=43` for "Super Speed!" at 45 s) |
| `?m=240` | start at 240 m (the "Ho ho ho!" bonus line comes at 250 m) |
| `?god` | Kai can't be hurt, so you can watch for as long as you like |
| `?over` | a crash after 1.5 s, straight to the game over screen (and the hit sound) |

They combine, e.g. `http://localhost:5173/?t=43&god`.

## Build and deploy

```sh
npm run build      # outputs plain static files into dist/
```

`dist/` is the whole site. Copy it to the web root, for example:

```sh
rsync -av --delete dist/ user@server:/var/www/nadal2026.fr3nd.net/
```

Paths are relative, so it also works from a sub-folder. Every push to `main` is also deployed to GitHub Pages
by `.github/workflows/pages.yml`: https://fr3nd.github.io/nadal2026/

## Tweak the game

| What | Where |
| --- | --- |
| Speed, lives, spawn rates, star/heart rarity, milestones, swipe sensitivity | `src/config.js` |
| All texts (EN/CA). To add a language add an entry + its code to `LANGS` | `src/i18n.js` |
| Kai's look (hair, skin, hat, jacket colors and shapes) | `src/kai.js` |
| Other sprites (trees, snowman, rock, gifts, star) and the painting toolkit | `src/sprites.js`, `src/pixart.js` |
| Music (Jingle Bells notes) and sound effects | `src/audio.js` |
| Colors, buttons, screens | `src/style.css` |

Code layout: `game.js` (rules) · `spawner.js` (rows + safe path) · `render.js` (drawing) ·
`input.js` (swipe/buttons/keys) · `ui.js` (screens, HUD) · `main.js` (glue).

Sound is synthesized with the Web Audio API, so there are no audio files. The best score,
language and mute choice are stored on the device (localStorage) only.

## High scores (Google Sheet + Apps Script)

The shared top-20 table lives in a private Google Sheet ("Kai's Sled - high scores"), behind a small
Apps Script web app bound to it (`apps-script/Code.gs`). No server, and no secrets in this repo. The
script only asks Google for `spreadsheets.currentonly`: access to that one sheet, nothing else.

- A run asks the script for a signed, single-use token when it starts. The score is only accepted
  with that token, and the script checks it against the time *it* measured, plus plausibility
  limits, so scores can't be submitted without playing or replayed. Names are cleaned (length,
  control characters, spreadsheet formulas). It can't stop someone who really plays and sends
  slightly inflated numbers; that is accepted for a family card.
- To moderate, open the sheet in your Google Drive and delete rows.
- If `scoresUrl` in `src/config.js` is empty, the game works without the shared table.

Update the script with [clasp](https://github.com/google/clasp). `.clasp.json` is local and not committed. On a new
machine: `clasp login`, copy the Script ID (the sheet's Extensions > Apps Script > Project settings), run
`npx @google/clasp clone <scriptId> --rootDir apps-script`, then `git checkout apps-script/` to keep the repo's
version of the files (clone overwrites them). The deployment id is the part of `scoresUrl` between `/s/` and `/exec`.

```sh
npx @google/clasp login
npx @google/clasp push --force
npx @google/clasp deploy --deploymentId <id> --description "what changed"   # keeps the same URL
```

First-time setup was: `clasp create --type sheets --rootDir apps-script`, restore
`apps-script/appsscript.json` (clasp overwrites it), `push`, `deploy`, then run `setup` once in the
script editor and authorize. The web app URL (`.../exec`) goes in `scoresUrl`.

Tests (no Google account needed): `node tests/apps-script.test.mjs` runs `Code.gs` against a mock.
To try the game against a local fake table: `SEED=1 node tests/mock-scores-server.mjs`, then open
`http://localhost:5173/?scores=http://localhost:8787/` (dev server only).

## Credits and licenses

- Code and pixel art: MIT, see [LICENSE](LICENSE).
- Font: [Tiny5](https://fonts.google.com/specimen/Tiny5), SIL Open Font License 1.1
  (`src/assets/OFL.txt`).
- Music: "Jingle Bells" (J. L. Pierpont, 1857) is in the public domain; this arrangement is synthesized in code.
