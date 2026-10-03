'use strict';
// Fixed-timestep main loop and startup.
// Plain script (no modules): shares globals with the other files in js/.

// ===================================================================
//  MAIN LOOP (fixed timestep)
// ===================================================================
let last = 0, acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= DT) { update(DT); acc -= DT; }
  render();
  requestAnimationFrame(frame);
}

mmCanvas = document.createElement('canvas'); mmCanvas.width = MW * 2; mmCanvas.height = MH * 2;
resize();
refreshSave();
newRun('warrior');
titleOpen = saveCache.status === 'ok';
classSelectOpen = !titleOpen;                                  // no save: start by picking a class                     // offer Continue / New Game when a save exists
if (saveCache.status === 'corrupt') msg('Saved data was invalid and has been ignored');
if (saveCache.status === 'blocked') msg('Saving unavailable (browser storage is blocked)');
update(0);
requestAnimationFrame(t => { last = t; frame(t); });

// test/debug hook (harmless)
window.__game = { update, render, get state() { return { P, enemies, ground, depth, map, rooms, stairs, mouse, HUD, PANEL, VZ, W, H, invOpen, paused, titleOpen, autosaveOK, saveCache, seed, kills, menu, newRun, saveGame, loadGame, deleteSave, menuAction, menuButtons, classSelectOpen, treeOpen, pickClass, openClassSelect, learnSkill, equipSkill, castSlot, respecSkills, learnStatus, SKILLS, CLASSES, TREE, treeGeo, treePress, classCards, parseSave, hasProgress, pressButton, usePotion, pathTo, TS, equipFromInv, buildLevel, genItem, findPath }; } };
