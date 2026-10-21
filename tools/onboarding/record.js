#!/usr/bin/env node
/* Record an onboarding GIF from a scenario.

   The editor is driven with real mouse events through Playwright, a cursor is drawn over the
   page, and one frame is captured per 1/30 s of the scenario's timeline. The frames are then
   assembled into a GIF with ffmpeg. Capture is not real time - a frame takes as long as it takes
   to screenshot - so the result is deterministic and the same scenario gives the same GIF.

   Geometry matches the recordings already in assets/onboarding: 1184x738, from a 1040x648 CSS
   viewport at 1.138x (the originals are Retina recordings of a ~1000px-wide window scaled to
   1184). 1040 is the narrowest window that shows the full desktop layout: the content is 960
   wide there, which is the width the Custom row needs to hold its 20 cells on one line.

       node tools/onboarding/record.js tools/onboarding/sample.js --out assets/onboarding/onboarding_3.gif
       node tools/onboarding/record.js tools/onboarding/sample.js --still still.png    # first frame only

   Needs: playwright (npm i -g playwright && npx playwright install chromium) and ffmpeg.
   CHROMIUM_PATH=/path/to/chromium overrides the browser Playwright would use.

   A scenario module exports:
     state          the sprite to put on the canvas, in the editor's localStorage format (v:1)
     setup(page)    optional - real clicks on the controls before the first frame (toggle Mirror, ...)
     scrollTo(h)    runs in the page, h is the viewport height; returns the scrollY that frames the shot
     timeline(g)    keyframes [{t, x, y, event?}] in viewport CSS px, sorted by t. The cursor eases
                    between them; an event ('rclick' | 'click' | 'down' | 'up') fires at its t.
                    g.cell(x,y) gives a grid cell's centre, g.geo the stage/paint/custom boxes. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const FPS = 30;
const VIEW = { width: 1040, height: 648 }, DPR = 1184 / 1040;   /* -> 1184x738 */

/* ---- arguments ---- */
const argv = process.argv.slice(2), opts = {};
let scenarioPath = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out' || a === '--still' || a === '--page' || a === '--frames') opts[a] = argv[++i];
  else if (a.startsWith('--')) { console.error('unknown option ' + a); process.exit(2); }
  else scenarioPath = a;
}
if (!scenarioPath || !(opts['--out'] || opts['--still'])) {
  console.error('usage: node tools/onboarding/record.js <scenario.js> (--out file.gif | --still frame.png) [--page index.html] [--frames dir]');
  process.exit(2);
}
const OUT = opts['--out'] || null;
const STILL = opts['--still'] || null;
const PAGE = opts['--page'] || 'index.html';
const FRAMES = opts['--frames'] || null;
const scenario = require(path.resolve(scenarioPath));

/* ---- playwright: a local install, else the global one ---- */
function loadPlaywright() {
  try { return require('playwright'); } catch (e) {}
  try { const g = execFileSync('npm', ['root', '-g']).toString().trim(); return require(path.join(g, 'playwright')); } catch (e) {}
  throw new Error('playwright not found - npm i -g playwright && npx playwright install chromium');
}

/* ---- a static server for the repository root: the editor keeps its state in localStorage,
        which wants a real origin rather than file:// ---- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
                '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const p = path.normalize(decodeURIComponent(req.url.split('?')[0]));
      const file = path.join(ROOT, p === '/' ? 'index.html' : p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ---- the cursor drawn over the page: macOS-style arrow with the hotspot at its tip, a crosshair
        over the canvas (where the editor's own cursor is one), and a ring that marks a right-click ---- */
const CURSOR_CSS = `
#__cur{position:fixed;left:0;top:0;z-index:99999;pointer-events:none;width:24px;height:24px;}
#__cur svg{position:absolute;left:0;top:0;display:none;}
#__cur.arrow svg.arrow{display:block;}
#__cur.cross svg.cross{display:block;}
#__pulse{position:fixed;z-index:99998;pointer-events:none;border:2px solid var(--accent,#5BD9F5);border-radius:50%;
  width:28px;height:28px;margin:-14px 0 0 -14px;display:none;}`;
const CURSOR_HTML = `
<svg class="arrow" width="18" height="24" viewBox="0 0 18 24"><path d="M1 1 L1 18.5 L5.4 14.4 L8.3 21.4 L11.4 20.1 L8.6 13.3 L14.6 13.3 Z" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
<svg class="cross" width="24" height="24" viewBox="0 0 24 24" style="left:-12px;top:-12px"><path d="M12 2.5V9.5M12 14.5V21.5M2.5 12H9.5M14.5 12H21.5" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M12 2.5V9.5M12 14.5V21.5M2.5 12H9.5M14.5 12H21.5" stroke="#000" stroke-width="1.4" stroke-linecap="round"/></svg>`;

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   /* easeInOutCubic */

