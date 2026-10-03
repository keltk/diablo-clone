'use strict';
// Responsive layout: canvas sizing (CSS px / devicePixelRatio / logical units), HUD button positions, inventory panel.
// Plain script (no modules): shares globals with the other files in js/.

// The canvas always fills the window. Logical size W x H = window size / VZ, so VZ is "CSS px per logical px".
// The backing store is window size * DPR; render() sets the transform from logical -> backing pixels.
let VZ = 1, DPR = 1;
const HUD = { s: 1, B: 70, R: 44, buttons: [], top: 0, statsS: 1, mapY: 0, hudTop: 0 };
const PANEL = { x: 0, y: 0, s: 1, w: 540, h: 500 };    // inventory panel: local coords are 540 x 500, drawn scaled by s

function resize() {
  const iw = window.innerWidth, ih = window.innerHeight;
  VZ = clamp(Math.min(iw / 900, ih / 560), 0.8, 1.25);
  VZ = Math.min(VZ, iw / 480, ih / 430);                      // keep a minimum logical size on tiny screens
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = Math.max(1, Math.round(iw / VZ)); H = Math.max(1, Math.round(ih / VZ));
  cv.style.width = iw + 'px'; cv.style.height = ih + 'px';
  cv.width = Math.round(iw * DPR); cv.height = Math.round(ih * DPR);
  makeVignette();
  layoutHUD();
}

function layoutHUD() {
  // Compact HUD. Two mirrored 2x2 button blocks sit in the bottom corners: skill slots on the right, menu buttons
  // (Bag / Skills / Portal / Pause) on the left. The health / mana orbs double as potion buttons: touch and narrow
  // layouts stack them on top of their block (center of the screen stays clear); wide desktop windows put them bottom-center.
  const s = Math.max(1, 0.95 / VZ);                  // text/panel scale so the HUD stays readable on small screens
  const m = 12, gap = 8;
  HUD.s = s;
  HUD.statsS = Math.min(s, (W - 142 - 24) / 250);
  HUD.mapBottom = 8 + (MH * 2 + 12);
  HUD.topZone = Math.max(10 + 92 * HUD.statsS, HUD.mapBottom) + 8;   // y below the stats panel / minimap
  let B = Math.round(Math.max(54, 52 / VZ));         // button diameter => >= ~52 CSS px, plus a 6px hit margin (see buttonAt)
  const orbK = 0.78;                                 // orb radius / B  (orb diameter stays inside the 2-button block width)
  const wide = !touchDevice && W > H && W >= 4 * B + 4 * Math.round(B * orbK) + 2 * m + 5 * gap + 40;
  if (!wide) B = Math.max(46, Math.min(B, Math.floor((H - m - HUD.topZone - 3 * gap) / (2 + 2 * orbK))));   // short screens: shrink so the stacks clear the stats/minimap
  const R = Math.round(B * orbK);
  HUD.B = B; HUD.R = R;
  const btn = (id, x, y, r, label, col, key, extra) => Object.assign({ id, x, y, r, label, col, key, pressT: 0 }, extra);
  const by = H - m - B / 2, by2 = by - B - gap;                       // bottom / top row centers
  const rx = W - m - B / 2, rx2 = rx - B - gap;                       // right column centers (slot 1 = thumb corner)
  const lx = m + B / 2, lx2 = lx + B + gap;                           // left column centers (mirror image)
  const bs = [
    btn('slot0', rx, by, B / 2, '', '#444', '1'), btn('slot1', rx2, by, B / 2, '', '#444', '2'),
    btn('slot2', rx, by2, B / 2, '', '#444', '3'), btn('slot3', rx2, by2, B / 2, '', '#444', '4'),
    btn('inv', lx, by, B / 2, 'Bag', '#d6b04a', 'I'), btn('skills', lx2, by, B / 2, 'Skills', '#b078ff', 'T'),
    btn('tp', lx, by2, B / 2, 'Portal', '#3ac8d8', 'G'), btn('pause', lx2, by2, B / 2, 'Pause', '#8a8f9c', 'P')
  ];
  let top = by2 - B / 2;                                              // top edge of the button blocks
  let hpO, mpO;
  if (wide) {               // orbs between the two blocks, bottom-center
    hpO = { x: W / 2 - R - 8, y: H - m - R }; mpO = { x: W / 2 + R + 8, y: H - m - R };
  } else {                  // orbs sit on top of their block: health above the menu buttons, mana above the skill slots
    const oy = top - gap - R;
    hpO = { x: m + B + gap / 2, y: oy }; mpO = { x: W - m - B - gap / 2, y: oy };
    top = oy - R;
  }
  bs.push(btn('hp', hpO.x, hpO.y, R, 'HP', '#d62c2c', 'Q', { orb: true }));
  bs.push(btn('mp', mpO.x, mpO.y, R, 'MP', '#2c5ad6', 'W', { orb: true }));
  HUD.orbs = [hpO, mpO];
  HUD.buttons = bs;
  const free = W - 2 * (m + 2 * B + gap) - 2 * gap;                    // free width between the two blocks
  if (!wide && free >= 340) { HUD.hudTop = H - m; HUD.hintW = free; }   // roomy (landscape): hints tuck into the bottom-center gap
  else { HUD.hudTop = top - gap; HUD.hintW = W - 24; }                  // otherwise above the blocks

  // inventory panel (local 540 x 500, scaled so slots are >= ~50 CSS px, but always fully on screen)
  let ps = clamp(52 / (68 * VZ), 1, 1.5);
  ps = Math.min(ps, (W - 12) / PANEL.w, (H - 12) / PANEL.h);
  PANEL.s = ps; PANEL.x = Math.round((W - PANEL.w * ps) / 2); PANEL.y = Math.round((H - PANEL.h * ps) / 2);
  layoutTree();
}

function buttonAt(x, y) {
  for (const b of HUD.buttons) if (dist(x, y, b.x, b.y) <= b.r + 6) return b;
  return null;
}

// ---- inventory panel geometry, in panel-local coordinates ----
const SLOT_EQUIP = { weapon: { x: 30, y: 80, w: 64, h: 64 }, armor: { x: 30, y: 190, w: 64, h: 64 } };
const BTN_CLOSE = { x: 490, y: 6, w: 44, h: 44 };
const BTN_EQUIP = { x: 320, y: 398, w: 200, h: 44 };
const BTN_SELL = { x: 320, y: 448, w: 200, h: 44 };
function invSlot(i) { return { x: 190 + (i % 4) * 78, y: 70 + Math.floor(i / 4) * 78, w: 68, h: 68 }; }
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
const toPanel = (x, y) => ({ x: (x - PANEL.x) / PANEL.s, y: (y - PANEL.y) / PANEL.s });
const inPanel = (x, y) => { const p = toPanel(x, y); return inRect({ x: 0, y: 0, w: PANEL.w, h: PANEL.h }, p.x, p.y); };
