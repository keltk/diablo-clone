# Tiny Diablo

A small isometric ARPG in plain JavaScript (no build step, no modules). Open `index.html` directly (works from `file://`).
Mouse/keyboard and touch are supported.

## Controls
- Click/tap to move, attack and pick up. Tap an NPC to walk to it and talk (or press **E** next to one).
- Auto-attack is class flavored. Skill slots: **1-4** or the big round buttons. **Q / W** potions, **I** bag, **T** skill tree, **P** pause, **Esc** closes panels.

## World
Haven (town 1) -> Old Crypt (dungeon, 3 floors, boss) / Ember Caverns (dungeon, unlocked by the Crypt boss) / King's Road (unlocked by beating either) -> Fenwick (town 2) -> Frostbound Mines.
Towns have a Merchant (buy/sell; stock refreshes on every visit and improves with your best depth), a Healer (free heal) and, in Haven, a Trainer (respec for gold).
Dying returns you to the last town (-10% gold, gear and XP kept).

## Adding a zone (data-driven - see `js/world.js`)
Everything is an entry in the `WORLD` table:

```js
dun4: { type: 'dungeon', name: 'Sunken Vault', town: 'town2', theme: 'frost', recLevel: 12,
        floors: 4, depthStart: 9, power: 3.4, step: 0.3,           // enemy strength is FIXED: power + step*(floor-1)
        mix: [{ t: 'golem', w: 40 }, { t: 'cultist', w: 30, minFloor: 2 }],   // enemy types from TYPES (state.js)
        boss: { name: 'Vault Keeper', T: { name: 'Vault Keeper', color: '#44ddaa' } },
        unlock: { all: ['dun3'] } }                                // optional: boss of dun3 must be dead
```
Then add a mark to a town layout so the player can reach it: put e.g. `'4'` in the `layout` rows of the parent town and
`'4': { exit: 'dun4' }` in that town's `marks`. A `road` entry (`from`/`to` towns) links two towns the same way (a mark in each town).
New towns are ASCII layouts (`#` wall, `%` building, `^` tree, `F` fountain, `,` grass, `.` cobble, `@` spawn, mark chars for NPCs/exits).
Themes (colors) live in `THEMES`, NPC kinds in `NPC_TYPES` (panels in `js/townui.js`).
Saves only store zone ids, floors and boss-cleared flags, so adding zones never breaks old saves.

## Files
`util state classes world layout map items entities skills save menu skillui townui input render ui main` (all in `js/`).