(async () => {
  const { chromium } = loadPlaywright();
  const srv = await serve();
  const url = 'http://127.0.0.1:' + srv.address().port + '/' + PAGE;
  const framesDir = FRAMES || fs.mkdtempSync(path.join(os.tmpdir(), 'blockmode-onboarding-'));
  fs.mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, headless: true });
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR, colorScheme: 'dark' });
  /* the recorded session: dark theme, onboarding and hints already dismissed, the scenario's sprite
     on the canvas. The lab's keys are set as well so --page lab.html records the same way. */
  await ctx.addInitScript((st) => {
    try {
      ['blockmode:', 'blockmode:lab:'].forEach(function (ns) {
        localStorage.setItem(ns + 'theme', 'dark');
        localStorage.setItem(ns + 'onboarded', '1');
        localStorage.setItem(ns + 'hints', 'hintsave,hintdraw,hint');
        localStorage.setItem(ns + 'v1', JSON.stringify(st));
      });
    } catch (e) {}
  }, scenario.state);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  if (scenario.setup) await scenario.setup(page);

  await page.evaluate(({ css, html }) => {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const cur = document.createElement('div'); cur.id = '__cur'; cur.className = 'arrow'; cur.innerHTML = html; document.body.appendChild(cur);
    const pulse = document.createElement('div'); pulse.id = '__pulse'; document.body.appendChild(pulse);
  }, { css: CURSOR_CSS, html: CURSOR_HTML });

  const scrollY = await page.evaluate(scenario.scrollTo, VIEW.height);
  await page.evaluate(y => window.scrollTo(0, y), scrollY);
  await page.waitForTimeout(100);

  /* viewport-space geometry for the timeline, measured after the scroll */
  const geo = await page.evaluate(() => {
    const cells = {};
    document.querySelectorAll('#grid .cell').forEach(c => {
      const b = c.getBoundingClientRect();
      cells[c.dataset.x + ',' + c.dataset.y] = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    });
    const r = s => { const el = document.querySelector(s); if (!el) return null; const b = el.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2, left: b.left, top: b.top, w: b.width, h: b.height }; };
    return { cells, grid: r('#grid'), stage: r('.stage'), erase: r('#erase'), select: r('#select'), mirror: r('#mirror'),
             filled: r('#filled'), paints: r('#paints'), custom: r('#customgroup') };
  });
  const cell = (x, y) => { const c = geo.cells[x + ',' + y]; if (!c) throw new Error('no cell ' + x + ',' + y); return c; };

  const timeline = scenario.timeline({ cell, geo });
  const total = timeline[timeline.length - 1].t;
  const N = STILL ? 1 : Math.round(total * FPS) + 1;

  function posAt(t) {
    let a = timeline[0], b = timeline[0];
    for (let i = 0; i < timeline.length; i++) { if (timeline[i].t <= t) a = timeline[i]; if (timeline[i].t >= t) { b = timeline[i]; break; } }
    if (a === b || b.t === a.t) return { x: a.x, y: a.y };
    const k = ease((t - a.t) / (b.t - a.t));
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }
  const events = timeline.filter(k => k.event);
  let evIdx = 0, pulseStart = -1;

  console.log('recording ' + N + ' frames (' + total.toFixed(1) + 's) from ' + url);
  for (let f = 0; f < N; f++) {
    const t = f / FPS, p = posAt(t);
    await page.mouse.move(p.x, p.y);
    while (evIdx < events.length && events[evIdx].t <= t + 1e-9) {
      const e = events[evIdx++];
      if (e.event === 'rclick') { await page.mouse.click(p.x, p.y, { button: 'right' }); pulseStart = t; }
      else if (e.event === 'click') await page.mouse.click(p.x, p.y);
      else if (e.event === 'down') await page.mouse.down();
      else if (e.event === 'up') await page.mouse.up();
    }
    const pulseAge = pulseStart >= 0 ? t - pulseStart : -1;
    await page.evaluate(({ x, y, pulseAge }) => {
      const cur = document.getElementById('__cur');
      cur.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      const el = document.elementFromPoint(x, y);
      cur.className = el && el.closest && el.closest('#grid') ? 'cross' : 'arrow';
      const pulse = document.getElementById('__pulse'), D = 0.4;
      if (pulseAge >= 0 && pulseAge < D) {
        const k = pulseAge / D;
        pulse.style.display = 'block'; pulse.style.left = x + 'px'; pulse.style.top = y + 'px';
        pulse.style.transform = 'scale(' + (0.35 + 0.65 * k) + ')'; pulse.style.opacity = String(1 - k * k);
      } else pulse.style.display = 'none';
    }, { x: p.x, y: p.y, pulseAge });
    await page.screenshot({ path: path.join(framesDir, 'f_' + String(f).padStart(4, '0') + '.png') });
    if (f && f % 90 === 0) console.log('  ' + f + '/' + N);
  }
  await browser.close();
  srv.close();

  if (STILL) { fs.copyFileSync(path.join(framesDir, 'f_0000.png'), STILL); console.log('wrote ' + STILL); }
  if (OUT) {
    /* one 256-colour palette for the whole clip and no dithering: the UI is flat colour, and
       dither noise is what makes a GIF of it both ugly and large */
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(framesDir, 'f_%04d.png'),
      '-filter_complex', '[0:v]split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      '-loop', '0', OUT], { stdio: 'inherit' });
    if (r.status !== 0) { console.error('ffmpeg failed (frames kept in ' + framesDir + ')'); process.exit(1); }
    console.log('wrote ' + OUT + ' (' + Math.round(fs.statSync(OUT).size / 1024) + ' KB)');
  }
  if (!FRAMES) fs.rmSync(framesDir, { recursive: true, force: true });
  else console.log('frames in ' + framesDir);
})().catch(e => { console.error(e); process.exit(1); });
