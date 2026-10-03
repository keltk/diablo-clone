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
  const s = Math.max(1, 0.95 / VZ);                  // text/panel scale so the HUD stays readable on small screens
  const B = Math.round(Math.max(64, 60 / VZ));       // big button diameter => >= ~60 CSS px (thumb friendly)
  const R = Math.round(B * 0.6);                     // orb radius
  const m = 14, gap = 10, sb = Math.round(B * 0.72); // margin, gap, small-button diameter
  HUD.s = s; HUD.B = B; HUD.R = R;
  HUD.statsS = Math.min(s, (W - 142 - 24) / 250);
  const by = H - m - B / 2, by2 = by - B - gap;
  const btn = (id, x, y, r, label, col, key) => ({ id, x, y, r, label, col, key, pressT: 0 });
  const rx = W - m - B / 2, rx2 = W - m - B - gap - B / 2;
  const bs = [                                   // skill bar: 2x2 block bottom-right (slot 1 = thumb corner)
    btn('slot0', rx, by, B / 2, '', '#444', '1'), btn('slot1', rx2, by, B / 2, '', '#444', '2'),
    btn('slot2', rx, by2, B / 2, '', '#444', '3'), btn('slot3', rx2, by2, B / 2, '', '#444', '4'),
    btn('hp', m + B / 2, by, B / 2, 'HP', '#d62c2c', 'Q'),
    btn('mp', m + B + gap + B / 2, by, B / 2, 'MP', '#2c5ad6', 'W')
  ];
  let leftTop = H - m - B, rightTop = H - m - 2 * B - gap;
  const wide = W >= 4 * B + 4 * R + 2 * m + 4 * gap + 40;
  if (wide) {               // orbs sit between the two button clusters
    HUD.orbs = [{ x: W / 2 - R - 8, y: H - m - R }, { x: W / 2 + R + 8, y: H - m - R }];
  } else {                  // narrow screens: orbs stack above the button clusters
    leftTop -= gap + 2 * R; rightTop -= gap + 2 * R;
    HUD.orbs = [{ x: m + R, y: leftTop + R }, { x: W - m - R, y: rightTop + R }];
  }
  const sy = leftTop - gap - sb / 2;              // small menu buttons: Pause / Bag / Skills in a row above the left cluster
  bs.push(btn('pause', m + sb / 2, sy, sb / 2, 'Pause', '#8a8f9c', 'P'));
  bs.push(btn('inv', m + sb * 1.5 + gap, sy, sb / 2, 'Bag', '#d6b04a', 'I'));
  bs.push(btn('skills', m + sb * 2.5 + 2 * gap, sy, sb / 2, 'Skills', '#b078ff', 'T'));
  bs.push(btn('tp', m + sb * 3.5 + 3 * gap, sy, sb / 2, 'Portal', '#3ac8d8', 'G'));
  HUD.buttons = bs;
  HUD.hudTop = Math.min(leftTop - gap - sb, rightTop) - gap;
  HUD.mapBottom = 8 + (MH * 2 + 12);
  HUD.topZone = Math.max(10 + 92 * HUD.statsS, HUD.mapBottom) + 8;   // y below the stats panel / minimap

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
