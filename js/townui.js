'use strict';
// Town NPCs: drawing + picking, and the tap-friendly NPC panels (merchant buy/sell, healer, trainer).
// Plain script (no modules): shares globals with the other files in js/.
// To add a new NPC kind: add it to NPC_TYPES (world.js) and a case in drawNpcPanel() / npcPanelPress() below.

const POTION_PRICE = 25;
const respecCost = () => 40 + 15 * P.level;
const buyPrice = it => Math.max(15, Math.round(it.value * 3));

// ---- merchant stock: refreshed every time the player arrives in a town; quality follows the best depth reached ----
let stock = [];
function refreshStock() {
  const d = Math.max(1, bestDepth);
  stock = [];
  for (let i = 0; i < 12; i++) stock.push(genItem(d, i < 2 && d >= 3 ? 1 : 0));
  stock.sort((a, b) => (a.slot === b.slot ? a.value - b.value : a.slot < b.slot ? -1 : 1));
}

// ---- NPC sprites (colored boxes) ----
const npcH = 34;
function npcAt(mx, my, pad) {
  pad = pad || 0;
  for (const n of npcs) {
    const sx = projX(n.x, n.y) - cam.x, sy = projY(n.x, n.y, 0) - cam.y;
    if (Math.abs(mx - sx) <= 18 + pad && my >= sy - npcH - 24 - pad && my <= sy + 10 + pad) return n;
  }
  return null;
}
function drawNpc(n, hov) {
  shadow(n.x, n.y, 10);
  if (hov || (npcOpen && npcOpen.npc === n)) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); groundEllipse(n.x, n.y, 15); ctx.stroke(); }
  isoCyl(n.x, n.y, 9, 0, 24, shade(n.color, 1.15), shade(n.color, 0.8));
  isoBox(n.x - 5, n.y - 5, n.x + 5, n.y + 5, 24, 33, '#f2d8b0', '#c9a97f', '#e2c49a');
  isoBox(n.x - 7, n.y - 7, n.x + 7, n.y + 7, 33, 37, n.hat, shade(n.hat, 0.6), shade(n.hat, 0.8));
  const sx = projX(n.x, n.y) - cam.x, sy = projY(n.x, n.y, 0) - cam.y, bob = Math.sin(time * 3 + n.x) * 2;
  text(n.name, sx, sy - 56, '#ffe9a8', 12, 'center');
  ctx.fillStyle = '#ffe14d'; ctx.fillRect(sx - 2, sy - 50 + bob - 12, 4, 6); ctx.fillRect(sx - 2, sy - 50 + bob - 4, 4, 3);   // "!" marker
}

// ---- open / close ----
function openNpc(n) {
  invOpen = false; treeOpen = false; slotSel = null; invSel = null;
  npcOpen = { npc: n, tab: 'buy', sel: null, armed: 0 };
}
function closeNpc() { npcOpen = null; }
function nearestNpc(maxD) {
  let best = null, bd = maxD;
  for (const n of npcs) { const d = dist(P.x, P.y, n.x, n.y); if (d < bd) { bd = d; best = n; } }
  return best;
}

// ---- panel geometry (panel-local 540 x 500, same frame as the inventory) ----
const NP = {
  tabBuy: { x: 20, y: 46, w: 120, h: 38 }, tabSell: { x: 148, y: 46, w: 120, h: 38 },
  grid: i => ({ x: 20 + (i % 4) * 78, y: 92 + Math.floor(i / 4) * 78, w: 68, h: 68 }),
  potHp: { x: 350, y: 92, w: 170, h: 74 }, potMp: { x: 350, y: 174, w: 170, h: 74 }, junk: { x: 350, y: 92, w: 170, h: 74 },
  action: { x: 320, y: 432, w: 200, h: 52 },
  big: { x: 70, y: 330, w: 400, h: 80 }
};
const junkItems = () => P.inv.filter(it => it.rar === 0);

