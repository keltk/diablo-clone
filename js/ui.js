'use strict';
// HUD, inventory panel drawing, tooltips and the top-level render().
// Plain script (no modules): shares globals with the other files in js/.

function drawOrb(cx, cy, r, frac, c1, c2, label) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#120808'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const h = r * 2 * clamp(frac, 0, 1);
  const gr = ctx.createLinearGradient(0, cy + r - h, 0, cy + r); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  ctx.fillStyle = gr; ctx.fillRect(cx - r, cy + r - h, r * 2, h);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx - r * 0.6, cy - r * 0.8, r * 0.5, r * 0.6);
  ctx.restore();
  ctx.strokeStyle = '#8a7a55'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  text(label, cx, cy, '#fff', 13, 'center');
}

function drawItemIcon(it, x, y, w, h) {
  const c = RARITY_COLOR[it.rar];
  box(x + 8, y + 8, w - 16, h - 16, '#1a1a22', c);
  ctx.fillStyle = c;
  if (it.slot === 'weapon') { ctx.fillRect(x + w / 2 - 3, y + 12, 6, h - 30); ctx.fillRect(x + w / 2 - 10, y + h - 22, 20, 5); }
  else { ctx.fillRect(x + 14, y + 14, w - 28, h - 28); ctx.fillStyle = '#00000055'; ctx.fillRect(x + w / 2 - 3, y + 14, 6, h - 28); }
}

function itemLines(it) {
  const l = [];
  if (it.dmg) l.push('+' + it.dmg + ' Damage');
  if (it.armor) l.push('+' + it.armor + ' Armor');
  if (it.hp) l.push('+' + it.hp + ' Max HP');
  return l;
}

function btnBox(r, label, col, enabled) {
  box(r.x, r.y, r.w, r.h, enabled ? col : '#2a2a30', '#000');
  text(label, r.x + r.w / 2, r.y + r.h / 2, enabled ? '#fff' : '#777', 16, 'center');
}

function drawInventory() {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(PANEL.x, PANEL.y); ctx.scale(PANEL.s, PANEL.s);
  if (invSel && !(invSel.kind === 'inv' ? P.inv.includes(invSel.item) : P[invSel.item.slot] === invSel.item)) invSel = null;
  box(0, 0, PANEL.w, PANEL.h, 'rgba(18,16,24,0.97)', '#8a7a55');
  text('INVENTORY', 270, 26, '#e8d9a8', 18, 'center');
  btnBox(BTN_CLOSE, 'X', '#7a2a2a', true);
  text('Weapon', 62, 66, '#aaa', 12, 'center');
  text('Armor', 62, 176, '#aaa', 12, 'center');
  const sel = r => { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); };
  for (const s of ['weapon', 'armor']) {
    const r = SLOT_EQUIP[s];
    box(r.x, r.y, r.w, r.h, '#0d0d12', '#555');
    if (P[s]) { drawItemIcon(P[s], r.x, r.y, r.w, r.h); if (invSel && invSel.item === P[s]) sel(r); }
  }
  text('Damage  ' + baseDmg(), 20, 290, '#ffd0a0', 13);
  text('Armor   ' + armorVal(), 20, 312, '#a0c8ff', 13);
  text('Max HP  ' + P.maxhp, 20, 334, '#ff9a9a', 13);
  text('Gold    ' + P.gold, 20, 356, '#f5c518', 13);
  for (let i = 0; i < INV_SIZE; i++) {
    const r = invSlot(i);
    box(r.x, r.y, r.w, r.h, '#0d0d12', '#444');
    if (P.inv[i]) { drawItemIcon(P.inv[i], r.x, r.y, r.w, r.h); if (invSel && invSel.item === P.inv[i]) sel(r); }
  }
  // detail area for the selected item (replaces hover tooltips)
  ctx.fillStyle = '#444'; ctx.fillRect(14, 386, PANEL.w - 28, 1);
  if (invSel) {
    const it = invSel.item;
    text(it.name, 20, 404, RARITY_COLOR[it.rar], 14);
    text(RARITY_NAME[it.rar] + ' ' + (it.slot === 'weapon' ? 'Weapon' : 'Armor') + (invSel.kind === 'equip' ? ' (equipped)' : ''), 20, 424, '#999', 12);
    itemLines(it).forEach((l, i) => text(l, 20, 446 + i * 18, '#9fe39f', 13));
    btnBox(BTN_EQUIP, invSel.kind === 'inv' ? 'Equip' : 'Unequip', '#2a6a3a', true);
    if (invSel.kind === 'inv') btnBox(BTN_SELL, 'Sell  ' + it.value + 'g', '#7a6420', true);
  } else {
    text(P.inv.length ? 'Tap an item to inspect it,' : 'Your bag is empty.', 20, 410, '#888', 13);
    if (P.inv.length) text('tap it again (or Equip) to wear it.', 20, 430, '#888', 13);
    text('Sell gives gold. Tap outside to close.', 20, 470, '#666', 12);
  }
  ctx.restore();
}

