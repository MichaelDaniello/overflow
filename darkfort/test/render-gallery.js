const { createCanvas, loadImage } = require('canvas');
const fs = require('fs'), path = require('path'), vm = require('vm');

// load art.js in a sandbox that exposes window
const sandbox = { Math, console, Object };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/art.js'),'utf8'), sandbox, {filename:'art.js'});
const Art = sandbox.DarkFortArt;

(async () => {
const skull = await loadImage(path.join(__dirname,'../assets/skull.png'));
Art.setSkull(skull);
main();
})();

function main() {

const shapes = ['Irregular cave','Oval','Cross-shaped','Corridor','Square','Round','Rectangular','Triangular','Skull-shaped'];
const encs = [
  {kind:'monster',monster:{art:'skeleton',tough:false}},
  {kind:'monster',monster:{art:'cultist',tough:false}},
  {kind:'monster',monster:{art:'goblin',tough:false}},
  {kind:'monster',monster:{art:'hound',tough:false}},
  {kind:'monster',monster:{art:'sorcerer',tough:true}},
  {kind:'monster',monster:{art:'troll',tough:true}},
  {kind:'monster',monster:{art:'medusa',tough:true}},
  {kind:'monster',monster:{art:'basilisk',tough:true}},
  {kind:'peddler'},{kind:'soothsayer'},{kind:'trap'},{kind:'item',item:'Potion'},
];

function tile(spec, w=320){
  const c = createCanvas(640,640);
  Art.render(c, spec);
  return c;
}

// Gallery 1: every room shape (with 2 doors + a skeleton so doors/encounter show)
function gallery(items, cols, file, label){
  const cell=320, pad=8;
  const rows=Math.ceil(items.length/cols);
  const W=cols*cell+(cols+1)*pad, H=rows*cell+(rows+1)*pad+30;
  const g=createCanvas(W,H); const gx=g.getContext('2d');
  gx.fillStyle='#0a0a08'; gx.fillRect(0,0,W,H);
  items.forEach((it,i)=>{
    const c=tile(it.spec);
    const x=pad+(i%cols)*(cell+pad), y=pad+Math.floor(i/cols)*(cell+pad);
    gx.drawImage(c,x,y,cell,cell);
    gx.fillStyle='#ffe600'; gx.font='bold 16px sans-serif'; gx.fillText(it.label,x+6,y+cell-8);
  });
  fs.writeFileSync(path.join(__dirname,file), g.toBuffer('image/png'));
  console.log('wrote',file);
}

gallery(shapes.map((sh,i)=>({label:sh,spec:{seed:i*97+3,shape:sh,doors:2,encounter:{kind:'monster',monster:{art:'skeleton'}}}})),3,'gallery-shapes.png');
gallery(encs.map((e,i)=>({label:(e.monster?e.monster.art:e.kind),spec:{seed:i*53+11,shape:'Square',doors:2,encounter:e}})),4,'gallery-encounters.png');

// a title splash
const t=createCanvas(640,640); Art.renderTitle(t);
fs.writeFileSync(path.join(__dirname,'title.png'), t.toBuffer('image/png'));
console.log('wrote title.png');
}
