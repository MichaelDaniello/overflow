const { createCanvas, loadImage } = require('canvas');
const fs = require('fs'), path = require('path'), vm = require('vm');

// load the art engines in a sandbox that exposes window
const sandbox = { Math, console, Object };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['../js/ink.js', '../js/art.js', '../js/forest-art.js'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), sandbox, { filename: f });
const Art = sandbox.DarkFortArt;
const Forest = sandbox.DarkForestArt;

(async () => {
  const skull = await loadImage(path.join(__dirname, '../assets/skull.png'));
  Art.setSkull(skull);
  // preload any supplied creature illustrations so the gallery shows them
  const Ink = sandbox.Ink;
  const dir = path.join(__dirname, '../assets/creatures');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.png'))) {
    const img = await loadImage(path.join(dir, f));
    Ink.preload(path.basename(f, '.png'), img);
  }
  main();
})();

function sheet(items, cols, render, file) {
  const cell = 320, pad = 8;
  const rows = Math.ceil(items.length / cols);
  const W = cols * cell + (cols + 1) * pad, H = rows * cell + (rows + 1) * pad;
  const g = createCanvas(W, H); const gx = g.getContext('2d');
  gx.fillStyle = '#0a0a08'; gx.fillRect(0, 0, W, H);
  items.forEach((it, i) => {
    const c = createCanvas(640, 640);
    render(c, it);
    const x = pad + (i % cols) * (cell + pad), y = pad + Math.floor(i / cols) * (cell + pad);
    gx.drawImage(c, x, y, cell, cell);
    gx.fillStyle = '#ffe600'; gx.font = 'bold 16px sans-serif'; gx.fillText(it.label, x + 6, y + cell - 8);
  });
  fs.writeFileSync(path.join(__dirname, file), g.toBuffer('image/png'));
  console.log('wrote', file);
}

function main() {
  const fortEnc = [
    { art: 'skeleton', tough: false }, { art: 'cultist', tough: false },
    { art: 'goblin', tough: false }, { art: 'hound', tough: false },
    { art: 'sorcerer', tough: true }, { art: 'troll', tough: true },
    { art: 'medusa', tough: true }, { art: 'basilisk', tough: true },
  ];
  sheet(fortEnc.map((m, i) => ({ label: m.art, m, i })), 4,
    (c, it) => Art.render(c, { seed: it.i * 53 + 11, shape: 'Square', doors: 2, encounter: { kind: 'monster', monster: it.m } }),
    'gallery-encounters.png');

  const forestMon = ['wolf', 'bear', 'wildman', 'bandit', 'spiders', 'griffon', 'druid', 'zombie', 'plant', 'wyvern', 'giant'];
  sheet(forestMon.map((art, i) => ({ label: art, art, i })), 4,
    (c, it) => Forest.renderHex(c, { seed: it.i * 41 + 7, terrain: it.i % 2 ? 'Deep forest' : 'Crags', encounter: { kind: 'monster', art: it.art, tough: it.i > 4 } }),
    'gallery-forest.png');

  const t = createCanvas(640, 640); Art.renderTitle(t);
  fs.writeFileSync(path.join(__dirname, 'title.png'), t.toBuffer('image/png'));
  console.log('wrote title.png');
}
