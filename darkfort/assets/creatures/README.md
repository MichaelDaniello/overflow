# Encounter art — drop-in illustrations

Drop a PNG here named exactly `<key>.png` and it **replaces** the procedural
drawing for that encounter automatically (no code changes). If a file is
absent, the procedural art is used as a fallback.

**Spec for best results:** transparent background, portrait orientation,
roughly 700–1000 px tall, the figure filling most of the frame, high-contrast
grayscale/ink so it reads on the dark scene. (A light/paper background will
show as a pale rectangle — cut it out to transparent.)

## What we need

### DARK FORT — catacomb monsters
| file | creature | tier | status |
|------|----------|------|--------|
| `skeleton.png` | Blood-Drenched Skeleton | weak | ✅ illustration |
| `cultist.png`  | Catacomb Cultist        | weak | ✅ illustration |
| `goblin.png`   | Goblin                  | weak | ✅ illustration |
| `hound.png`    | Undead Hound            | weak | ✅ illustration |
| `sorcerer.png` | Necro-Sorcerer          | tough | ✅ illustration |
| `troll.png`    | Small Stone Troll       | tough | ✅ illustration |
| `medusa.png`   | Medusa                  | tough | ✅ illustration |
| `basilisk.png` | Ruin Basilisk           | tough | ✅ illustration |

### DARK FOREST — wilderness creatures
| file | creature | tier | status |
|------|----------|------|--------|
| `wolf.png`    | Dire Wolf         | weak | procedural |
| `bear.png`    | Ravening Bear     | weak | procedural |
| `wildman.png` | Painted Wildman   | weak | procedural |
| `bandit.png`  | Bandit            | weak | procedural |
| `spiders.png` | Spider Swarm      | weak | procedural |
| `griffon.png` | Griffon           | tough | procedural |
| `druid.png`   | Druid             | tough | procedural |
| `zombie.png`  | Fungal Zombie     | tough | ✅ illustration |
| `plant.png`   | Carnivorous Plant | tough | procedural |
| `wyvern.png`  | Wyvern            | tough | procedural |
| `giant.png`   | Blood Giant       | tough | procedural |

All 8 Dark Fort monsters plus the Dark Forest Fungal Zombie now use supplied
illustrations (processed from the source art in `../` — converted to PNG,
near-white backgrounds knocked out, framed as a parchment-matted plate by the
renderer). The 10 remaining Dark Forest creatures use procedural art until art
files are dropped in here.

Non-monster props (peddler, soothsayer, pit trap, faerie trickster, gnomish
tinkerer) remain procedural for now; the same loader can be pointed at them
later if you want bespoke art there too.
