# DARK FORT — a Mörk Borg dungeon crawler

A complete, playable browser version of **Dark Fort**, the solo micro-RPG that
became *Mörk Borg*. It plays the full rules — character creation, room
exploration, combat, scrolls, the void-peddler's shop, levelling up and all the
ways to die — and, crucially, **draws what the dice produce**: every room's
`2d6` shape, its `d4` doors and whatever encounter you rolled are rendered live
onto an HTML5 canvas in a filthy, high-contrast Mörk Borg style.

## Play

It's a static site — no build step, no server required.

```
open darkfort/index.html          # macOS
xdg-open darkfort/index.html      # Linux
# ...or just double-click the file, or serve the folder with any static host
```

Click **Enter the Dark Fort** and descend.

## What the dice draw

- **Room shape (2d6)** — irregular cave, oval, cross, corridor, square, round,
  rectangular, triangular or skull-shaped. Each is generated as a hand-wobbled
  ink shape, surrounded by living rock.
- **Doors (d4)** — 0/1/2 yellow-framed doorways are drawn on the room's edges.
- **Encounter** — the room-table roll is drawn in the room: the eight monsters
  (skeleton, cultist, goblin, undead hound, necro-sorcerer, stone troll, medusa,
  ruin basilisk), the riddling soothsayer, the void peddler's stall, the pit
  trap, or a glowing item/scroll.

## Rules implemented

15 hp + a rolled weapon and starting item · `15 + d6` silver · entrance table ·
room table (nothing / pit trap / soothsayer / weak / tough / peddler) · d6 hit
rolls vs monster points · weapon damage, armour and Aegis absorption · all weak
and tough monster specials (skeleton/cultist/goblin loot, sorcerer maggot curse,
troll's 7 kill-points, medusa petrification & treasure, basilisk free level-up) ·
fleeing · scrolls (Summon Weak Daemon, Palms Open the Southern Gate, Aegis of
Sorrow, False Omen) · cloak of invisibility · the peddler's buy/sell prices ·
both level-up triggers (12 rooms + 15 points, or 40 silver) and the full d6 boon
table including the "halve a chosen monster's damage" oath · dead-ends and death.

## Files

| file | purpose |
|------|---------|
| `index.html` | page shell (canvas, character sheet, log, actions) |
| `css/darkfort.css` | Mörk Borg styling — yellow/pink/black brutalism, grain, skew |
| `js/art.js` | the procedural canvas art engine (rooms, doors, monsters) |
| `js/game.js` | the rules engine and UI controller |
| `test/harness.js` | headless DOM stub that auto-plays the engine to catch bugs |
| `test/render-gallery.js` | renders every shape/encounter to PNG (needs `npm i`) |

## Dev

```
npm test          # auto-play 600k random actions through a stubbed DOM
npm run gallery   # render gallery PNGs of all shapes & encounters (needs canvas)
```

`canvas` is a **dev-only** dependency used purely for offline PNG rendering of
the art; the game in the browser uses the native canvas and needs nothing.

## Art credit

The skull (`assets/skull.png`, used on the title, the skeleton, the
necro-sorcerer and the death screen) is the original ink illustration from the
official Dark Fort sheet. Everything else on the canvas — the room shapes,
doors, other monsters and props — is generated procedurally at runtime.

---

*Dark Fort and Mörk Borg © Ockult Örtmästare Games & Stockholm Kartell, including
the skull artwork. This is an unofficial fan implementation made for play and
learning.*