function drawButton(b) {
  let cd = 0, max = 1, count, disabled = false;
  if (b.id === 'fire') { cd = P.cd[0]; max = 0.35; disabled = P.mp < 8; }
  else if (b.id === 'nova') { cd = P.cd[1]; max = 2.5; disabled = P.mp < 25; }
  else if (b.id === 'hp') { cd = P.potCd; max = 0.8; count = P.potions.hp; disabled = count === 0; }
  else if (b.id === 'mp') { cd = P.potCd; max = 0.8; count = P.potions.mp; disabled = count === 0; }
  const x = b.x, y = b.y, r = b.r, down = time < b.pressT;
  ctx.fillStyle = 'rgba(10,10,16,0.78)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = down ? '#fff' : b.col; ctx.globalAlpha = (b.id === 'inv' && invOpen) || (b.id === 'pause' && paused) ? 1 : 0.9;
  ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  if (disabled) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.fill(); }
  if (cd > 0) {                                  // cooldown: dark sweep draining downwards
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - r, y - r, r * 2, r * 2 * Math.min(1, cd / max)); ctx.restore();
  }
  ctx.strokeStyle = down ? '#fff' : '#8a7a55'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  text(b.label, x, y, '#fff', Math.round(r * 0.36), 'center');
  if (count !== undefined) {                     // potion count badge
    const bx = x + r * 0.62, by = y - r * 0.62, br = Math.max(11, r * 0.3);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a7a55'; ctx.lineWidth = 2; ctx.stroke();
    text(String(count), bx, by, count ? '#fff' : '#f66', Math.round(br * 1.1), 'center');
  }
  if (!touchDevice) text(b.key, x - r * 0.6, y - r * 0.62, '#ffe14d', 12, 'center');
}