function npcPress(x, y) {                                   // tap inside the panel
  const o = npcOpen, p = toPanel(x, y);
  if (inRect(BTN_CLOSE, p.x, p.y)) { closeNpc(); return; }
  const k = o.npc.kind;
  if (k === 'merchant') {
    if (inRect(NP.tabBuy, p.x, p.y)) { o.tab = 'buy'; o.sel = null; return; }
    if (inRect(NP.tabSell, p.x, p.y)) { o.tab = 'sell'; o.sel = null; return; }
    const list = o.tab === 'buy' ? stock : P.inv;
    for (let i = 0; i < list.length && i < 16; i++) if (inRect(NP.grid(i), p.x, p.y)) { o.sel = list[i]; return; }
    if (o.tab === 'buy') {
      if (inRect(NP.potHp, p.x, p.y)) buyPotion('hp');
      else if (inRect(NP.potMp, p.x, p.y)) buyPotion('mp');
    } else if (inRect(NP.junk, p.x, p.y)) {
      const j = junkItems(), g = j.reduce((a, it) => a + it.value, 0);
      if (j.length) { P.inv = P.inv.filter(it => it.rar !== 0); P.gold += g; o.sel = null; msg('Sold ' + j.length + ' common item' + (j.length > 1 ? 's' : '') + ' for ' + g + ' gold'); }
    }
    if (o.sel && inRect(NP.action, p.x, p.y)) {
      if (o.tab === 'buy') buyItem(o.sel); else sellItem2(o.sel);
    }
  } else if (k === 'healer') {
    if (inRect(NP.big, p.x, p.y)) {
      if (P.hp >= P.maxhp && P.mp >= P.maxmp) { msg('You are already in perfect health'); return; }
      P.hp = P.maxhp; P.mp = P.maxmp;
      addText(P.x, P.y, 'Healed!', '#7dff9a', 18, 1.4);
      addEffect({ type: 'ring', x: P.x, y: P.y, r0: 8, r1: 80, dur: 0.6, color: '120,255,160' });
      msg('The healer restores you.');
    }
  } else if (k === 'trainer') {
    if (inRect(NP.big, p.x, p.y)) {
      const cost = respecCost();
      if (P.gold < cost) { msg('Not enough gold (' + cost + ' needed)'); return; }
      if (performance.now() > o.armed) { o.armed = performance.now() + 3000; return; }       // second tap confirms
      o.armed = 0; doRespec(cost);
    }
  }
}
function doRespec(cost) {
  P.gold -= cost; respecSkills(); treeSel = CLASSES[P.cls].start; slotSel = null;
  msg('Skills reset: ' + P.skillPoints + ' points to spend (T)');
}
function buyPotion(kind) {
  if (P.gold < POTION_PRICE) { msg('Not enough gold'); return; }
  if (P.potions[kind] >= 99) { msg('You cannot carry more'); return; }
  P.gold -= POTION_PRICE; P.potions[kind]++;
}
function buyItem(it) {
  const price = buyPrice(it);
  if (P.gold < price) { msg('Not enough gold'); return; }
  if (P.inv.length >= INV_SIZE) { msg('Inventory full!'); return; }
  P.gold -= price; P.inv.push(it); stock.splice(stock.indexOf(it), 1); npcOpen.sel = null;
  msg('Bought ' + it.name);
}
function sellItem2(it) {
  const i = P.inv.indexOf(it); if (i < 0) return;
  P.inv.splice(i, 1); P.gold += it.value; npcOpen.sel = null;
  addText(P.x, P.y, '+' + it.value + ' gold', '#f5c518', 14);
}

// ---- drawing ----
function cmpLines(it) {                                     // item stats, with the difference to what you wear
  const cur = P[it.slot], out = [];
  const row = (v, c, label) => {
    if (!v && !c) return;
    const d = v - c;
    out.push(['+' + v + ' ' + label + (cur ? (d > 0 ? '  (+' + d + ')' : d < 0 ? '  (' + d + ')' : '  (same)') : ''), d < 0 ? '#ff9a7a' : '#9fe39f']);
  };
  row(it.dmg, cur ? cur.dmg : 0, 'Damage'); row(it.armor, cur ? cur.armor : 0, 'Armor'); row(it.hp, cur ? cur.hp : 0, 'Max HP');
  return out;
}

