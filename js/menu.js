'use strict';
// Pause menu + start screen: button layout, tap handling and actions (drawing lives in ui.js).
// Plain script (no modules): shares globals with the other files in js/.

const menu = { confirm: null, confirmUntil: 0, msg: '', msgUntil: 0, msgBad: false };

function menuSay(text, bad) { menu.msg = text; menu.msgBad = !!bad; menu.msgUntil = performance.now() + 4000; }
function menuConfirm() { return menu.confirm && performance.now() < menu.confirmUntil ? menu.confirm : null; }
function menuAsk(id) { menu.confirm = id; menu.confirmUntil = performance.now() + 3000; }
function menuReset() { menu.confirm = null; menu.msg = ''; refreshSave(); }

function openPause() { paused = true; menuReset(); }
function closePause() { paused = false; menu.confirm = null; }

// Buttons for the current menu, laid out for the current window size. 2 columns on short landscape screens.
function menuButtons() {
  const sv = saveCache || refreshSave();
  const has = sv.status === 'ok', cf = menuConfirm();
  const list = titleOpen
    ? [{ id: 'continue', label: 'Continue', on: has, col: '#2a6a3a' },
       { id: 'new', label: cf === 'new' ? 'Tap again: start new game' : 'New Game', on: true, col: has ? '#6a3a2a' : '#2a4a6a' }]
    : [{ id: 'resume', label: 'Resume', on: true, col: '#2a6a3a' },
       { id: 'save', label: 'Save Game', on: sv.status !== 'blocked', col: '#2a4a6a' },
       { id: 'load', label: cf === 'load' ? 'Tap again to load (lose progress)' : 'Load / Continue', on: has, col: '#4a3a6a' },
       { id: 'delete', label: cf === 'delete' ? 'Tap again to DELETE save' : 'Delete Save', on: has, col: cf === 'delete' ? '#a02020' : '#6a2a2a' }];
  const bw = Math.min(380, W - 32), bh = Math.round(Math.max(54, 56 / VZ)), gap = 12;
  const total = list.length * bh + (list.length - 1) * gap;
  const twoCol = W > H * 1.2 && H < 640;
  let bx, by, infoX, infoY;
  if (twoCol) { bx = W / 2 + 16; by = Math.max(10, (H - total) / 2); infoX = W / 4; infoY = Math.max(40, H / 2 - 110); }
  else { bx = (W - bw) / 2; infoY = Math.max(30, (H - (total + 280)) / 2 + 20); by = infoY + 250; }
  list.forEach((b, i) => { b.x = bx; b.y = by + i * (bh + gap); b.w = twoCol ? Math.min(bw, W / 2 - 32) : bw; b.h = bh; });
  return { list, infoX: twoCol ? infoX : W / 2, infoY, twoCol };
}

function menuPress(p) {
  const lay = menuButtons();
  for (const b of lay.list) {
    if (!inRect(b, p.x, p.y)) continue;
    if (!b.on) { menuSay(saveCache && saveCache.status === 'blocked' ? 'Storage is blocked in this browser' : 'No saved game', true); return; }
    menuAction(b.id);
    return;
  }
}

function menuAction(id) {
  const cf = menuConfirm();
  if (id !== 'load' && id !== 'delete' && id !== 'new') menu.confirm = null;
  switch (id) {
    case 'resume': closePause(); break;
    case 'save': {
      const r = saveGame();
      menuSay(r.ok ? 'Game saved' : r.error, !r.ok);
      break;
    }
    case 'load':
      if (cf !== 'load') { menuAsk('load'); break; }
      menu.confirm = null;
      if (loadGame()) { closePause(); msg('Game loaded'); } else menuSay('Could not load the save', true);
      break;
    case 'delete':
      if (cf !== 'delete') { menuAsk('delete'); break; }
      menu.confirm = null;
      deleteSave();
      closePause(); openClassSelect();   // fresh run: pick a class (autosave is allowed again since no save exists)
      break;
    case 'continue':
      if (loadGame()) { titleOpen = false; msg('Welcome back!'); } else menuSay('Could not load the save', true);
      break;
    case 'new':
      if (saveExists() && cf !== 'new') { menuAsk('new'); break; }
      menu.confirm = null;
      titleOpen = false; openClassSelect();   // autosave stays off until you save manually (the old save is kept)
      break;
  }
}

function saveInfoLines() {              // for display: array of [text, color]
  const sv = saveCache || refreshSave();
  if (sv.status === 'blocked') return [['Saving unavailable:', '#ff8a8a'], ['browser storage is blocked here', '#ff8a8a']];
  if (sv.status === 'corrupt') return [['Saved data is invalid / old', '#ff8a8a'], ['and was ignored', '#ff8a8a']];
  if (sv.status === 'none') return [['No saved game', '#aaa']];
  const d = sv.data, when = new Date(d.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return [[CLASSES[d.skills.cls].name + '   Level ' + d.player.level + '   ' + WORLD[d.world.zone].name, '#ffe14d'], ['Gold ' + d.player.gold + '   Best depth ' + d.best, '#f5c518'], ['Saved ' + when, '#cfd8ff']];
}
