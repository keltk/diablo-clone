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

function drawTooltip(it, hint) {
  const lines = itemLines(it);
  const rows = [[it.name, RARITY_COLOR[it.rar]], [RARITY_NAME[it.rar] + ' ' + (it.slot === 'weapon' ? 'Weapon' : 'Armor'), '#999']]
    .concat(lines.map(s => [s, '#9fe39f'])).concat([[hint, '#888']]);
  ctx.font = 'bold 13px monospace';
  let w = 0; for (const r of rows) w = Math.max(w, ctx.measureText(r[0]).width);
  w += 20; const h = rows.length * 20 + 10;
  let x = mouse.x + 16, y = mouse.y + 12;
  if (x + w > W) x = mouse.x - w - 8; if (y + h > H) y = H - h - 4;
  box(x, y, w, h, 'rgba(10,10,16,0.95)', RARITY_COLOR[it.rar]);
  rows.forEach((r, i) => text(r[0], x + 10, y + 16 + i * 20, r[1], 13));
}

function drawInventory() {
  box(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 'rgba(18,16,24,0.95)', '#8a7a55');
  text('INVENTORY', PANEL.x + PANEL.w / 2, PANEL.y + 24, '#e8d9a8', 18, 'center');
  text('Weapon', PANEL.x + 62, PANEL.y + 66, '#aaa', 12, 'center');
  text('Armor', PANEL.x + 62, PANEL.y + 176, '#aaa', 12, 'center');
  for (const s of ['weapon', 'armor']) {
    const r = slotRect[s];
    box(r.x, r.y, r.w, r.h, '#0d0d12', '#555');
    if (P[s]) drawItemIcon(P[s], r.x, r.y, r.w, r.h);
  }
  text('Damage  ' + baseDmg(), PANEL.x + 20, PANEL.y + 290, '#ffd0a0', 13);
  text('Armor   ' + armorVal(), PANEL.x + 20, PANEL.y + 312, '#a0c8ff', 13);
  text('Max HP  ' + P.maxhp, PANEL.x + 20, PANEL.y + 334, '#ff9a9a', 13);
  text('Gold    ' + P.gold, PANEL.x + 20, PANEL.y + 356, '#f5c518', 13);
  for (let i = 0; i < INV_SIZE; i++) {
    const r = invRect(i);
    box(r.x, r.y, r.w, r.h, '#0d0d12', '#444');
    if (P.inv[i]) drawItemIcon(P.inv[i], r.x, r.y, r.w, r.h);
  }
  text('Click: equip   Right-click: sell   I: close', PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 16, '#888', 12, 'center');
  const h = invHover();
  if (h) drawTooltip(h.item, h.kind === 'inv' ? 'Click equip / Right-click sell ' + h.item.value + 'g' : 'Click to unequip');
}

