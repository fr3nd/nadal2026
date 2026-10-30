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

## Credits and licenses

- Code and pixel art: MIT, see [LICENSE](LICENSE).
- Font: [Tiny5](https://fonts.google.com/specimen/Tiny5), SIL Open Font License 1.1
  (`src/assets/OFL.txt`).
- Music: "Jingle Bells" (J. L. Pierpont, 1857) is in the public domain; this arrangement is synthesized in code.
