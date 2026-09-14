# Blockmode — ASCII Sprite Editor

A tiny, dependency-free editor for block-ASCII sprites — the kind used in
terminal / PETSCII / C64-style games. Draw with block and box-drawing glyphs in
up to 16 paints over an optional background, animate them frame by frame, and
export to JSON, SVG, PNG, MP4 or plain text.

**Live:** https://blockmode.app

It is one self-contained HTML file with no build step and no backend — copy
`index.html` anywhere and open it in a browser.

## Drawing

- Pick a **glyph** from the palette and a **paint** (Main, Accent, Detail, Extra,
  plus any you add), then draw on the grid with the left button. The **Eraser**
  tool clears cells on any device; right-click is the eyedropper, not an eraser
  (see Sampling below).
- **Custom panel** — 20 slots for glyphs you use often. Select a glyph in the
  palette, then click an empty slot to store it there. Click a filled slot to
  draw with it; **Backspace** clears it. Pasting or typing into a slot also works.
- **Mirror** keeps the left and right halves symmetric as you paint.
- **Eraser** and **Select** (drag a rectangle, then move it or press Delete).
- **Undo/redo** per sprite: buttons or Ctrl/Cmd+Z.
- **Background** toggles the backdrop color; **Grid** toggles the cell overlay.
  Both are included in an export if they are active at export time.

## Canvas and animation

- Size from 3×3 to 128×128 — type into **W/H**, or drag any of the four edge
  handles to resize from that side.
- **Zoom in / Zoom out** step the drawing's cell size.
- Export **scale** presets: 1×, 4×, 8×, 16× — disabled for JSON and TXT, which carry no picture.
- **Paints** — four to start (Main, Accent, Detail, Extra); **+** adds more, up to 16 per sprite.
  Each cell remembers its paint, so recoloring is one swatch, not a repaint.
- **Sampling** — right-click (or Alt+click, or hold on touch) picks up a cell's glyph and paint.
  Sampling an empty cell gives you an eraser.
- **Theme** — light and dark, toggled from the header corner and remembered.
- **Frames** — up to 60 per sprite; set **FPS** (1–60) and play the loop.
- **Fullscreen** renders the sprite 1:1 with the paint and custom panels docked
  at the bottom.

## Interface

- **Tabs** — several sprites open at once, each with its own undo history.
- **Autosave** — every open tab is written to `localStorage` and restored on the
  next visit. Nothing is sent anywhere; there is no backend.
- Works with touch: drag to paint, and the resize handles stay visible on
  coarse-pointer devices.

## Export

| Format | What you get |
| --- | --- |
| **JSON** | The full sprite, all frames — download or copy. Load it back to keep editing. |
| **SVG** | Current frame, vector. |
| **PNG** | Current frame, upscaled by the current zoom. |
| **MP4** | The animation loop (~2s), encoded with WebCodecs (H.264). |
| **TXT** | Current frame as the characters it is made of, trailing blanks trimmed. |

MP4 needs WebCodecs — available in Chromium browsers and Safari 16.4+. Where it
is missing (Firefox today), the editor falls back to a WebM recording.

## Sprite JSON format

```json
{
  "version": 4,
  "id": "sprite",
  "width": 8,
  "height": 6,
  "palette": [
    { "key": "b", "name": "Main",   "color": "#0057F0" },
    { "key": "a", "name": "Accent", "color": "#F05940" },
    { "key": "d", "name": "Detail", "color": "#8BBF05" },
    { "key": "e", "name": "Extra",  "color": "#141414" }
  ],
  "body_color": "#0057F0",
  "accent_color": "#F05940",
  "decoration_color": "#8BBF05",
  "extra_color": "#141414",
  "background_color": null,
  "fps": 8,
  "active": 0,
  "custom_glyphs": ["▀", "▄"],
  "frames": [
    {
      "glyphs": ["row strings, one character per cell"],
      "colors": ["same dimensions; one palette key per cell, space where empty"],
      "accent_mask": ["same dimensions; 'X' where the cell uses the accent color"]
    }
  ],
  "glyphs": ["..."],
  "colors": ["..."],
  "accent_mask": ["..."]
}
```

- `palette` is the authoritative list of paints, in order. `key` is the single
  character `colors` uses for that paint: `b` `a` `d` `e` for the four every
  sprite starts with, then `1`–`9` and `A`–`C` for paints you add, 16 in all.
- `body_color` / `accent_color` / `decoration_color` / `extra_color` repeat the
  first four paints so a reader written for **version 3** still opens the file.
  It loses only the paints it could not have drawn anyway.
- `colors` says which paint each cell uses; a space means an empty cell.
- `background_color` is `null` when the background is switched off.
- `custom_glyphs` holds the custom panel, preserving slot positions
  (internal gaps stay as `""`, trailing empties are trimmed).
- The top-level `glyphs` / `colors` / `accent_mask` repeat the **active frame**
  so single-frame consumers can read a sprite without understanding `frames`.
- `accent_mask` predates the multi-paint model and is kept for readers that
  still expect it; `colors` is the field to trust.

Every glyph is a single-cell character — ASCII, Unicode Block Elements
(U+2580–U+259F) or Box Drawing (U+2500–U+257F) — so sprites render at a fixed
width in any terminal.

## Repository layout

```
index.html                 the editor — the whole product, no build step
lab.html                   the same editor with its own localStorage namespace,
                           no analytics and noindex, for layout experiments
assets/brand/              favicon and the light-theme wordmark mask
assets/onboarding/         the first-run walkthrough images
vendor/mp4-muxer.min.js    vendored WebCodecs MP4 muxer, loaded on first export
tools/make-lab.py          regenerate lab.html from index.html
tools/promote-lab.py       the inverse: ship lab.html as index.html
blockmode-opengraph.png    social preview; its URL is public, so it stays at the root
CNAME, .nojekyll           GitHub Pages, which serves this repository from the root
```

## License

MIT — see [LICENSE](LICENSE).
