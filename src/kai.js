// ===========================================================================
//  KAI — edit this file to make him look like the real Kai!
//  Seen from above/behind, riding his sled up the screen. 16 x 20 pixels.
//
//  Letters (see KAI_PALETTE below):
//    R/r  hat (red / dark red)      W  pom-pom & fur band (white)
//    h    hair                      S  hands (skin)
//    B/b  jacket (blue / dark)      Y/y  scarf (yellow / dark yellow)
//    T    sled deck                 N  sled runners
//  Every row must have exactly 16 characters.
// ===========================================================================
export const KAI_ROWS = [
  '..NN........NN..',
  '..NTTTTTTTTTTN..',
  '..NTTSSTTSSTTN..',
  '..NTbBBBBBBbTN..',
  '..NTbBBBBBBbTN..',
  '..NTTYYYYYYTTN..',
  '..NTrRRRRRRrTN..',
  '..NTRRRRRRRRTN..',
  '..NTRRRRRRRRTN..',
  '..NTRRRRRRRRTN..',
  '..NTWWWWWWWWTN..',
  '..NThhhhhhhhTN..',
  '..NTTbBBBBbTTN..',
  '..NTYbBBBBbYTN..',
  '..NTYTWWWWTYTN..',
  '..NTyTWWWWTyTN..',
  '..NTTTTWWTTTTN..',
  '..NTTTTTTTTTTN..',
  '..NTTTTTTTTTTN..',
  '..NN........NN..',
];

// Change these colors to match Kai's hair and clothes.
export const KAI_PALETTE = {
  h: '#6b4226', // hair
  S: '#f2c6a0', // skin
  B: '#2f6fd0', // jacket
  b: '#1f478f', // jacket shade
  R: '#d62839', // hat
  r: '#8f1b2b',
  Y: '#ffd23f', // scarf
  y: '#e0951b',
  W: '#fbfdff', // pom-pom / fur
  T: '#b07a45', // sled deck
  N: '#6b3f22', // runners
};

// Look while the star power-up is active (golden Kai).
export const KAI_STAR_PALETTE = {
  ...KAI_PALETTE,
  R: '#ffd23f', r: '#e0951b', B: '#ffe88a', b: '#ffd23f', Y: '#fbfdff', y: '#ffe88a', W: '#fbfdff',
};
