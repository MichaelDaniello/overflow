# DARK FORT // DARK FOREST — two Mörk Borg games

Two complete, playable browser games sharing one filthy Mörk Borg shell. A
**start menu** lets you pick which doom to die in:

- **DARK FORT** — Pelle Nilsson's original solo micro-RPG that became *Mörk
  Borg*. Descend a bottomless catacomb room by room. Every room's `2d6` shape,
  its `d4` doors and whatever encounter you rolled are drawn live on an HTML5
  canvas, and a **dungeon map** builds as you go so you can pick which door to
  take or backtrack into cleared rooms.
- **DARK FOREST** — Nick Waber's `v0.07` wilderness hex-crawl tribute. Wander a
  cursed wood across a procedurally drawn **hex map**: roll terrain (`2d6`),
  encounters (`d6`) and trails (`d6`), forage and camp, manage rations, and run
  for the treeline. **Barrows and ruined keeps drop you straight into a
  contained Dark Fort crawl** and hand you back to the forest afterward.

## Play

It's a static site — no build step, no server required.

```
open darkfort/index.html          # macOS
xdg-open darkfort/index.html      # Linux
# ...or just double-click the file, or serve the folder with any static host
```

Pick a game from the menu and descend / wander.

## What the dice draw

- **Room shape (2d6)** — irregular cave, oval, cross, corridor, square, round,
  rectangular, triangular or skull-shaped. Each is generated as a hand-wobbled
  ink shape, surrounded by living rock.
- **Doors (d4)** — 0/1/2 yellow-framed doorways are drawn on the room's edges.
- **Encounter** — the room-table roll is drawn in the room: the eight monsters
  (skeleton, cultist, goblin, undead hound, necro-sorcerer, stone troll, medusa,
  ruin basilisk), the riddling soothsayer, the void peddler's stall, the pit
  trap, or a glowing item/scroll.

## Dark Fort rules implemented

15 hp + a rolled weapon and starting item · `15 + d6` silver · entrance table ·
room table (nothing / pit trap / soothsayer / weak / tough / peddler) · d6 hit
rolls vs monster points · weapon damage, armour and Aegis absorption · all weak
and tough monster specials (skeleton/cultist/goblin loot, sorcerer maggot curse,
troll's 7 kill-points, medusa petrification & treasure, basilisk free level-up) ·
fleeing · scrolls (Summon Weak Daemon, Palms Open the Southern Gate, Aegis of
Sorrow, False Omen) · cloak of invisibility · the peddler's buy/sell prices
(buy = sell, everything in the pack sellable) · both level-up triggers (12 rooms
+ 15 points, or 40 silver) and the full d6 boon table including the "halve a
chosen monster's damage" oath · a persistent dungeon map with door choice and
backtracking (d4 ambush chance) · dead-ends and death.

## Dark Forest rules implemented

`6 + d6` hp / silver / rations · rolled weapon (`d6`) with its quirk and a
starting item (`d6`) · the six scrolls · `2d6` hex terrain (9 types, drawn as
terrain backdrops) · the `d6` hex-encounter table (nothing / environmental
hazard / faerie trickster / weak / tough / gnomish tinkerer) · all eleven forest
monsters with their specials (bandit armour, spider swarm growth, griffon blood,
druid vanish-and-return, fungal-zombie rise/spore-death, carnivorous-plant
pollen & leaf-armour, wyvern flight, blood-giant instant level-up) · the natural-1
"monsters always hit" rule · `d6` trails with backtracking · foraging, camping
and the starvation penalty · the `d6` level-up table (every 15 points) · the
`2d6` edge-of-map escape/teleport · and **Barrow/Keep hexes that switch to a
contained `3d6`-room Dark Fort crawl**, retaining HP, silver and level gains on
return (points are not kept), per the rulebook.

## Files

| file | purpose |
|------|---------|
| `index.html` | shared page shell (canvas, hex/dungeon map, sheet, log, actions) |
| `css/darkfort.css` | Mörk Borg styling + a green Dark Forest theme |
| `js/boot.js` | start menu + mode switching (`window.GameMode`) |
| `js/art.js` | Dark Fort canvas art (rooms, doors, monsters, skull) |
| `js/game.js` | Dark Fort rules engine (also runs the Barrow/Keep sub-dungeon) |
| `js/forest-art.js` | Dark Forest canvas art (hex terrains, creatures) |
| `js/forest.js` | Dark Forest hex-crawl engine |
| `test/harness.js` | headless DOM stub that auto-plays both engines to catch bugs |
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
