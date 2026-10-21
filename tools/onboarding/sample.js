/* Onboarding page 3, "Pick up what is already there": the right button samples a cell.

   nox (tools/onboarding/nox_idle.json, one of the product's own sprites) is on the canvas with
   its right side unfinished: the eye, half the brow, half the nose, the shoulder and the foot
   are missing there. Every one of those marks already exists on the left, so the demo finishes
   the sprite by picking each one up with the right button and putting it down where it belongs.
   Each sample is answered on screen by the Paint bar and the Custom row, which is the whole point
   of the page; a last sample of an empty cell shows the Eraser light up.

   Mirror stays on, as it is for a new sprite: every mark placed here lands on the axis of the
   sprite's own symmetry, so its twin on the left receives the glyph it already has. The cells the
   demo does NOT draw (the right ear and the brow's corner) are the ones whose glyph only exists
   mirrored on the left - sampling hands back a glyph as it is, so they stay drawn from the start.

       node tools/onboarding/record.js tools/onboarding/sample.js --out assets/onboarding/onboarding_3.gif */
'use strict';
const fs = require('fs');
const path = require('path');

/* nox is 8x6; it goes on a 10x8 canvas, one cell in from every edge */
const sprite = JSON.parse(fs.readFileSync(path.join(__dirname, 'nox_idle.json'), 'utf8'));
const W = 10, H = 8, OX = 1, OY = 1;

/* what the demo draws, in canvas cells: [x, y] of the cell and the cell it is sampled from */
const MISSING = [
  { at: [7, 4], from: [2, 4] },   /* right eye   @  <- left eye */
  { at: [7, 3], from: [2, 3] },   /* right cheek █  <- left cheek (the paint goes back to Main) */
  { at: [5, 3], from: [4, 3] },   /* brow        ▔  <- the other half of the brow */
  { at: [5, 4], from: [3, 6] },   /* nose        ▝  <- the left foot has that glyph */
  { at: [7, 5], from: [3, 6] },   /* shoulder    ▝  <- same */
  { at: [6, 6], from: [2, 5] },   /* right foot  ▘  <- the left shoulder has that glyph */
];
const blank = {};
MISSING.forEach(m => { blank[m.at.join(',')] = true; });

/* the same reading loadJSON() gives a file of this age: no `colors`, so a cell is Accent where
   accent_mask says X and Main everywhere else, and an empty cell carries Main */
function toGrid(frame) {
  const g = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const sx = x - OX, sy = y - OY;
      let ch = (frame.glyphs[sy] && frame.glyphs[sy][sx]) || ' ';
      if (blank[x + ',' + y]) ch = ' ';
      const acc = frame.accent_mask && frame.accent_mask[sy] && frame.accent_mask[sy][sx] === 'X';
      row.push({ g: ch, l: ch !== ' ' && acc ? 'a' : 'b' });
    }
    g.push(row);
  }
  return g;
}

module.exports = {
  state: {
    v: 1, active: 0,
    docs: [{
      name: sprite.id, id: sprite.id, w: W, h: H,
      /* body and accent from the file; Detail and Extra are what the dark theme hands a legacy file */
      palette: [
        { k: 'b', name: 'Main',   color: sprite.body_color },
        { k: 'a', name: 'Accent', color: sprite.accent_color },
        { k: 'd', name: 'Detail', color: '#CBB042' },
        { k: 'e', name: 'Extra',  color: '#EDEDED' },
      ],
      bgOn: false, bgColor: '#808080',
      /* the Custom row stocks itself from what gets drawn: this is nox's own history */
      custom: ['▝', '▘', '@', '▀', '█', '╭', '▔', '╮', '▙', '▗', '▖', '▟'],
      lock: [],
      frames: sprite.frames.map(toGrid), active: 0, fps: sprite.fps || 8,
    }],
  },

  async setup(page) {
    await page.click('[data-zoom="1"]');    /* one step in: nox reads better, and the taller stage fills the frame */
    await page.mouse.move(760, 300);
    await page.waitForTimeout(250);
  },

  /* the stage, the Paint bar and the Custom row, with the tool rows above and the glyph rows
     below just out of frame: the scroll sits midway between the two positions that hide them */
  scrollTo: (viewH) => {
    const y = el => el.getBoundingClientRect().top + window.scrollY;
    const lo = y(document.querySelector('.bars')) + document.querySelector('.bars').getBoundingClientRect().height;
    const hi = y(document.querySelectorAll('.pgroup')[1]) - viewH;
    return Math.round((lo + hi) / 2);
  },

  timeline({ cell, geo }) {
    /* empty stage to the right of the grid, clear of the grid's resize handles */
    const rest = { x: geo.grid.left + geo.grid.w + 170, y: geo.grid.top + geo.grid.h * 0.45 };
    const empty = cell(W - 1, 0);
    const keys = [{ t: 0.0, ...rest }, { t: 1.0, ...rest }];
    /* one beat per missing mark: go to its source, sample, go to its place, put it down.
       The same source twice (the foot) is sampled once and used twice. */
    let t = 1.0, lastFrom = null;
    MISSING.forEach(m => {
      const from = cell(m.from[0], m.from[1]), at = cell(m.at[0], m.at[1]);
      if (m.from.join() !== lastFrom) {
        t += 0.9; keys.push({ t, ...from }, { t, ...from, event: 'rclick' });
        t += 0.6; keys.push({ t, ...from });
        lastFrom = m.from.join();
      }
      t += 0.8; keys.push({ t, ...at }, { t, ...at, event: 'click' });
      t += 0.4; keys.push({ t, ...at });
    });
    /* and an empty cell hands back the eraser */
    t += 0.9; keys.push({ t, ...empty }, { t, ...empty, event: 'rclick' });
    t += 0.8; keys.push({ t, ...empty });
    t += 1.0; keys.push({ t, ...rest });
    t += 1.0; keys.push({ t, ...rest });
    return keys;
  },
};
