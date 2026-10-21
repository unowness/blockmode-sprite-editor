/* Onboarding page 3, "Pick up what is already there": the right button samples a cell.

   Three beats on one sprite. Sample an eye and paint a belt with what comes back; sample the mouth
   and draw a ground with it; sample an empty cell - which hands back the eraser - and take the
   ground away again. Each sample is answered on screen by the Paint bar, the Custom row and the
   Eraser button, which is the whole point of the page.

       node tools/onboarding/record.js tools/onboarding/sample.js --out assets/onboarding/onboarding_3.gif */
'use strict';

/* echo_idle, 10x8. Body in Main, eyes in Accent, mouth in Detail; row 7 is left for the ground. */
const ROWS = [
  '..▗▄▄▄▄▖..',
  '..█◉██◉█..',
  '.▐██▀▀██▌.',
  '..█~~~~█..',
  '..▀████▀..',
  '...▌..▐...',
  '..▗▟..▙▖..',
  '..........',
];
const LAYER = { '◉': 'a', '~': 'd' };   /* everything else is 'b', Main */
const grid = ROWS.map(row => Array.from(row).map(ch => ch === '.' ? { g: ' ', l: 'b' } : { g: ch, l: LAYER[ch] || 'b' }));

module.exports = {
  state: {
    v: 1, active: 0,
    docs: [{
      name: 'echo_idle', id: 'echo_idle', w: 10, h: ROWS.length,
      palette: [
        { k: 'b', name: 'Main',   color: '#E6E6DF' },
        { k: 'a', name: 'Accent', color: '#E490D2' },
        { k: 'd', name: 'Detail', color: '#F2B544' },
        { k: 'e', name: 'Extra',  color: '#5BD9F5' },
      ],
      bgOn: false, bgColor: '#808080',
      /* the Custom row stocks itself from what gets drawn: this is the sprite's own history */
      custom: ['▙', '▟', '~', '▌', '▐', '▀', '◉', '█', '▖', '▄', '▗'],
      lock: [],
      frames: [grid], active: 0, fps: 8,
    }],
  },

  async setup(page) {
    await page.click('#mirror');            /* Mirror starts on; off, so a stroke lands where the cursor is */
    await page.mouse.move(740, 290);
    await page.waitForTimeout(250);
  },

  /* frame the stage through the Custom row, centred in the viewport */
  scrollTo: () => {
    const top = document.querySelector('.stage').getBoundingClientRect().top + window.scrollY;
    const bottom = document.getElementById('customgroup').getBoundingClientRect().bottom + window.scrollY;
    return Math.round(top - (615 - (bottom - top)) / 2);
  },

  timeline({ cell }) {
    const rest = { x: 740, y: 290 };        /* empty stage, clear of the grid's resize handles */
    const eye = cell(3, 1), mouth = cell(4, 3), empty = cell(9, 0);
    const beltA = cell(3, 4), beltB = cell(6, 4);
    const groundA = cell(1, 7), groundB = cell(8, 7);
    return [
      { t: 0.0, ...rest },
      { t: 1.0, ...rest },
      { t: 2.2, ...eye },
      { t: 2.2, ...eye, event: 'rclick' },      /* brush = ◉ in Accent */
      { t: 3.0, ...eye },
      { t: 4.0, ...beltA },
      { t: 4.0, ...beltA, event: 'down' },
      { t: 5.2, ...beltB },
      { t: 5.2, ...beltB, event: 'up' },
      { t: 5.8, ...beltB },
      { t: 6.8, ...mouth },
      { t: 6.8, ...mouth, event: 'rclick' },    /* brush = ~ in Detail */
      { t: 7.5, ...mouth },
      { t: 8.4, ...groundA },
      { t: 8.4, ...groundA, event: 'down' },
      { t: 9.9, ...groundB },
      { t: 9.9, ...groundB, event: 'up' },
      { t: 10.5, ...groundB },
      { t: 11.4, ...empty },
      { t: 11.4, ...empty, event: 'rclick' },   /* brush = blank: the Eraser lights up */
      { t: 12.2, ...empty },
      { t: 13.1, ...groundB },
      { t: 13.1, ...groundB, event: 'down' },
      { t: 14.6, ...groundA },
      { t: 14.6, ...groundA, event: 'up' },
      { t: 15.2, ...groundA },
      { t: 16.0, ...rest },
      { t: 17.0, ...rest },
    ];
  },
};
