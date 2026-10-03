'use strict';
// Inventory panel geometry/clicks and mouse/keyboard input.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  INVENTORY UI (geometry shared by input + render)
// ===================================================================
const PANEL = { x: W / 2 - 270, y: 80, w: 540, h: 400 };
const slotRect = {
  weapon: { x: PANEL.x + 30, y: PANEL.y + 80, w: 64, h: 64 },
  armor:  { x: PANEL.x + 30, y: PANEL.y + 190, w: 64, h: 64 }
};
function invRect(i) { return { x: PANEL.x + 190 + (i % 4) * 78, y: PANEL.y + 70 + Math.floor(i / 4) * 78, w: 68, h: 68 }; }
const inRect = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

function invHover() {                 // -> {kind:'inv'|'equip', i|slot, item}
  if (!invOpen) return null;
  for (let i = 0; i < P.inv.length; i++) if (inRect(invRect(i), mouse.x, mouse.y)) return { kind: 'inv', i, item: P.inv[i] };
  for (const s of ['weapon', 'armor']) if (P[s] && inRect(slotRect[s], mouse.x, mouse.y)) return { kind: 'equip', slot: s, item: P[s] };
  return null;
}

function invClick(button) {           // returns true if the click was consumed by the panel
  if (!invOpen || !inRect(PANEL, mouse.x, mouse.y)) return false;
  const h = invHover();
  if (!h) return true;
  if (h.kind === 'inv') {
    if (button === 2) { P.gold += h.item.value; addText(P.x, P.y, '+' + h.item.value + ' gold', '#f5c518', 13); P.inv.splice(h.i, 1); }
    else {
      const it = h.item, old = P[it.slot];
      P[it.slot] = it; P.inv.splice(h.i, 1);
      if (old) P.inv.push(old);
      recalc();
    }
  } else if (button !== 2 && P.inv.length < INV_SIZE) {
    P.inv.push(h.item); P[h.slot] = null; recalc();
  }
  return true;
}

// ===================================================================
//  INPUT
// ===================================================================
function setMouse(ev) {
  const r = cv.getBoundingClientRect();
  mouse.x = (ev.clientX - r.left) * (W / r.width);
  mouse.y = (ev.clientY - r.top) * (H / r.height);
  updateMouseWorld();
}
cv.addEventListener('contextmenu', ev => ev.preventDefault());
cv.addEventListener('mousemove', setMouse);
cv.addEventListener('mousedown', ev => {
  setMouse(ev);
  if (P.dead || paused) return;
  if (invClick(ev.button)) return;
  if (ev.button !== 0) return;
  mouse.down = true; P.repathT = 0;
  const e = enemyAt(mouse.x, mouse.y);
  if (e) { mouse.mode = 'attack'; P.target = e; P.pickup = null; return; }
  const g = groundAt(mouse.x, mouse.y);
  if (g) { mouse.mode = 'pickup'; P.pickup = g; P.target = null; return; }
  mouse.mode = 'move'; P.target = null; P.pickup = null;
});
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('blur', () => { mouse.down = false; });
window.addEventListener('keydown', ev => {
  if (ev.repeat) return;
  switch (ev.code) {
    case 'Digit1': case 'Numpad1': castFireball(); break;
    case 'Digit2': case 'Numpad2': castNova(); break;
    case 'KeyQ': usePotion('hp'); break;
    case 'KeyW': usePotion('mp'); break;
    case 'KeyI': if (!P.dead) invOpen = !invOpen; break;
    case 'Escape': invOpen = false; break;
    case 'KeyP': if (!P.dead) paused = !paused; break;
    case 'KeyR': if (P.dead) newRun(); break;
  }
});
function resize() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', resize);
