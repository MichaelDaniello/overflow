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
| `skeleton.png` | Blood-Drenched Skeleton | weak | procedural |
| `cultist.png`  | Catacomb Cultist        | weak | procedural |
| `goblin.png`   | Goblin                  | weak | procedural |
| `hound.png`    | Undead Hound            | weak | procedural |
| `sorcerer.png` | Necro-Sorcerer          | tough | procedural |
| `troll.png`    | Small Stone Troll       | tough | **art provided — needs upload** |
| `medusa.png`   | Medusa                  | tough | **art provided — needs upload** |
| `basilisk.png` | Ruin Basilisk           | tough | procedural |

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
| `zombie.png`  | Fungal Zombie     | tough | **art provided — needs upload** |
| `plant.png`   | Carnivorous Plant | tough | procedural |
| `wyvern.png`  | Wyvern            | tough | procedural |
| `giant.png`   | Blood Giant       | tough | procedural |

The three "art provided" rows map to the images shared in chat
(tombstone-headed undead → `zombie.png`, the medusa → `medusa.png`, the rock
golem → `troll.png`). They still need to be added here as PNG **files**.

Non-monster props (peddler, soothsayer, pit trap, faerie trickster, gnomish
tinkerer) remain procedural for now; the same loader can be pointed at them
later if you want bespoke art there too.