function drawHUD() {
  const sh = HUD.statsS;
  // top-left stats (scaled for small screens)
  ctx.save(); ctx.translate(10, 10); ctx.scale(sh, sh);
  box(0, 0, 250, 92, 'rgba(0,0,0,0.55)', '#5a4d33');
  text('Level ' + P.level, 10, 16, '#ffe14d', 16);
  const need = xpNeed(P.level);
  box(10, 30, 230, 10, '#222'); ctx.fillStyle = '#8f5bd6'; ctx.fillRect(10, 30, 230 * P.xp / need, 10);
  text('XP ' + P.xp + '/' + need, 125, 35, '#fff', 10, 'center');
  text('Gold ' + P.gold, 10, 54, '#f5c518', 14);
  text('Depth ' + depth + '  (best ' + bestDepth + ')', 10, 74, '#cfd8ff', 14);
  text(enemies.length ? 'Enemies: ' + enemies.length : 'Level cleared!', 140, 54, enemies.length ? '#ff9a9a' : '#7dff9a', 13);
  ctx.restore();

  // minimap (top-down, top-right)
  if (mmDirty) {
    const m = mmCanvas.getContext('2d'); m.clearRect(0, 0, MW * 2, MH * 2);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) {
      if (!explored[j * MW + i]) continue;
      const t = map[j * MW + i];
      m.fillStyle = t === 1 ? '#222633' : t === 2 ? '#33c26a' : '#6a6458';
      m.fillRect(i * 2, j * 2, 2, 2);
    }
    mmDirty = false;
  }
  box(W - 142, 8, MW * 2 + 12, MH * 2 + 12, 'rgba(0,0,0,0.6)', '#5a4d33');
  ctx.drawImage(mmCanvas, W - 136, 14);
  ctx.fillStyle = '#ff4040';
  for (const e of enemies) if (dist(e.x, e.y, P.x, P.y) < 12 * TS) ctx.fillRect(W - 136 + (e.x / TS) * 2 - 1, 14 + (e.y / TS) * 2 - 1, 3, 3);
  ctx.fillStyle = '#fff'; ctx.fillRect(W - 136 + (P.x / TS) * 2 - 1, 14 + (P.y / TS) * 2 - 1, 3, 3);

  // boss bar + messages sit below the top panels
  let y = HUD.topZone;
  const boss = enemies.find(e => e.boss && e.aggro);
  if (boss) {
    const bw = Math.min(400, W - 24);
    box(W / 2 - bw / 2, y, bw, 16, '#000', '#6b1f1f');
    ctx.fillStyle = '#c0204a'; ctx.fillRect(W / 2 - bw / 2 + 2, y + 2, (bw - 4) * Math.max(0, boss.hp / boss.maxhp), 12);
    text(boss.T.name, W / 2, y + 30, '#ffb0c0', 13, 'center');
    y += 44;
  }
  const ms = Math.round(15 * Math.min(HUD.s, 1.25));
  messages.forEach((m, i) => { ctx.globalAlpha = clamp(4 - m.t, 0, 1); text(m.s, W / 2, y + 8 + i * (ms + 6), '#ffe9a8', ms, 'center'); });
  ctx.globalAlpha = 1;

  // orbs
  const [o1, o2] = HUD.orbs;
  drawOrb(o1.x, o1.y, HUD.R, P.hp / P.maxhp, '#ff4a4a', '#6a0808', Math.ceil(P.hp) + '/' + P.maxhp);
  drawOrb(o2.x, o2.y, HUD.R, P.mp / P.maxmp, '#4a8aff', '#08206a', Math.floor(P.mp) + '/' + P.maxmp);

  // on-screen buttons
  for (const b of HUD.buttons) drawButton(b);

  if (hintT > 0) {
    ctx.globalAlpha = Math.min(1, hintT);
    const hs = Math.round(13 * Math.min(HUD.s, 1.2));
    const segs = touchDevice
      ? ['Tap to move (hold to keep walking)', 'tap an enemy to chase it', 'you auto-attack when close', 'buttons: skills & potions']
      : ['Click to move (hold to walk)', 'click an enemy to chase it', 'auto-attacks when close', '1 Fireball', '2 Nova', 'Q Health', 'W Mana', 'I Inventory', 'P Pause'];
    ctx.font = 'bold ' + hs + 'px monospace';
    const lines = []; let cur = '';
    for (const sg of segs) {                       // greedy word-wrap of the hint segments to the screen width
      const t = cur ? cur + ' | ' + sg : sg;
      if (cur && ctx.measureText(t).width > W - 24) { lines.push(cur); cur = sg; } else cur = t;
    }
    lines.push(cur);
    lines.forEach((l, i) => text(l, W / 2, HUD.hudTop - 6 - (lines.length - 1 - i) * (hs + 6), '#ddd', hs, 'center'));
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);     // logical units -> backing-store pixels
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawWorld();
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  if (P.flash > 0) { ctx.fillStyle = 'rgba(255,0,0,' + (P.flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
  drawHUD();
  if (invOpen) drawInventory();
  const k = Math.min(1, W / 700);                                 // text scale for full-screen overlays
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H);
    text('PAUSED', W / 2, H / 2 - 20, '#fff', 36 * k, 'center');
    text('tap anywhere (or P) to resume', W / 2, H / 2 + 24, '#ccc', 18 * Math.max(k, 0.8), 'center');
  }
  if (P.dead) {
    ctx.fillStyle = 'rgba(40,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    text('YOU DIED', W / 2, H / 2 - 70, '#e03030', 64 * k, 'center');
    text('Depth ' + depth + '   Level ' + P.level + '   Kills ' + kills + '   Gold ' + P.gold, W / 2, H / 2, '#ddd', 20 * Math.max(k, 0.75), 'center');
    text('Best depth: ' + bestDepth, W / 2, H / 2 + 34, '#f5c518', 18 * Math.max(k, 0.8), 'center');
    text(touchDevice ? 'Tap to restart' : 'Tap or press R to restart', W / 2, H / 2 + 80, '#fff', 26 * Math.max(k, 0.8), 'center');
  }
  text('seed ' + seed, W - 8, 8 + MH * 2 + 26, 'rgba(255,255,255,0.35)', 10, 'right');
}
