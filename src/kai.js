// ===========================================================================
//  KAI — edit this file to make him look like the real Kai!
//  Change the colors in KAI_LOOK (hair, skin, hat, jacket...). The shapes are
//  drawn in drawKai() below; every line says which part it paints.
//  Kai faces the player, riding down the hill on his sled. ~32 x 42 px.
// ===========================================================================
import { Pix, lighten, outlineOf } from './pixart.js';

export const KAI_LOOK = {
  skin: '#f6c9a2',
  hair: '#7a4a2a',
  eyes: '#2b1d3f',
  cheeks: '#f08a8a',
  hat: '#e2323f',
  hatTrim: '#fffaf0',
  scarf: '#ffd23f',
  jacket: '#3b7be0',
  pants: '#2c4fa3',
  boots: '#7b4a2b',
  mittens: '#e2323f',
  sled: '#c9453a',
  sledTrim: '#ffd23f',
  runner: '#6b4a38',
};

// mode: 'normal' | 'star' (golden) | 'hurt' (ouch face)
export function drawKai(mode = 'normal') {
  const L = { ...KAI_LOOK };
  if (mode === 'star') {
    Object.assign(L, { hat: '#ffd23f', jacket: '#ffe88a', pants: '#ffb92e', scarf: '#ffffff', mittens: '#ffd23f', sled: '#ffd23f', sledTrim: '#ffffff' });
  }
  const p = new Pix(34, 44);
  const ox = 1; const oy = 1; // room for the outline

  // --- sled runners (curl up at the front) ---
  p.box(ox + 2, oy + 24, 4, 16, L.runner, { round: 1 });
  p.box(ox + 26, oy + 24, 4, 16, L.runner, { round: 1 });
  p.box(ox + 2, oy + 37, 4, 3, lighten(L.runner, 0.25), { round: 1, shade: false });
  p.box(ox + 26, oy + 37, 4, 3, lighten(L.runner, 0.25), { round: 1, shade: false });

  // --- sled body ---
  p.box(ox + 4, oy + 28, 24, 10, L.sled, { round: 3 });
  p.rect(ox + 7, oy + 30, 18, 1, L.sledTrim);

  // --- legs and boots (sticking out front) ---
  p.box(ox + 9, oy + 27, 6, 7, L.pants, { round: 2 });
  p.box(ox + 17, oy + 27, 6, 7, L.pants, { round: 2 });
  p.box(ox + 8, oy + 33, 7, 5, L.boots, { round: 2 });
  p.box(ox + 17, oy + 33, 7, 5, L.boots, { round: 2 });

  // --- body (jacket) ---
  p.blob(ox + 16, oy + 24, 8, 6, L.jacket);
  // --- arms and mittens, holding the sled sides ---
  p.blob(ox + 8, oy + 25, 3, 4, L.jacket);
  p.blob(ox + 24, oy + 25, 3, 4, L.jacket);
  p.blob(ox + 6, oy + 29, 2.5, 2.5, L.mittens);
  p.blob(ox + 26, oy + 29, 2.5, 2.5, L.mittens);

  // --- scarf, with a tail flapping to one side ---
  p.box(ox + 20, oy + 21, 4, 8, L.scarf, { round: 1 });
  p.blob(ox + 16, oy + 21, 8, 2.6, L.scarf);

  // --- head ---
  p.blob(ox + 16, oy + 13, 10, 8.5, L.skin, { dark: '#e5a583' });
  // hair: small side tufts, visible next to the face
  p.blob(ox + 6.5, oy + 13, 2.5, 3.2, L.hair);
  p.blob(ox + 25.5, oy + 13, 2.5, 3.2, L.hair);

  // --- face ---
  if (mode === 'hurt') {
    // >  <  eyes and a little "o" mouth
    [[11, 11, 1], [20, 11, -1]].forEach(([x, y, d]) => {
      p.set(ox + x, oy + y, L.eyes); p.set(ox + x + d, oy + y + 1, L.eyes); p.set(ox + x, oy + y + 2, L.eyes);
      p.set(ox + x + d * 2, oy + y + 1, L.eyes);
    });
    p.rect(ox + 15, oy + 18, 3, 2, '#8f2a3a');
    p.set(ox + 16, oy + 18, '#d9606e');
  } else {
    // big eyes with a shine (Minish-style)
    [11, 20].forEach((x) => {
      p.rect(ox + x, oy + 11, 3, 4, L.eyes);
      p.set(ox + x, oy + 11, '#ffffff');
      p.set(ox + x + 1, oy + 14, lighten(L.eyes, 0.35));
    });
    // smile
    p.set(ox + 14, oy + 18, '#9a3b4a');
    p.rect(ox + 15, oy + 19, 3, 1, '#9a3b4a');
    p.set(ox + 18, oy + 18, '#9a3b4a');
  }
  // rosy cheeks
  p.rect(ox + 9, oy + 17, 2, 2, L.cheeks);
  p.rect(ox + 23, oy + 17, 2, 2, L.cheeks);

  // --- hat: dome, droopy tip with pom-pom, fur band ---
  p.blob(ox + 16, oy + 5.5, 10, 5, L.hat);
  p.blob(ox + 24, oy + 3, 4, 3, L.hat);
  p.blob(ox + 29, oy + 5, 3, 3, L.hatTrim);
  p.blob(ox + 16, oy + 8, 11, 2.2, L.hatTrim, { dark: '#d9d3e6' });
  // fringe of hair peeking out under the fur band
  p.blob(ox + 12.5, oy + 10, 3, 1.2, L.hair, { line: false });
  p.blob(ox + 19.5, oy + 10, 3, 1.2, L.hair, { line: false });

  return p.outlined();
}

export const kaiOutline = outlineOf;
