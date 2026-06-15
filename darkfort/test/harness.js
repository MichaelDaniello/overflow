/* Headless smoke-test harness for the Dark Fort engine.
   Stubs just enough DOM + canvas to load art.js and game.js,
   then auto-plays many full runs picking random actions, to
   shake out runtime errors in the rules engine. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeCtx() {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return () => ({ addColorStop: noop });
      if (prop === 'measureText') return () => ({ width: 10 });
      return noop;
    },
    set() { return true; },
  });
  return ctx;
}

class Node {
  constructor(tag) {
    this.tagName = (tag || 'div').toUpperCase();
    this.children = [];
    this._html = '';
    this._handlers = {};
    this.classListSet = new Set();
    this.disabled = false;
    this.style = {};
    this.width = 640; this.height = 640;
    this.classList = {
      add: (c) => this.classListSet.add(c),
      remove: (c) => this.classListSet.delete(c),
      contains: (c) => this.classListSet.has(c),
    };
  }
  set className(v) { this.classListSet = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classListSet].join(' '); }
  set textContent(v) { this._text = v; }
  get textContent() { return this._text; }
  set innerHTML(v) { this._html = v; this.children = []; } // assigning innerHTML replaces all children
  get innerHTML() { return this._html; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(ev, fn) { (this._handlers[ev] = this._handlers[ev] || []).push(fn); }
  click() { (this._handlers.click || []).forEach((f) => f()); }
  getContext() { return makeCtx(); }
  querySelector(sel) { return findIn(this, sel); }
  querySelectorAll(sel) { return collectAll(this, sel); }
}

function collectAll(node, sel) {
  const out = [];
  const want = sel.replace(/^\./, '').replace(/^#/, '');
  const walk = (n) => n.children.forEach((c) => {
    if (sel === 'button' && c.tagName === 'BUTTON') out.push(c);
    else if (c.classListSet && c.classListSet.has(want)) out.push(c);
    walk(c);
  });
  walk(node);
  return out;
}
function findIn(node, sel) { const a = collectAll(node, sel); return a[0] || null; }

// global registry of singleton elements keyed by selector
const registry = {};
const ROOT = new Node('body');
function reg(sel) { return (registry[sel] = registry[sel] || new Node('div')); }

const document = {
  createElement: (tag) => new Node(tag),
  querySelector: (sel) => reg(sel),
  addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') document._dcl = fn; },
};

const sandbox = { document, setTimeout: (f) => { /* skip animations */ }, Math, console, Object };
sandbox.window = sandbox; // in a browser, window IS the global scope
sandbox.globalThis = sandbox;
sandbox.addEventListener = (ev, fn) => { if (ev === 'DOMContentLoaded') sandbox._dcl = fn; };
const windowObj = sandbox;
vm.createContext(sandbox);

for (const file of ['../js/art.js', '../js/game.js']) {
  const code = fs.readFileSync(path.join(__dirname, file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

// boot
(windowObj._dcl || (() => {}))();

reg('#overlay').classList.add('hidden'); // starts hidden, like the HTML
const overlayOpen = () => !reg('#overlay').classList.contains('hidden');
const actions = () => reg('#actions').children.filter((c) => c.tagName === 'BUTTON' && !c.disabled);
const overlayActions = () => overlayOpen()
  ? reg('#overlay-actions').children.filter((c) => c.tagName === 'BUTTON' && !c.disabled)
  : [];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const label = (b) => String(b._html || b._text || '').replace(/\d+/g, '#').trim();
let steps = 0, deaths = 0, retires = 0;
const hist = [];
const labelCounts = {}, titleCounts = {};

// One "run" = play until a YOU DIED / YOU RETIRE overlay appears, then restart.
let restarts = 0;
const start = () => { const b = actions().find((x) => /Enter the Dark Fort/.test(label(x))); if (b) b.click(); };
start();

while (steps < 600000) {
  steps++;
  const ovTitle = reg('#overlay-title')._text;
  if (ovTitle === 'YOU DIED') deaths++;
  if (ovTitle === 'YOU RETIRE') retires++;

  let btn;
  if (overlayOpen()) {
    // a real user can ONLY interact with the modal: its action row
    // plus any in-body choice buttons (e.g. the level-up chooser).
    const bodyBtns = reg('#overlay-body').children
      .flatMap((c) => c.tagName === 'BUTTON' ? [c] : (c.children || []).filter((x) => x.tagName === 'BUTTON'));
    const pool = overlayActions().concat(bodyBtns).filter((b) => !b.disabled);
    btn = pick(pool);
  } else {
    btn = pick(actions());
  }
  if (!btn) break;
  labelCounts[label(btn)] = (labelCounts[label(btn)] || 0) + 1;
  const t = reg('#overlay-title')._text;
  if (t) titleCounts[t] = (titleCounts[t] || 0) + 1;
  hist.push((overlayOpen() ? 'OVL:' : 'ACT:') + label(btn));
  if (hist.length > 12) hist.shift();
  try { btn.click(); }
  catch (e) { console.log('CRASH after sequence:\n' + hist.join('\n')); throw e; }
  if (label(btn) === 'Roll a new rogue' || label(btn) === 'Begin anew') restarts++;
}

console.log('steps:', steps, '| deaths:', deaths, '| retires:', retires, '| restarts:', restarts);
console.log('\nOverlays reached:');
Object.keys(titleCounts).sort().forEach((k) => console.log('  ' + String(titleCounts[k]).padStart(6) + '  ' + k));
console.log('\nActions exercised:');
Object.keys(labelCounts).sort().forEach((k) => console.log('  ' + String(labelCounts[k]).padStart(6) + '  ' + k));
console.log('\nNo runtime errors thrown across', steps, 'action clicks.');
