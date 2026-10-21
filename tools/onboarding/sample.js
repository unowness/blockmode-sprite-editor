/* Onboarding page 3, "Pick up what is already there": the right button samples a cell.

   Three beats on nox (tools/onboarding/nox_idle.json, one of the product's own sprites). Sample an
   eye and give nox two buttons with what comes back; sample the head and draw a ground with it;
   sample an empty cell - which hands back the eraser - and take the ground away again. Each sample
   is answered on screen by the Paint bar, the Custom row and the Eraser button, which is the whole
   point of the page.

       node tools/onboarding/record.js tools/onboarding/sample.js --out assets/onboarding/onboarding_3.gif */
'use strict';
const fs = require('fs');
const path = require('path');

/* nox is 8x6; it goes on a 10x9 canvas with a cell to spare on each side, two rows of air over
   the ears and the bottom row free, so the ground gets a row of its own under the feet and there
   is an empty cell to sample. Nine rows rather than eight because the frame is 648 CSS px tall:
   with a shorter stage the row above it or the glyph row below it shows a sliver at the edge. */
const sprite = JSON.parse(fs.readFileSync(path.join(__dirname, 'nox_idle.json'), 'utf8'));
const W = 10, H = 9, OX = 1, OY = 2;

/* the same reading loadJSON() gives a file of this age: no `colors`, so a cell is Accent where
   accent_mask says X and Main everywhere else, and an empty cell carries Main */
function toGrid(frame) {
  const g = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const sx = x - OX, sy = y - OY;
      const ch = (frame.glyphs[sy] && frame.glyphs[sy][sx]) || ' ';
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
    await page.click('#mirror');            /* Mirror starts on; off, so a stroke lands where the cursor is */
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
    const eye = cell(OX + 1, OY + 3), head = cell(OX + 3, OY + 1), empty = cell(W - 1, 0);
    const buttonA = cell(OX + 3, OY + 4), buttonB = cell(OX + 4, OY + 4);
    const groundA = cell(2, H - 1), groundB = cell(7, H - 1);
    return [
      { t: 0.0, ...rest },
      { t: 1.0, ...rest },
      { t: 2.2, ...eye },
      { t: 2.2, ...eye, event: 'rclick' },      /* brush = @ in Accent */
      { t: 3.0, ...eye },
      { t: 4.0, ...buttonA },
      { t: 4.0, ...buttonA, event: 'down' },
      { t: 4.8, ...buttonB },
      { t: 4.8, ...buttonB, event: 'up' },
      { t: 5.4, ...buttonB },
      { t: 6.4, ...head },
      { t: 6.4, ...head, event: 'rclick' },     /* brush = █ in Main */
      { t: 7.1, ...head },
      { t: 8.0, ...groundA },
      { t: 8.0, ...groundA, event: 'down' },
      { t: 9.4, ...groundB },
      { t: 9.4, ...groundB, event: 'up' },
      { t: 10.0, ...groundB },
      { t: 10.9, ...empty },
      { t: 10.9, ...empty, event: 'rclick' },   /* brush = blank: the Eraser lights up */
      { t: 11.7, ...empty },
      { t: 12.6, ...groundB },
      { t: 12.6, ...groundB, event: 'down' },
      { t: 14.0, ...groundA },
      { t: 14.0, ...groundA, event: 'up' },
      { t: 14.6, ...groundA },
      { t: 15.4, ...rest },
      { t: 16.4, ...rest },
    ];
  },
};
