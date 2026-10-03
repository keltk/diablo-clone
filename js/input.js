'use strict';
// Input: unified pointer events (touch + mouse + pen), HUD button actions, inventory panel taps, keyboard shortcuts.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  ACTIONS (shared by on-screen buttons and keyboard)
// ===================================================================
function toggleInventory() { if (!P.dead) { invOpen = !invOpen; invSel = null; } }
function togglePause() { if (P.dead || titleOpen) return; if (paused) closePause(); else openPause(); }
function pressButton(id) {
  switch (id) {
    case 'fire': castFireball(); break;
    case 'nova': castNova(); break;
    case 'hp': usePotion('hp'); break;
    case 'mp': usePotion('mp'); break;
    case 'inv': toggleInventory(); break;
    case 'pause': togglePause(); break;
  }
}

// ===================================================================
//  INVENTORY PANEL (tap to select -> detail area with Equip / Sell buttons)
// ===================================================================
let invSel = null;                       // { kind: 'inv'|'equip', item }

function equipFromInv(item) {
  const i = P.inv.indexOf(item); if (i < 0) return;
  const old = P[item.slot];
  P[item.slot] = item; P.inv.splice(i, 1);
  if (old) P.inv.push(old);
  recalc(); invSel = null;
}
function unequip(item) {
  if (P.inv.length >= INV_SIZE) { msg('Inventory full!'); return; }
  P.inv.push(item); P[item.slot] = null; recalc(); invSel = null;
}
function sellItem(item) {
  const i = P.inv.indexOf(item); if (i < 0) return;
  P.gold += item.value; P.inv.splice(i, 1);
  addText(P.x, P.y, '+' + item.value + ' gold', '#f5c518', 13);
  invSel = null;
}

// returns true if the press was consumed by the panel
function panelPress(x, y, button) {
  const p = toPanel(x, y);
  if (inRect(BTN_CLOSE, p.x, p.y)) { invOpen = false; invSel = null; return true; }
  for (let i = 0; i < P.inv.length; i++) {
    if (!inRect(invSlot(i), p.x, p.y)) continue;
    const it = P.inv[i];
    if (button === 2) sellItem(it);                                        // desktop bonus: right-click sells
    else if (invSel && invSel.item === it) equipFromInv(it);               // tap a selected item again: equip
    else invSel = { kind: 'inv', item: it };
    return true;
  }
  for (const s of ['weapon', 'armor']) {
    if (P[s] && inRect(SLOT_EQUIP[s], p.x, p.y)) {
      if (invSel && invSel.item === P[s]) unequip(P[s]); else invSel = { kind: 'equip', item: P[s] };
      return true;
    }
  }
  if (invSel) {
    if (inRect(BTN_EQUIP, p.x, p.y)) { if (invSel.kind === 'inv') equipFromInv(invSel.item); else unequip(invSel.item); return true; }
    if (invSel.kind === 'inv' && inRect(BTN_SELL, p.x, p.y)) { sellItem(invSel.item); return true; }
  }
  return true;
}

// ===================================================================
//  POINTER INPUT (one "move" pointer at a time; other fingers can tap buttons)
// ===================================================================
let movePtr = null;                      // pointerId currently steering the character

function pointerPos(ev) {
  const r = cv.getBoundingClientRect();    // CSS px -> logical px (handles any CSS size / zoom / DPR)
  return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) };
}
function setMouse(p) { mouse.x = p.x; mouse.y = p.y; updateMouseWorld(); }

function onPress(ev, p) {
  if (titleOpen || paused) { menuPress(p); return; }              // start screen / pause menu
  if (P.dead) { if (time - P.deadTime > 0.6) newRun(); return; }
  if (invOpen && inPanel(p.x, p.y)) { panelPress(p.x, p.y, ev.button); return; }
  const b = buttonAt(p.x, p.y);
  if (b) { b.pressT = time + 0.15; pressButton(b.id); return; }
  if (invOpen) { invOpen = false; invSel = null; return; }          // tap outside closes the panel
  if (ev.pointerType === 'mouse' && ev.button !== 0) return;
  if (movePtr !== null) return;                                      // already steering with another finger
  movePtr = ev.pointerId;
  mouse.touch = ev.pointerType !== 'mouse';
  setMouse(p);
  mouse.down = true; P.repathT = 0;
  const pad = mouse.touch ? 16 : 0;
  const e = enemyAt(p.x, p.y, pad);
  if (e) { mouse.mode = 'attack'; P.target = e; P.pickup = null; return; }
  const g = groundAt(p.x, p.y, pad);
  if (g) { mouse.mode = 'pickup'; P.pickup = g; P.target = null; return; }
  mouse.mode = 'move'; P.target = null; P.pickup = null;
}

cv.addEventListener('pointerdown', ev => {
  ev.preventDefault();
  lastPointerType = ev.pointerType;
  try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic pointers may not be capturable */ }
  onPress(ev, pointerPos(ev));
});
cv.addEventListener('pointermove', ev => {
  ev.preventDefault();
  if (ev.pointerType === 'mouse') { lastPointerType = 'mouse'; mouse.touch = false; }
  if (ev.pointerType === 'mouse' || ev.pointerId === movePtr) setMouse(pointerPos(ev));   // hold/drag keeps steering
});
function release(ev) {
  if (ev.pointerId === movePtr) { movePtr = null; mouse.down = false; }
}
cv.addEventListener('pointerup', release);
cv.addEventListener('pointercancel', release);
window.addEventListener('blur', () => { mouse.down = false; movePtr = null; });

// stop scrolling / zooming / long-press menus / double-tap zoom
cv.addEventListener('contextmenu', ev => ev.preventDefault());
for (const t of ['touchstart', 'touchmove', 'touchend']) cv.addEventListener(t, ev => ev.preventDefault(), { passive: false });
for (const t of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'selectstart', 'dragstart'])
  document.addEventListener(t, ev => ev.preventDefault());

// ===================================================================
//  KEYBOARD (bonus)
// ===================================================================
window.addEventListener('keydown', ev => {
  if (ev.repeat) return;
  if (titleOpen) {                                   // start screen shortcuts
    if (ev.code === 'Enter' || ev.code === 'KeyC') { if (saveExists()) menuAction('continue'); }
    else if (ev.code === 'KeyN') menuAction('new');
    return;
  }
  if (paused) {                                      // pause menu: only resume keys work
    if (ev.code === 'KeyP' || ev.code === 'Escape') closePause();
    return;
  }
  switch (ev.code) {
    case 'Digit1': case 'Numpad1': pressButton('fire'); break;
    case 'Digit2': case 'Numpad2': pressButton('nova'); break;
    case 'KeyQ': pressButton('hp'); break;
    case 'KeyW': pressButton('mp'); break;
    case 'KeyI': pressButton('inv'); break;
    case 'Escape': invOpen = false; invSel = null; break;
    case 'KeyP': pressButton('pause'); break;
    case 'KeyR': if (P.dead) newRun(); break;
  }
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 100));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
