// ===========================================================================
//  KAI — edit this file to make him look like the real Kai!
//  KAI_LOOK holds his colors and style. The shapes are drawn
//  in drawKai() below; every block says which part it paints.
//  Kai faces the player, riding down the hill on his sled. ~34 x 46 px.
// ===========================================================================
import { Pix, lighten } from './pixart.js';

// Features taken from the real Kai: dark brown hair with a side-swept fringe
// (longer on his left), thick eyebrows, big dark brown eyes, ears that peek
// out, warm skin, and a smile with teeth.
const BASE = {
  skin: '#e8b48e',
  skinDark: '#cf9672',
  hair: '#5a4434',
  eyes: '#2e1a10',
  cheeks: '#ee9a86',
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
  eyeStyle: 'oval', // 'oval' | 'happy'
  hatStyle: 'low', // 'low' = pulled over the forehead, 'back' = pushed back, more hair
};

export const KAI_LOOK = {
  ...BASE,
  hatStyle: 'low',
  jacket: '#8c5a64', // plum sweatshirt, like his real one
  scarf: '#d93a48',
};

// Two eye looks: tall ovals normally, and happy closed arcs for a moment when
// he grabs a gift ('happy'). Each draws both eyes.
function paintEyes(p, ox, oy, style, L) {
  const D = L.eyes;
  const px = (x, y, c) => p.set(ox + x, oy + y, c);
  [[11, -1], [18, 1]].forEach(([x, side]) => { // side: -1 left eye, +1 right eye
    if (style === 'happy') {
      px(x, 15, D); px(x, 14, D); px(x + 1, 13, D); px(x + 2, 14, D); px(x + 2, 15, D);
    } else { // 'oval': tall bean-shaped eyes with a shine
      const ex = x + (side < 0 ? 0 : 1);
      p.rect(ox + ex, oy + 13, 2, 4, D);
      px(ex, 13, '#ffffff');
    }
  });
}

// mode: 'normal' | 'star' (golden) | 'hurt' (ouch face)
export function drawKai(mode = 'normal', look = KAI_LOOK, eyeStyle = null) {
  const L = { ...look };
  if (eyeStyle) L.eyeStyle = eyeStyle;
  if (mode === 'star') {
    Object.assign(L, { hat: '#ffd23f', jacket: '#ffe88a', pants: '#ffb92e', scarf: '#ffffff', mittens: '#ffd23f', sled: '#ffd23f', sledTrim: '#ffffff' });
  }
  const back = L.hatStyle === 'back';
  const p = new Pix(34, 46);
  const ox = 1; const oy = 2; // room for the outline and the hat

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

  // --- body (jacket / sweatshirt), arms and mittens holding the sled ---
  p.blob(ox + 16, oy + 24, 8, 6, L.jacket);
  p.blob(ox + 8, oy + 25, 3, 4, L.jacket);
  p.blob(ox + 24, oy + 25, 3, 4, L.jacket);
  p.blob(ox + 6, oy + 29, 2.5, 2.5, L.mittens);
  p.blob(ox + 26, oy + 29, 2.5, 2.5, L.mittens);

  // --- scarf / collar, with a tail flapping to one side ---
  p.box(ox + 20, oy + 21, 4, 8, L.scarf, { round: 1 });
  p.blob(ox + 16, oy + 21, 8, 2.6, L.scarf);

  // --- ears (they peek out on both sides, like his) ---
  p.blob(ox + 7, oy + 14.5, 2, 2.6, L.skin, { dark: L.skinDark });
  p.blob(ox + 25, oy + 14.5, 2, 2.6, L.skin, { dark: L.skinDark });

  // --- head ---
  p.blob(ox + 16, oy + 13, 9, 9, L.skin, { dark: L.skinDark });

  // --- hair: short sides, and a fringe swept toward his left (longer there) ---
  p.blob(ox + 8.4, oy + 10.5, 2.3, 4, L.hair, { line: false });
  p.blob(ox + 23.6, oy + 10.5, 2.3, 4, L.hair, { line: false });
  const top = back ? 6 : 9;
  p.poly([
    [ox + 8, oy + top], [ox + 24, oy + top], [ox + 24.5, oy + 13.5], [ox + 21.5, oy + 12.2],
    [ox + 18, oy + 11.4], [ox + 13, oy + 10.8], [ox + 9.5, oy + 10.2],
  ], L.hair, { line: false, shade: false });
  // a few lighter strands
  [[13, 10], [16, 10], [20, 11]].forEach(([x, y]) => p.set(ox + x, oy + y, lighten(L.hair, 0.28)));

  // --- face ---
  const browC = '#3d2b20';
  if (mode === 'hurt') {
    // thick brows, > < eyes and an "o" mouth
    p.rect(ox + 10, oy + 11, 4, 1, browC); p.rect(ox + 18, oy + 11, 4, 1, browC);
    [[11, 13, 1], [20, 13, -1]].forEach(([x, y, d]) => {
      p.set(ox + x, oy + y, L.eyes); p.set(ox + x + d, oy + y + 1, L.eyes); p.set(ox + x, oy + y + 2, L.eyes);
      p.set(ox + x + d * 2, oy + y + 1, L.eyes);
    });
    p.rect(ox + 15, oy + 19, 3, 2, '#8f2a3a');
    p.set(ox + 16, oy + 19, '#d9606e');
  } else {
    // thick eyebrows
    p.rect(ox + 10, oy + 11, 4, 1, browC);
    p.rect(ox + 18, oy + 11, 4, 1, browC);
    p.set(ox + 14, oy + 11, L.skinDark); p.set(ox + 17, oy + 11, L.skinDark);
    paintEyes(p, ox, oy, L.eyeStyle, L);
    // smile with teeth
    p.rect(ox + 13, oy + 19, 6, 1, '#ffffff');
    p.rect(ox + 14, oy + 20, 4, 1, '#b4535e');
    p.set(ox + 12, oy + 19, '#9a3b4a');
    p.set(ox + 19, oy + 19, '#9a3b4a');
  }
  p.rect(ox + 15, oy + 17, 2, 1, L.skinDark); // nose
  p.rect(ox + 9, oy + 18, 2, 1, L.cheeks);   // cheeks
  p.rect(ox + 22, oy + 18, 2, 1, L.cheeks);

  // --- hat: dome, droopy tip with pom-pom, fur band ---
  if (back) {
    p.blob(ox + 16, oy + 3, 9.5, 4.8, L.hat);
    p.blob(ox + 25, oy + 1.5, 4, 3, L.hat);
    p.blob(ox + 30, oy + 3.5, 3, 3, L.hatTrim);
    p.blob(ox + 16, oy + 5.6, 10.5, 2.1, L.hatTrim, { dark: '#d9d3e6' });
  } else {
    p.blob(ox + 16, oy + 5.5, 9.5, 5, L.hat);
    p.blob(ox + 24, oy + 3, 4, 3, L.hat);
    p.blob(ox + 29, oy + 5, 3, 3, L.hatTrim);
    p.blob(ox + 16, oy + 8, 10.5, 2.2, L.hatTrim, { dark: '#d9d3e6' });
  }

  return p.outlined();
}