function drawHUD() {
  // top-left stats
  box(10, 10, 250, 92, 'rgba(0,0,0,0.55)', '#5a4d33');
  text('Level ' + P.level, 20, 26, '#ffe14d', 16);
  const need = xpNeed(P.level);
  box(20, 40, 230, 10, '#222'); ctx.fillStyle = '#8f5bd6'; ctx.fillRect(20, 40, 230 * P.xp / need, 10);
  text('XP ' + P.xp + '/' + need, 135, 45, '#fff', 10, 'center');
  text('Gold ' + P.gold, 20, 64, '#f5c518', 14);
  text('Depth ' + depth + '  (best ' + bestDepth + ')', 20, 84, '#cfd8ff', 14);
  const left = enemies.length;
  text(left ? 'Enemies: ' + left : 'Level cleared!', 150, 64, left ? '#ff9a9a' : '#7dff9a', 13);

  // minimap
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

  // boss bar
  const boss = enemies.find(e => e.boss && e.aggro);
  if (boss) {
    box(W / 2 - 200, 20, 400, 16, '#000', '#6b1f1f');
    ctx.fillStyle = '#c0204a'; ctx.fillRect(W / 2 - 198, 22, 396 * Math.max(0, boss.hp / boss.maxhp), 12);
    text(boss.T.name, W / 2, 50, '#ffb0c0', 13, 'center');
  }

  // orbs
  drawOrb(90, H - 70, 56, P.hp / P.maxhp, '#ff4a4a', '#6a0808', Math.ceil(P.hp) + '/' + P.maxhp);
  drawOrb(W - 90, H - 70, 56, P.mp / P.maxmp, '#4a8aff', '#08206a', Math.floor(P.mp) + '/' + P.maxmp);

  // hotbar
  const slots = [
    { key: '1', name: 'Fireball', col: '#ff8a1e', cd: P.cd[0], max: 0.35, cost: 8 },
    { key: '2', name: 'Nova', col: '#6ec0ff', cd: P.cd[1], max: 2.5, cost: 25 },
    { key: 'Q', name: 'HP', col: '#d62c2c', cd: P.potCd, max: 0.8, count: P.potions.hp },
    { key: 'W', name: 'MP', col: '#2c5ad6', cd: P.potCd, max: 0.8, count: P.potions.mp }
  ];
  const bx = (W - (4 * 60 + 3 * 8)) / 2, by = H - 76;
  slots.forEach((s, i) => {
    const x = bx + i * 68;
    box(x, by, 60, 60, '#0d0d12', '#8a7a55');
    ctx.fillStyle = s.col; ctx.fillRect(x + 14, by + 10, 32, 32);
    ctx.strokeStyle = '#00000088'; ctx.lineWidth = 2; ctx.strokeRect(x + 14, by + 10, 32, 32);
    if (s.count !== undefined) text('x' + s.count, x + 30, by + 28, '#fff', 14, 'center');
    const noMana = s.cost && P.mp < s.cost, noPot = s.count === 0;
    if (noMana || noPot) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x + 2, by + 2, 56, 56); }
    if (s.cd > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(x + 2, by + 2, 56, 56 * Math.min(1, s.cd / s.max)); }
    text(s.key, x + 8, by + 8, '#ffe14d', 12, 'center');
    text(s.name, x + 30, by + 52, '#ddd', 10, 'center');
  });

  // messages
  messages.forEach((m, i) => { ctx.globalAlpha = clamp(4 - m.t, 0, 1); text(m.s, W / 2, 80 + i * 20, '#ffe9a8', 15, 'center'); });
  ctx.globalAlpha = 1;
  if (hintT > 0) {
    ctx.globalAlpha = Math.min(1, hintT);
    text('LMB move/attack (hold to walk) | 1 Fireball | 2 Nova | Q Health | W Mana | I Inventory | P Pause', W / 2, H - 100, '#ddd', 13, 'center');
    ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawWorld();
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  if (P.flash > 0) { ctx.fillStyle = 'rgba(255,0,0,' + (P.flash * 1.2) + ')'; ctx.fillRect(0, 0, W, H); }
  drawHUD();
  if (invOpen) drawInventory();
  if (paused) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H); text('PAUSED (P)', W / 2, H / 2, '#fff', 36, 'center'); }
  if (P.dead) {
    ctx.fillStyle = 'rgba(40,0,0,0.75)'; ctx.fillRect(0, 0, W, H);
    text('YOU DIED', W / 2, H / 2 - 70, '#e03030', 64, 'center');
    text('Depth ' + depth + '   Level ' + P.level + '   Kills ' + kills + '   Gold ' + P.gold, W / 2, H / 2, '#ddd', 20, 'center');
    text('Best depth: ' + bestDepth, W / 2, H / 2 + 34, '#f5c518', 18, 'center');
    text('Press R to restart', W / 2, H / 2 + 80, '#fff', 26, 'center');
  }
  text('seed ' + seed, W - 8, H - 8, 'rgba(255,255,255,0.35)', 10, 'right');
}