function drawNpcPanel() {
  const o = npcOpen, k = o.npc.kind;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(PANEL.x, PANEL.y); ctx.scale(PANEL.s, PANEL.s);
  box(0, 0, PANEL.w, PANEL.h, 'rgba(18,16,24,0.97)', '#8a7a55');
  text(o.npc.name.toUpperCase(), 270, 26, '#e8d9a8', 18, 'center');
  btnBox(BTN_CLOSE, 'X', '#7a2a2a', true);
  const sel = r => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); };
  if (k === 'merchant') {
    for (const [r, tab, lab] of [[NP.tabBuy, 'buy', 'Buy'], [NP.tabSell, 'sell', 'Sell']]) {
      box(r.x, r.y, r.w, r.h, o.tab === tab ? '#3a5a8a' : '#23232c', o.tab === tab ? '#fff' : '#555');
      text(lab, r.x + r.w / 2, r.y + r.h / 2, '#fff', 16, 'center');
    }
    text('Gold ' + P.gold, 520, 66, '#f5c518', 15, 'right');
    const list = o.tab === 'buy' ? stock : P.inv;
    if (o.sel && !list.includes(o.sel)) o.sel = null;
    for (let i = 0; i < 16; i++) {
      const r = NP.grid(i);
      box(r.x, r.y, r.w, r.h, '#0d0d12', '#444');
      const it = list[i]; if (!it) continue;
      drawItemIcon(it, r.x, r.y, r.w, r.h);
      const price = o.tab === 'buy' ? buyPrice(it) : it.value;
      text(price + 'g', r.x + r.w / 2, r.y + r.h - 8, o.tab === 'buy' && P.gold < price ? '#ff7a7a' : '#ffe27a', 11, 'center');
      if (o.sel === it) sel(r);
    }
    if (o.tab === 'buy') {
      for (const [r, kind, col, lab] of [[NP.potHp, 'hp', '#8a2a2a', 'Health potion'], [NP.potMp, 'mp', '#2a3f8a', 'Mana potion']]) {
        const ok = P.gold >= POTION_PRICE;
        box(r.x, r.y, r.w, r.h, ok ? col : '#2a2a30', '#000');
        text(lab, r.x + r.w / 2, r.y + 20, ok ? '#fff' : '#888', 14, 'center');
        text('Buy  ' + POTION_PRICE + 'g', r.x + r.w / 2, r.y + 41, ok ? '#ffe27a' : '#777', 14, 'center');
        text('You have ' + P.potions[kind], r.x + r.w / 2, r.y + 60, '#bbb', 11, 'center');
      }
      text('Stock changes each visit', 350, 270, '#777', 11);
      text('Better gear the deeper', 350, 286, '#777', 11);
      text('you have been.', 350, 302, '#777', 11);
    } else {
      const j = junkItems(), g = j.reduce((a, it) => a + it.value, 0);
      btnBox(NP.junk, j.length ? 'Sell ' + j.length + ' common  ' + g + 'g' : 'No common items', '#7a6420', j.length > 0);
      text('Equipped gear is not for sale -', 350, 190, '#777', 11);
      text('take it off in your bag (I).', 350, 206, '#777', 11);
    }
    ctx.fillStyle = '#444'; ctx.fillRect(14, 408, PANEL.w - 28, 1);
    if (o.sel) {
      const it = o.sel;
      text(it.name, 20, 424, RARITY_COLOR[it.rar], 14);
      text(RARITY_NAME[it.rar] + ' ' + (it.slot === 'weapon' ? 'Weapon' : 'Armor'), 20, 442, '#999', 12);
      cmpLines(it).forEach((l, i) => text(l[0], 20, 460 + i * 15, l[1], 12));
      if (o.tab === 'buy') {
        const price = buyPrice(it), ok = P.gold >= price && P.inv.length < INV_SIZE;
        btnBox(NP.action, P.gold < price ? 'Need ' + price + 'g' : P.inv.length >= INV_SIZE ? 'Bag full' : 'Buy  ' + price + 'g', '#2a6a3a', ok);
      } else btnBox(NP.action, 'Sell  ' + it.value + 'g', '#7a6420', true);
    } else {
      text(o.tab === 'buy' ? 'Tap an item to inspect it.' : (P.inv.length ? 'Tap an item to sell it.' : 'Your bag is empty.'), 20, 430, '#888', 13);
      text('Tap outside to close.', 20, 470, '#666', 12);
    }
  } else if (k === 'healer') {
    text('"Let me tend to your wounds."', 270, 120, '#cfd8ff', 16, 'center');
    text('HP ' + Math.ceil(P.hp) + '/' + P.maxhp + '     MP ' + Math.floor(P.mp) + '/' + P.maxmp, 270, 170, '#ddd', 16, 'center');
    const need = P.hp < P.maxhp || P.mp < P.maxmp;
    btnBox(NP.big, need ? 'Heal  (free)' : 'You are healthy', '#2a8a4a', need);
    text('Tap outside to close.', 270, 470, '#666', 12, 'center');
  } else if (k === 'trainer') {
    const cost = respecCost(), ok = P.gold >= cost, armed = performance.now() < o.armed;
    text('"Unlearn everything and start over."', 270, 110, '#cfd8ff', 15, 'center');
    text('All skill points are refunded', 270, 150, '#ddd', 14, 'center');
    text('(you will have ' + (P.level + 1) + ' points to spend).', 270, 172, '#ddd', 14, 'center');
    text('Cost: ' + cost + ' gold      You have: ' + P.gold, 270, 230, ok ? '#f5c518' : '#ff7a7a', 16, 'center');
    btnBox(NP.big, !ok ? 'Need ' + cost + ' gold' : armed ? 'Tap again to confirm' : 'Reset skills  (' + cost + 'g)', armed ? '#a02020' : '#8a4a2a', ok);
    text('Tap outside to close.', 270, 470, '#666', 12, 'center');
  }
  ctx.restore();
}
