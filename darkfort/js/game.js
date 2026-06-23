/* ============================================================
   DARK FORT — GAME ENGINE
   ============================================================ */

(function () {
  'use strict';

  /* ── DOM helpers ──────────────────────────────────────── */
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const canvas    = $('#room-canvas');
  const caption   = $('#scene-caption');
  const logBox    = $('#log');
  const actionBox = $('#actions');
  const diceTray  = $('#dice-tray');
  const overlay   = $('#overlay');

  /* ── colour palette (shared with art.js) ─────────────── */
  const COL = DarkFortArt.COL;

  /* ── dice ─────────────────────────────────────────────── */
  const d = (n) => 1 + Math.floor(Math.random() * n);
  const dmg = (sides, bonus = 0, count = 1) => ({ sides, bonus, count });
  function rollDmg(spec) {
    let t = spec.bonus || 0;
    for (let i = 0; i < (spec.count || 1); i++) t += d(spec.sides);
    return Math.max(0, t);
  }
  function dmgLabel(spec) {
    let s = (spec.count > 1 ? spec.count : '') + 'd' + spec.sides;
    if (spec.bonus) s += (spec.bonus > 0 ? '+' : '') + spec.bonus;
    return s;
  }

  /* ── game state ───────────────────────────────────────── */
  let G = null;

  function newGame() {
    const startWeapon = weaponByRoll(d(4));
    G = {
      title: 'KARGUNT',
      hp: 15, maxHp: 15,
      silver: 15 + d(6),
      points: 0,
      roomsExplored: 0,
      weapons: [startWeapon],
      weapon: startWeapon,
      attackBonus: 0,
      inv: { armor: 0, potions: 0, ropes: 0, cloaks: 0 },
      scrolls: [],
      halved: {},
      levelList: [1, 2, 3, 4, 5, 6],
      falseOmen: null,
      room: null,
      combat: null,
      aegisUses: 0,
      catacomb: 1,
      over: false,
      sub: null,
      dungeon: { rooms: [], currentId: -1, nextId: 0, occupied: new Set() },
    };
    grantStartItem(d(4));
  }

  /* ── dungeon graph (compass-aligned) ──────────────────── */
  // doors carry a compass direction so the room art, the door buttons
  // and the map all agree. N=up, E=right, S=down, W=left.
  const DELTA = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
  const DIRNAME = ['north', 'east', 'south', 'west'];
  const opp = (d) => (d + 2) % 4;
  const cellKey = (x, y) => x + ',' + y;

  function dungeonRoom(id) {
    return G.dungeon.rooms.find((r) => r.id === id) || null;
  }

  // create a room reached by venturing parent.dirs[fromExitIdx]; assigns
  // its own forward-door directions to free, reserved neighbour cells.
  function makeDungeonRoom(spec, requestedDoors, fromId, fromExitIdx) {
    const id = G.dungeon.nextId++;
    let pos, backDir = -1;
    if (fromId < 0) {
      pos = { x: 0, y: 0 };
    } else {
      const parent = dungeonRoom(fromId);
      const comingDir = parent.dirs[fromExitIdx];
      pos = { x: parent.mapX + DELTA[comingDir].x, y: parent.mapY + DELTA[comingDir].y };
      backDir = opp(comingDir);
    }
    G.dungeon.occupied.add(cellKey(pos.x, pos.y));

    // pick forward-door directions: not the way back, leading to free cells
    const cand = [0, 1, 2, 3].filter((d) => d !== backDir);
    for (let i = cand.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
    const dirs = [];
    for (const d of cand) {
      if (dirs.length >= requestedDoors) break;
      const nk = cellKey(pos.x + DELTA[d].x, pos.y + DELTA[d].y);
      if (!G.dungeon.occupied.has(nk)) { dirs.push(d); G.dungeon.occupied.add(nk); }
    }

    const room = {
      id, spec, shape: spec.shape, cleared: false,
      exits: Array(dirs.length).fill(null),  // null = unexplored, else room id
      dirs,                                   // compass dir per exit index
      backDir,                                // dir back to parent, or -1
      fromId: fromId >= 0 ? fromId : -1,
      fromExitIdx: fromExitIdx >= 0 ? fromExitIdx : -1,
      mapX: pos.x, mapY: pos.y,
    };
    G.dungeon.rooms.push(room);
    if (fromId >= 0 && fromExitIdx >= 0) {
      const parent = dungeonRoom(fromId);
      if (parent) parent.exits[fromExitIdx] = id;
    }
    G.dungeon.currentId = id;
    spec.doors = dirs.length;     // realized door count (may be < requested)
    return room;
  }

  // door descriptors for the art engine: the back door plus each forward
  // door, tagged with whether it's been explored.
  function doorListFor(room) {
    const list = [];
    if (room.backDir >= 0) list.push({ dir: room.backDir, open: true });
    room.dirs.forEach((d, i) => list.push({ dir: d, open: room.exits[i] !== null }));
    return list;
  }

  /* ── map canvas ───────────────────────────────────────── */
  const MAP_CELL = 38;
  const MAP_ROOM = 22;

  function drawMap() {
    const mc = $('#map-canvas');
    if (!mc) return;
    const ctx = mc.getContext('2d');
    if (!ctx) return;

    if (!G || !G.dungeon || !G.dungeon.rooms.length) {
      mc.width = 640; mc.height = 160;
      ctx.fillStyle = COL.ink;
      ctx.fillRect(0, 0, 640, 160);
      // label
      ctx.fillStyle = '#3a3830';
      ctx.font = 'bold 10px Anton, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MAP WILL BUILD AS YOU EXPLORE', 320, 80);
      ctx.textBaseline = 'alphabetic';
      return;
    }

    const rooms = G.dungeon.rooms;
    const xs = rooms.map((r) => r.mapX);
    const ys = rooms.map((r) => r.mapY);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);

    const PAD = 36;
    const W = mc.width  = Math.max(640, (maxX - minX + 3) * MAP_CELL + PAD * 2);
    const H = mc.height = Math.max(160, (maxY - minY + 3) * MAP_CELL + PAD * 2);

    ctx.fillStyle = COL.ink;
    ctx.fillRect(0, 0, W, H);

    // subtle rock hatch
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x = (i * 73) % W, y = (i * 57) % H, len = 8 + (i * 13) % 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(i) * len, y + Math.sin(i) * len);
      ctx.stroke();
    }

    const toX = (gx) => (gx - minX + 1) * MAP_CELL + PAD;
    const toY = (gy) => (gy - minY + 1) * MAP_CELL + PAD;

    // draw connection lines first (under rooms)
    rooms.forEach((room) => {
      room.exits.forEach((toId) => {
        if (toId === null) return;
        const target = dungeonRoom(toId);
        if (!target) return;
        ctx.strokeStyle = '#504a38';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toX(room.mapX), toY(room.mapY));
        ctx.lineTo(toX(target.mapX), toY(target.mapY));
        ctx.stroke();
      });
    });

    // draw unexplored-exit stubs in their true compass directions
    const DIR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // N,E,S,W on screen
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.5;
    rooms.forEach((room) => {
      if (!room.cleared) return;
      const rx = toX(room.mapX), ry = toY(room.mapY);
      const isCurrent = room.id === G.dungeon.currentId;
      room.dirs.forEach((d, i) => {
        if (room.exits[i] !== null) return;   // explored exits are drawn as lines
        const angle = DIR_ANGLE[d];
        ctx.strokeStyle = isCurrent ? COL.yellow + '88' : '#3a3428';
        ctx.beginPath();
        ctx.moveTo(rx + Math.cos(angle) * (MAP_ROOM / 2 + 2), ry + Math.sin(angle) * (MAP_ROOM / 2 + 2));
        ctx.lineTo(rx + Math.cos(angle) * (MAP_ROOM / 2 + 12), ry + Math.sin(angle) * (MAP_ROOM / 2 + 12));
        ctx.stroke();
      });
    });
    ctx.setLineDash([]);

    // draw rooms
    rooms.forEach((room) => {
      const rx = toX(room.mapX), ry = toY(room.mapY);
      const isCurrent = room.id === G.dungeon.currentId;
      const isEntrance = room.id === 0;
      const half = MAP_ROOM / 2;

      ctx.fillStyle = isCurrent ? COL.yellow : (room.cleared ? '#3a3830' : '#1e1e18');
      ctx.strokeStyle = isCurrent ? COL.yellow : (isEntrance ? COL.pink : '#605a44');
      ctx.lineWidth = isCurrent ? 3 : (isEntrance ? 2 : 1.5);
      ctx.fillRect(rx - half, ry - half, MAP_ROOM, MAP_ROOM);
      ctx.strokeRect(rx - half, ry - half, MAP_ROOM, MAP_ROOM);

      ctx.fillStyle = isCurrent ? COL.black : (room.cleared ? '#a09878' : '#484038');
      ctx.font = 'bold 8px Anton, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isEntrance ? 'E' : String(room.id), rx, ry);
      ctx.textBaseline = 'alphabetic';
    });
  }

  /* ── map click handler ────────────────────────────────── */
  function initMapClicks() {
    const mc = $('#map-canvas');
    if (!mc) return;
    mc.addEventListener('click', (e) => {
      if (window.GameMode && window.GameMode.current !== 'fort' && window.GameMode.current !== 'fort-sub') return;
      if (!G || G.over || G.combat) return;
      if (overlay && !overlay.classList.contains('hidden')) return;
      const current = dungeonRoom(G.dungeon.currentId);
      if (!current || !current.cleared) return;

      const rect = mc.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (mc.width / rect.width);
      const cy = (e.clientY - rect.top)  * (mc.height / rect.height);

      const rooms = G.dungeon.rooms;
      const xs = rooms.map((r) => r.mapX), ys = rooms.map((r) => r.mapY);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const PAD = 36;
      const toX = (gx) => (gx - minX + 1) * MAP_CELL + PAD;
      const toY = (gy) => (gy - minY + 1) * MAP_CELL + PAD;
      const HIT = MAP_ROOM / 2 + 6;

      for (const room of rooms) {
        if (room.id === G.dungeon.currentId) continue;
        if (Math.abs(cx - toX(room.mapX)) <= HIT && Math.abs(cy - toY(room.mapY)) <= HIT) {
          // only navigate to directly connected rooms
          const isChild  = current.exits.includes(room.id);
          const isParent = room.exits.includes(G.dungeon.currentId) || room.id === current.fromId;
          if (isChild || isParent) backtrackToRoom(room.id);
          return;
        }
      }
    });
  }

  /* ── character sheet render ───────────────────────────── */
  function render() {
    if (!G) return;
    $('#cs-name').textContent   = G.title;
    $('#stat-hp').textContent   = Math.max(0, G.hp);
    $('#stat-maxhp').textContent = '/' + G.maxHp;
    $('#stat-silver').textContent = G.silver;
    $('#stat-points').textContent = G.points;
    $('#stat-rooms').textContent  = G.roomsExplored;
    $('#stat-weapon').innerHTML =
      `${G.weapon.name} <small>(${dmgLabel(G.weapon.dmg)}${(G.weapon.atk + G.attackBonus) ? ` /+${G.weapon.atk + G.attackBonus} atk` : ''})</small>`;
    $('#stat-pack').innerHTML = packSummary();
  }

  function packSummary() {
    const p = [];
    if (G.inv.armor)   p.push(`armor×${G.inv.armor}`);
    if (G.inv.potions) p.push(`<span class="good">potion×${G.inv.potions}</span>`);
    if (G.inv.ropes)   p.push(`rope×${G.inv.ropes}`);
    if (G.inv.cloaks)  p.push(`cloak×${G.inv.cloaks}`);
    if (G.weapons.length > 1) p.push(`weapons×${G.weapons.length}`);
    G.scrolls.forEach((s) => p.push(`<span class="good">${s.name}${s.uses > 1 ? ` (${s.uses})` : ''}</span>`));
    return p.length ? p.join(' · ') : '<i>empty</i>';
  }

  function logLine(html, cls) {
    const e = el('div', 'log-entry' + (cls ? ' ' + cls : ''), html);
    logBox.appendChild(e);
    logBox.scrollTop = logBox.scrollHeight;
  }
  function heading(txt) { logLine(txt, 'heading'); }
  function flavor(txt)  { logLine(txt, 'flavor'); }

  function showDice(list) {
    diceTray.innerHTML = '';
    list.forEach((dd) => {
      const node = el('div', 'die' + (dd.color ? ' ' + dd.color : ''));
      node.innerHTML = `<span class="die-tag">${dd.tag}</span>${dd.val}`;
      diceTray.appendChild(node);
    });
  }

  function setCaption(t) { caption.textContent = t; }

  function setActions(list) {
    actionBox.innerHTML = '';
    list.forEach((a) => {
      if (!a) return;
      const b = el('button', 'act' + (a.cls ? ' ' + a.cls : ''), a.label);
      if (a.disabled) b.disabled = true;
      else b.addEventListener('click', a.fn);
      actionBox.appendChild(b);
    });
  }

  function drawRoom() {
    const room = dungeonRoom(G.dungeon.currentId);
    if (room && G.room) G.room.spec.doorList = doorListFor(room);
    DarkFortArt.render(canvas, G.room.spec);
    drawMap();
  }

  function flashHp() {
    document.querySelector('.stat.hp').classList.add('dmg-flash');
    document.querySelector('#scene-frame').classList.add('shake');
    setTimeout(() => {
      document.querySelector('.stat.hp').classList.remove('dmg-flash');
      document.querySelector('#scene-frame').classList.remove('shake');
    }, 450);
  }

  /* ── room shapes & doors ──────────────────────────────── */
  const SHAPE_2D6 = {
    2: 'Irregular cave', 3: 'Oval', 4: 'Cross-shaped', 5: 'Corridor',
    6: 'Square', 7: 'Square', 8: 'Square', 9: 'Round',
    10: 'Rectangular', 11: 'Triangular', 12: 'Skull-shaped',
  };
  function rollShape() {
    const a = d(6), b = d(6);
    return { shape: SHAPE_2D6[a + b], dice: [a, b] };
  }
  function rollDoors() {
    const r = d(4);
    return { n: r === 1 ? 0 : r === 2 ? 1 : 2, roll: r };
  }

  /* ── weapons ──────────────────────────────────────────── */
  function weaponByRoll(r) {
    switch (r) {
      case 1: return { name: 'Warhammer', dmg: dmg(6),    atk: 0 };
      case 2: return { name: 'Dagger',    dmg: dmg(4),    atk: 1 };
      case 3: return { name: 'Sword',     dmg: dmg(6),    atk: 1 };
      default:return { name: 'Flail',     dmg: dmg(6, 1), atk: 0 };
    }
  }

  function grantStartItem(r) {
    switch (r) {
      case 1: G.inv.armor++;   break;
      case 2: G.inv.potions++; break;
      case 3: G.scrolls.push(makeScroll(1)); break;
      default: G.inv.cloaks++; break;
    }
  }

  function makeScroll(r) {
    switch (r) {
      case 1: return { key: 'summon', name: 'Summon Weak Daemon', uses: 1,    eff: 'd6 dmg to one monster' };
      case 2: return { key: 'palms',  name: 'Palms Open the Southern Gate', uses: d(4), eff: 'd6+1 dmg to one monster' };
      case 3: return { key: 'aegis',  name: 'Aegis of Sorrow', uses: d(4),   eff: 'absorb d4 dmg per hit' };
      default:return { key: 'omen',   name: 'False Omen', uses: 1,            eff: 'choose next room result' };
    }
  }

  function addItem(r, silent) {
    switch (r) {
      case 1: { const w = weaponByRoll(d(4)); G.weapons.push(w);
                if (!silent) logLine(`A <b>${w.name}</b> (${dmgLabel(w.dmg)}${w.atk ? ` /+${w.atk} atk` : ''}) lies among the filth. <i>Equip it from your PACK.</i>`); return; }
      case 2: G.inv.potions++; if (!silent) logLine('A <span class="good">potion</span> (heals d6 hp).'); return;
      case 3: G.inv.ropes++;   if (!silent) logLine('A coil of <b>rope</b> (+1 on pit trap rolls).'); return;
      case 4: { const sc = makeScroll(d(4)); G.scrolls.push(sc);
                if (!silent) logLine(`A <span class="good">scroll</span>: <b>${sc.name}</b> — ${sc.eff}${sc.uses > 1 ? ` (${sc.uses} uses)` : ''}.`); return; }
      case 5: G.inv.armor++;   if (!silent) logLine('A suit of <b>armor</b> (absorbs d4 damage per hit).'); return;
      default: G.inv.cloaks++; if (!silent) logLine('A <span class="good">cloak of invisibility</span> (escape combat unharmed).'); return;
    }
  }

  /* ── monsters ─────────────────────────────────────────── */
  function weakMonster() {
    const r = d(4);
    if (r === 1) return mk('BLOOD-DRENCHED SKELETON', 'skeleton', 3, dmg(4), 6, { loot: 'dagger' });
    if (r === 2) return mk('CATACOMB CULTIST',        'cultist',  3, dmg(4), 6, { loot: 'scroll' });
    if (r === 3) return mk('GOBLIN',                  'goblin',   3, dmg(4), 5, { loot: 'rope'   });
    return         mk('UNDEAD HOUND',                 'hound',    4, dmg(4), 6, {});
  }
  function toughMonster() {
    const r = d(4);
    if (r === 1) return mk('NECRO-SORCERER',    'sorcerer', 4, dmg(4),    8,  { tough: true, special: 'sorcerer' });
    if (r === 2) return mk('SMALL STONE TROLL', 'troll',    5, dmg(6, 1), 9,  { tough: true, killPoints: 7 });
    if (r === 3) return mk('MEDUSA',            'medusa',   4, dmg(6),    10, { tough: true, special: 'medusa' });
    return         mk('RUIN BASILISK',          'basilisk', 4, dmg(6),    11, { tough: true, special: 'basilisk' });
  }
  function mk(name, art, points, dspec, hp, extra) {
    return Object.assign({ name, art, points, dmg: dspec, hp, maxHp: hp, tough: false }, extra);
  }

  /* ════════════════════════════════════════════════════════
     GAME FLOW
     ════════════════════════════════════════════════════════ */
  function startTitle() {
    applyFortChrome();
    DarkFortArt.renderTitle(canvas);
    setCaption('DARK FORT');
    logBox.innerHTML = '';
    heading('THE CATACOMB ROGUE ENTERS THE STAGE');
    flavor('A dying world. A bottomless catacomb. One torch, one blade, and the certainty of a bad death. You are Kargunt.');
    diceTray.innerHTML = '';
    G = null;
    drawMap();
    setActions([
      { label: '⚔ Enter the Dark Fort', cls: 'primary', fn: beginRun },
      { label: '‹ Menu', cls: 'ghost', fn: () => window.GameMenu && window.GameMenu() },
    ]);
  }

  function beginRun() {
    newGame();
    applyFortChrome();
    render();
    logBox.innerHTML = '';
    heading('YOU ARE KARGUNT');
    logLine(`You begin with <span class="hit">${G.hp} hp</span>, <span class="gold">${G.silver} silver</span>, a <b>${G.weapon.name}</b> (${dmgLabel(G.weapon.dmg)}${G.weapon.atk ? ` /+${G.weapon.atk} atk` : ''}) and ${describeStartItem()}.`);
    enterEntrance();
  }

  function describeStartItem() {
    if (G.inv.armor)   return 'a suit of <b>armor</b> <small>(absorbs d4 damage per hit)</small>';
    if (G.inv.potions) return 'a <b>potion</b> <small>(heals d6 hp)</small>';
    if (G.scrolls.length) return `a scroll of <b>${G.scrolls[0].name}</b> <small>(${G.scrolls[0].eff})</small>`;
    if (G.inv.cloaks)  return 'a <b>cloak of invisibility</b> <small>(escape combat unharmed)</small>';
    return 'nothing else';
  }

  function enterEntrance() {
    const sh = rollShape();
    const r = d(4);
    const spec = { seed: (Math.random() * 1e9) | 0, shape: sh.shape, doors: r, encounter: { kind: 'nothing' } };

    makeDungeonRoom(spec, r, -1, -1);
    G.room = { spec, explored: false };

    heading('ENTRANCE ROOM');
    showDice([
      { tag: '2d6 SHAPE', val: sh.dice[0] + sh.dice[1], color: 'd-yellow' },
      { tag: 'D4 DOORS',  val: r, color: 'd-pink' },
    ]);
    setCaption(`ENTRANCE · ${sh.shape.toUpperCase()} · ${r} DOOR${r !== 1 ? 'S' : ''}`);
    flavor(`You step into a ${sh.shape.toLowerCase()} chamber where ${r} door${r !== 1 ? 's' : ''} lead${r === 1 ? 's' : ''} deeper into the dark.`);

    if (r === 1) {
      const item = d(6);
      G.room.spec.encounter = encForItem(item);
      drawRoom();
      logLine('You find a random item among the rubble.');
      addItem(item);
      finishRoom();
    } else if (r === 2) {
      const m = weakMonster();
      G.room.spec.encounter = { kind: 'monster', monster: { art: m.art, tough: false } };
      drawRoom();
      logLine('A <span class="hit">WEAK MONSTER</span> stands guard. <b>Attack!</b>');
      startCombat(m);
    } else if (r === 3) {
      const sc = makeScroll(d(4));
      G.scrolls.push(sc);
      G.room.spec.encounter = { kind: 'scroll' };
      drawRoom();
      logLine(`A dying mystic presses a scroll into your hand: <b>${sc.name}</b> — ${sc.eff}${sc.uses > 1 ? ` (${sc.uses} uses)` : ''}.`);
      finishRoom();
    } else {
      G.room.spec.encounter = { kind: 'nothing' };
      drawRoom();
      flavor('The entrance is eerily quiet and desolate.');
      finishRoom();
    }
    render();
  }

  function encForItem(item) {
    const names = { 1: 'Weapon', 2: 'Potion', 3: 'Rope', 4: 'Scroll', 5: 'Armor', 6: 'Cloak' };
    if (item === 4) return { kind: 'scroll' };
    return { kind: 'item', item: names[item] };
  }

  /* ── venturing through a specific door ────────────────── */
  function ventureThruDoor(exitIdx) {
    const current = dungeonRoom(G.dungeon.currentId);
    if (!current) return;
    if (current.exits[exitIdx] !== null) {
      backtrackToRoom(current.exits[exitIdx]);
      return;
    }
    enterRoom(G.dungeon.currentId, exitIdx);
  }

  function enterRoom(fromId, fromExitIdx) {
    const sh = rollShape();
    const doors = rollDoors();
    let result;
    if (G.falseOmen != null) { result = G.falseOmen; G.falseOmen = null; }
    else result = d(6);

    const spec = { seed: (Math.random() * 1e9) | 0, shape: sh.shape, doors: doors.n, encounter: { kind: 'nothing' } };
    makeDungeonRoom(spec, doors.n, fromId, fromExitIdx);
    G.room = { spec, explored: false };

    heading('A NEW ROOM');
    showDice([
      { tag: '2d6 SHAPE', val: sh.dice[0] + sh.dice[1], color: 'd-yellow' },
      { tag: 'D4 DOORS',  val: doors.roll, color: 'd-pink' },
      { tag: 'D6 ROOM',   val: result },
    ]);
    setCaption(`${sh.shape.toUpperCase()} · ${doors.n} DOOR${doors.n !== 1 ? 'S' : ''}`);
    flavor(`A ${sh.shape.toLowerCase()} room opens before you, with ${doors.n === 0 ? 'no further doors' : doors.n + ' door' + (doors.n !== 1 ? 's' : '')}.`);

    resolveRoom(result);
    render();
  }

  function resolveRoom(result) {
    switch (result) {
      case 1:
        G.room.spec.encounter = { kind: 'nothing' };
        drawRoom();
        logLine('<b>Nothing.</b> Dust, bones, and the smell of old death. The room is explored.');
        finishRoom();
        break;
      case 2: {
        G.room.spec.encounter = { kind: 'trap' };
        drawRoom();
        heading('PIT TRAP');
        const r = d(6);
        const bonus = G.inv.ropes > 0 ? 1 : 0;
        const total = r + bonus;
        showDice([{ tag: 'D6 TRAP', val: r, color: 'd-pink' }].concat(bonus ? [{ tag: 'ROPE', val: '+1', color: 'd-yellow' }] : []));
        if (total <= 3) {
          const dm = d(6);
          logLine(`The floor gives way! You take <span class="hit">${dm} damage</span>.${bonus ? ' (rope softened the fall)' : ''}`);
          damagePlayer(dm);
          if (G.over) return;
        } else {
          logLine(`You catch yourself at the brink${bonus ? ', rope in hand' : ''}. Unharmed.`);
        }
        finishRoom();
        break;
      }
      case 3: {
        G.room.spec.encounter = { kind: 'soothsayer' };
        drawRoom();
        heading('RIDDLING SOOTHSAYER');
        flavor('A hooded thing rasps a riddle through a mouth full of teeth.');
        const r = d(6);
        showDice([{ tag: 'D6 RIDDLE', val: r, color: r % 2 ? 'd-yellow' : 'd-pink' }]);
        if (r % 2 === 1) {
          logLine('You unravel the riddle. Choose your reward:');
          setActions([
            { label: '◈ Take 10 silver', cls: 'primary', fn: () => { G.silver += 10; logLine('<span class="gold">+10 silver.</span>'); render(); finishRoom(); } },
            { label: '◈ Take 3 points',  fn: () => { G.points += 3; logLine('<span class="good">+3 points.</span>'); render(); finishRoom(); } },
          ]);
        } else {
          const dm = d(4);
          logLine(`Wrong. A mind-shattering shockwave deals <span class="hit">${dm} damage</span> (ignoring armor).`);
          damagePlayer(dm);
          if (!G.over) finishRoom();
        }
        break;
      }
      case 4: {
        const m = weakMonster();
        G.room.spec.encounter = { kind: 'monster', monster: { art: m.art, tough: false } };
        drawRoom();
        heading('A WEAK MONSTER');
        startCombat(m);
        break;
      }
      case 5: {
        const m = toughMonster();
        G.room.spec.encounter = { kind: 'monster', monster: { art: m.art, tough: true } };
        drawRoom();
        heading('A TOUGH MONSTER');
        startCombat(m);
        break;
      }
      default:
        G.room.spec.encounter = { kind: 'peddler' };
        drawRoom();
        heading('A PEDDLER FROM BEYOND THE VOID');
        flavor('It trades trinkets and steel for blood-soaked coins.');
        openShop();
    }
  }

  function finishRoom() {
    if (G.over) return;
    const dRoom = dungeonRoom(G.dungeon.currentId);
    if (dRoom && !dRoom.cleared) dRoom.cleared = true;
    if (G.room && !G.room.explored) {
      G.room.explored = true;
      G.roomsExplored++;
      if (G.sub) G.sub.roomsDone = (G.sub.roomsDone || 0) + 1;
    }
    render();
    drawMap();
    if (checkLevelUp()) return;
    presentRoomActions();
  }

  /* ── navigation actions ───────────────────────────────── */
  function presentRoomActions() {
    // barrow/keep sub-dungeon: bail out to the forest once the
    // rolled room budget is spent.
    if (G.sub && (G.sub.roomsDone || 0) >= G.sub.maxRooms) { subComplete(); return; }

    const current = dungeonRoom(G.dungeon.currentId);
    if (!current) { setActions([]); return; }

    const unexploredExits = current.exits
      .map((e, i) => (e === null ? i : -1))
      .filter((i) => i >= 0);

    // True dead end: no unexplored exits anywhere in the whole dungeon
    const globalUnexplored = G.dungeon.rooms.some((r) => r.cleared && r.exits.some((e) => e === null));
    if (unexploredExits.length === 0 && !globalUnexplored) {
      if (G.sub) { subComplete(); return; }
      setActions([
        { label: '☠ No doors remain — your tomb awaits', cls: 'danger',
          fn: () => die('No door. No way on. The catacomb becomes your tomb. <b>Your adventure is over.</b>', 'deadend') },
        { label: '☰ Pack', cls: 'ghost', fn: openInventory },
      ]);
      return;
    }

    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const acts = [];
    // venture through each unexplored door, labelled by its compass direction
    unexploredExits.forEach((exitIdx) => {
      const dir = current.dirs[exitIdx];
      acts.push({
        label: `⛧ ${cap(DIRNAME[dir])} door`,
        cls: 'primary',
        fn: () => ventureThruDoor(exitIdx),
      });
    });

    // backtrack through any explored connection (forward doors + the way back)
    const conns = [];
    current.exits.forEach((toId, i) => { if (toId !== null) conns.push({ id: toId, dir: current.dirs[i] }); });
    if (current.fromId >= 0 && current.backDir >= 0) conns.push({ id: current.fromId, dir: current.backDir });
    conns.forEach((c) => {
      const r = dungeonRoom(c.id);
      if (!r) return;
      const what = c.id === 0 ? 'entrance' : r.shape.toLowerCase();
      acts.push({ label: `← ${cap(DIRNAME[c.dir])}: ${what}`, cls: 'ghost', fn: () => backtrackToRoom(c.id) });
    });

    acts.push({ label: '☰ Pack', cls: 'ghost', fn: openInventory });
    if (hasOmen() && unexploredExits.length > 0) {
      acts.push({ label: '👁 False Omen (pick room)', fn: castOmenRoom });
    }
    setActions(acts);
  }

  /* ── backtracking to an explored room ─────────────────── */
  function backtrackToRoom(targetId) {
    const target = dungeonRoom(targetId);
    if (!target) return;

    G.dungeon.currentId = targetId;
    G.room = { spec: target.spec, explored: true };
    target.spec.doorList = doorListFor(target);

    DarkFortArt.render(canvas, target.spec);
    drawMap();

    const roomLabel = targetId === 0 ? 'entrance' : target.shape.toLowerCase();
    heading(`RETURN: ${roomLabel.toUpperCase()}`);
    setCaption(`${target.shape.toUpperCase()} · REVISITED`);

    // d4 danger roll: 1 = weak monster ambush
    const r = d(4);
    showDice([{ tag: 'D4 DANGER', val: r, color: r === 1 ? 'd-pink' : 'd-yellow' }]);

    if (r === 1) {
      const m = weakMonster();
      const ambushSpec = Object.assign({}, target.spec, {
        encounter: { kind: 'monster', monster: { art: m.art, tough: false } },
      });
      DarkFortArt.render(canvas, ambushSpec);
      logLine(`You slip back through the ${roomLabel}. Something has moved in — a <span class="hit">WEAK MONSTER</span>!`);
      startCombat(m);
    } else {
      logLine(`You slip back through the ${roomLabel}. The room is undisturbed.`);
      flavor('Dust settles. The dark breathes.');
      render();
      presentRoomActions();
    }
  }

  /* ════════════════════════════════════════════════════════
     COMBAT
     ════════════════════════════════════════════════════════ */
  function startCombat(m) {
    G.combat = { monster: m, sorcererHits: 0 };
    logLine(`<b>${m.name}</b> — ${m.points} points, ${dmgLabel(m.dmg)} damage, ${m.hp} hp.`);
    if (G.halved[m.name]) logLine('<i>(Your old nemesis — its damage is halved.)</i>');
    combatActions();
    render();
  }

  function combatActions() {
    const m = G.combat.monster;
    const acts = [
      { label: '⚔ Attack', cls: 'primary', fn: attackRound },
      { label: 'Flee (d4 dmg)', cls: 'danger', fn: flee },
    ];
    if (G.inv.potions > 0) acts.push({ label: `Drink potion (${G.inv.potions})`, fn: () => { drinkPotion(); combatActions(); } });
    if (G.inv.cloaks  > 0) acts.push({ label: `Cloak away (${G.inv.cloaks})`,  cls: 'ghost', fn: cloakEscape });
    G.scrolls.forEach((s, i) => {
      if (s.key === 'palms')  acts.push({ label: `Cast Palms (${s.uses})`, fn: () => castPalms(i) });
      if (s.key === 'summon') acts.push({ label: 'Summon Daemon', fn: () => castSummon(i) });
      if (s.key === 'aegis' && G.aegisUses === 0) acts.push({ label: `Raise Aegis (${s.uses})`, fn: () => castAegis(i) });
    });
    setActions(acts);
  }

  function attackRound() {
    if (!G.combat) return;
    const m = G.combat.monster;
    const hitRoll = d(6);
    const atkBonus = G.weapon.atk + G.attackBonus;
    const total = hitRoll + atkBonus;
    const dice = [{ tag: 'D6 HIT', val: hitRoll, color: total >= m.points ? 'd-yellow' : 'd-pink' }];
    if (atkBonus) dice.push({ tag: 'ATK', val: '+' + atkBonus, color: 'd-yellow' });

    if (total >= m.points) {
      const dm = rollDmg(G.weapon.dmg);
      dice.push({ tag: 'DMG', val: dm });
      m.hp -= dm;
      showDice(dice);
      logLine(`You strike (${total} ≥ ${m.points}) for <span class="good">${dm}</span>. ${m.name} at ${Math.max(0, m.hp)} hp.`);
      if (m.hp <= 0) { monsterSlain(); return; }
    } else {
      showDice(dice);
      monsterHits(`You swing and miss (${total} < ${m.points}).`);
      if (G.over) return;
    }
    render();
    combatActions();
  }

  function monsterHits(prefix) {
    const m = G.combat.monster;
    let raw, tag = dmgLabel(m.dmg);
    if (m.special === 'sorcerer') {
      G.combat.sorcererHits++;
      if (G.combat.sorcererHits % 2 === 0) { raw = d(6); tag = 'DEATH-RAY d6'; }
      else raw = rollDmg(m.dmg);
    } else {
      raw = rollDmg(m.dmg);
    }
    if (G.halved[m.name]) raw = Math.floor(raw / 2);

    let dm = raw, note = '';
    if (G.inv.armor   > 0) { const a = d(4); dm = Math.max(0, dm - a); note += ` armor −${a};`; }
    if (G.aegisUses   > 0) { const a = d(4); dm = Math.max(0, dm - a); G.aegisUses--; note += ` aegis −${a};`; }
    logLine(`${prefix} <span class="hit">${m.name} hits you (${tag})</span> for <span class="hit">${dm}</span>.${note ? ' (' + note.trim() + ')' : ''}`);
    damagePlayer(dm);
  }

  function damagePlayer(amount) {
    G.hp -= amount;
    if (amount > 0) flashHp();
    render();
    if (G.hp <= 0) die('Your wounds open and the dark drinks you down. <b>Kargunt is dead.</b>');
  }

  function monsterSlain() {
    const m = G.combat.monster;
    const earned = m.killPoints || m.points;
    G.points += earned;
    heading('SLAIN');
    logLine(`<b>${m.name}</b> falls. You earn <span class="good">${earned} points</span>.`);

    if (m.loot === 'dagger' && d(6) <= 2) { const w = weaponByRoll(2); G.weapons.push(w); logLine('You loot a <b>dagger</b> from the bones. <i>(Equip from PACK.)</i>'); }
    if (m.loot === 'scroll' && d(6) <= 2) { const sc = makeScroll(d(4)); G.scrolls.push(sc); logLine(`You loot a scroll: <b>${sc.name}</b>.`); }
    if (m.loot === 'rope'   && d(6) <= 2) { G.inv.ropes++; logLine('It was carrying a <b>rope</b>.'); }

    let leveledByBasilisk = false;
    if (m.special === 'sorcerer') {
      const s = rollDmg(dmg(6, 0, 3));
      G.silver += s;
      logLine(`<span class="gold">Loot: ${s} silver (3d6).</span>`);
      if (d(6) === 1) { G.combat = null; render(); die('The sorcerer\'s last curse takes hold — you are <b>transformed into a maggot</b>. Your adventure ends here.', 'maggot'); return; }
    } else if (m.special === 'medusa') {
      const s = d(4) * d(6);
      G.silver += s;
      logLine(`<span class="gold">A nearby chest holds ${s} silver (d4×d6).</span>`);
      if (d(6) === 1) { G.combat = null; render(); die('You meet the dead gaze too long — you are <b>petrified</b>. Your adventure ends here.', 'stone'); return; }
    } else if (m.special === 'basilisk') {
      if (d(6) <= 2) { leveledByBasilisk = true; logLine('<span class="good">The basilisk\'s death-throes flood you with power — you LEVEL UP!</span>'); }
    }

    G.combat = null;
    const dRoom = dungeonRoom(G.dungeon.currentId);
    if (dRoom && !dRoom.cleared) dRoom.cleared = true;
    if (G.room && !G.room.explored) { G.room.explored = true; G.roomsExplored++; if (G.sub) G.sub.roomsDone = (G.sub.roomsDone || 0) + 1; }
    render();
    drawMap();
    if (leveledByBasilisk) { doLevelUp('basilisk'); return; }
    if (checkLevelUp()) return;
    presentRoomActions();
  }

  function flee() {
    if (!G.combat) return;
    const dm = d(4);
    showDice([{ tag: 'D4 FLEE', val: dm, color: 'd-pink' }]);
    logLine(`You flee, taking <span class="hit">${dm} damage</span>. The room is left unexplored.`);
    G.combat = null;
    damagePlayer(dm);
    if (G.over) return;
    render();
    presentRoomActions();
  }

  function cloakEscape() {
    if (!G.combat) return;
    G.inv.cloaks--;
    logLine('You melt into shadow with the <span class="good">cloak of invisibility</span> and slip away unharmed. The room is left unexplored.');
    G.combat = null;
    render();
    presentRoomActions();
  }

  function drinkPotion() {
    if (G.inv.potions <= 0) return;
    G.inv.potions--;
    const h = d(6);
    G.hp = Math.min(G.maxHp, G.hp + h);
    showDice([{ tag: 'D6 HEAL', val: h, color: 'd-yellow' }]);
    logLine(`You drink a potion and recover <span class="good">${h} hp</span>.`);
    render();
  }

  function castPalms(i) {
    if (!G.combat) return;
    const s = G.scrolls[i];
    const m = G.combat.monster;
    const dm = d(6) + 1;
    m.hp -= dm;
    s.uses--;
    showDice([{ tag: 'PALMS d6+1', val: dm, color: 'd-pink' }]);
    logLine(`<span class="good">Palms Open the Southern Gate</span> — searing light deals <span class="good">${dm}</span> to ${m.name}.`);
    if (s.uses <= 0) G.scrolls.splice(i, 1);
    if (m.hp <= 0) { monsterSlain(); return; }
    render(); combatActions();
  }

  function castSummon(i) {
    if (!G.combat) return;
    const m = G.combat.monster;
    const dm = d(6);
    m.hp -= dm;
    G.scrolls.splice(i, 1);
    showDice([{ tag: 'DAEMON d6', val: dm, color: 'd-pink' }]);
    logLine(`<span class="good">A weak daemon</span> claws out of the floor and rends ${m.name} for <span class="good">${dm}</span>.`);
    if (m.hp <= 0) { monsterSlain(); return; }
    render(); combatActions();
  }

  function castAegis(i) {
    if (!G.combat) return;
    const s = G.scrolls[i];
    G.aegisUses += s.uses;
    logLine(`<span class="good">Aegis of Sorrow</span> rises — the next ${s.uses} blow${s.uses !== 1 ? 's' : ''} take −d4 damage.`);
    G.scrolls.splice(i, 1);
    render(); combatActions();
  }

  /* ════════════════════════════════════════════════════════
     SHOP
     ════════════════════════════════════════════════════════ */
  const SHOP = [
    { name: 'Potion (heals d6 hp)',        price: 4,  buy: () => G.inv.potions++ },
    { name: 'Random scroll',               price: 7,  buy: () => G.scrolls.push(makeScroll(d(4))) },
    { name: 'Dagger (d4 /+1 atk)',         price: 6,  buy: () => G.weapons.push(weaponByRoll(2)) },
    { name: 'Rope (+1 trap roll)',          price: 5,  buy: () => G.inv.ropes++ },
    { name: 'Warhammer (d6)',              price: 9,  buy: () => G.weapons.push(weaponByRoll(1)) },
    { name: 'Sword (d6 /+1 atk)',          price: 12, buy: () => G.weapons.push(weaponByRoll(3)) },
    { name: 'Flail (d6+1)',               price: 15, buy: () => G.weapons.push(weaponByRoll(4)) },
    { name: 'Mighty Zweihänder (d6+2)',   price: 25, buy: () => G.weapons.push({ name: 'Mighty Zweihänder', dmg: dmg(6, 2), atk: 0 }) },
    { name: 'Armor (absorbs d4 damage)',   price: 10, buy: () => G.inv.armor++ },
    { name: 'Cloak of invisibility',       price: 15, buy: () => G.inv.cloaks++ },
  ];

  // the peddler buys back at the same price it sells for
  const PRICE = { potion: 4, rope: 5, armor: 10, cloak: 15, scroll: 7 };
  const WEAPON_PRICE = { 'Warhammer': 9, 'Dagger': 6, 'Sword': 12, 'Flail': 15, 'Mighty Zweihänder': 25 };
  function weaponPrice(w) { return WEAPON_PRICE[w.name] != null ? WEAPON_PRICE[w.name] : 6; }

  function openShop() {
    openOverlay('THE PEDDLER', '', () => {});
    renderShop();
  }

  function renderShop() {
    const body = $('#overlay-body');
    body.innerHTML = `<p class="flavor">"Blood-soaked coin only, wanderer."</p>
      <p><span class="gold">You hold ${G.silver} silver.</span></p>`;

    SHOP.forEach((item) => {
      const row = el('div', 'shop-row');
      row.innerHTML = `<span class="nm">${item.name}</span><span class="pr">${item.price}s</span>`;
      const b = el('button', 'act', 'Buy');
      if (G.silver < item.price) b.disabled = true;
      else b.addEventListener('click', () => {
        G.silver -= item.price; item.buy(); render();
        logLine(`Bought <b>${item.name}</b> for <span class="gold">${item.price}s</span>.`);
        renderShop();
      });
      row.appendChild(b);
      body.appendChild(row);
    });

    // sell back everything you carry — gear, scrolls and weapons
    // (equipped included) — at the same price the peddler charges.
    const sellables = [];
    if (G.inv.potions) sellables.push({ nm: `Potion ×${G.inv.potions}`,  val: PRICE.potion, take: () => G.inv.potions-- });
    if (G.inv.ropes)   sellables.push({ nm: `Rope ×${G.inv.ropes}`,      val: PRICE.rope,   take: () => G.inv.ropes-- });
    if (G.inv.armor)   sellables.push({ nm: `Armor ×${G.inv.armor}`,     val: PRICE.armor,  take: () => G.inv.armor-- });
    if (G.inv.cloaks)  sellables.push({ nm: `Cloak of invisibility ×${G.inv.cloaks}`, val: PRICE.cloak, take: () => G.inv.cloaks-- });
    G.scrolls.forEach((sc, i) => {
      sellables.push({ nm: `${sc.name}${sc.uses > 1 ? ` (${sc.uses})` : ''}`, val: PRICE.scroll, take: () => G.scrolls.splice(i, 1) });
    });
    // every weapon is sellable, equipped or not, as long as one remains
    G.weapons.forEach((w, i) => {
      const equipped = w === G.weapon;
      sellables.push({
        nm: `${w.name}${equipped ? ' ◀' : ''}`,
        val: weaponPrice(w),
        disabled: G.weapons.length <= 1,   // never leave yourself unarmed
        take: () => {
          G.weapons.splice(i, 1);
          if (G.weapon === w) G.weapon = G.weapons[0];
        },
      });
    });

    if (sellables.length) {
      body.appendChild(el('p', null, '<b>Sell:</b>'));
      sellables.forEach((s) => {
        const row = el('div', 'shop-row');
        row.innerHTML = `<span class="nm">${s.nm}</span><span class="pr">+${s.val}s</span>`;
        const b = el('button', 'act', 'Sell');
        if (s.disabled) b.disabled = true;
        else b.addEventListener('click', () => {
          s.take(); G.silver += s.val; render();
          logLine(`Sold <b>${s.nm.replace(/ ◀$/, '')}</b> for <span class="gold">${s.val}s</span>.`);
          renderShop();
        });
        row.appendChild(b);
        body.appendChild(row);
      });
    }

    setOverlayActions([{ label: 'Leave the stall', cls: 'primary', fn: () => {
      closeOverlay();
      logLine('The peddler dissolves into smoke. The room is explored.');
      finishRoom();
    } }]);
  }

  /* ════════════════════════════════════════════════════════
     INVENTORY
     ════════════════════════════════════════════════════════ */
  function openInventory() {
    openOverlay('YOUR PACK', '', () => {});
    const body = $('#overlay-body');
    body.innerHTML = '';

    body.appendChild(el('p', null, '<b>WEAPONS</b>'));
    G.weapons.forEach((w) => {
      const row = el('div', 'shop-row');
      const equipped = w === G.weapon;
      row.innerHTML = `<span class="nm">${w.name}${equipped ? ' ◀' : ''} <small>(${dmgLabel(w.dmg)}${w.atk ? ` /+${w.atk} atk` : ''})</small></span>`;
      if (!equipped) {
        const b = el('button', 'act', 'Wield');
        b.addEventListener('click', () => { G.weapon = w; render(); openInventory(); });
        row.appendChild(b);
      }
      body.appendChild(row);
    });

    const gearItems = [];
    if (G.inv.armor)   gearItems.push(`Armor <small class="cs-v">×${G.inv.armor} — absorbs d4 damage per hit</small>`);
    if (G.inv.potions) gearItems.push(`Potion <small class="cs-v">×${G.inv.potions} — heals d6 hp</small>`);
    if (G.inv.ropes)   gearItems.push(`Rope <small class="cs-v">×${G.inv.ropes} — +1 on pit trap rolls</small>`);
    if (G.inv.cloaks)  gearItems.push(`Cloak <small class="cs-v">×${G.inv.cloaks} — escape combat unharmed (one charge each)</small>`);
    body.appendChild(el('p', null,
      `<b>GEAR</b><br>${gearItems.length ? gearItems.join('<br>') : '<i>none</i>'}`));

    if (G.scrolls.length) {
      const lines = G.scrolls.map((s) =>
        `${s.name}${s.uses > 1 ? ` (${s.uses} uses)` : ''} <small class="cs-v">— ${s.eff}</small>`);
      body.appendChild(el('p', null, `<b>SCROLLS</b><br>${lines.join('<br>')}`));
    }

    const acts = [];
    if (G.inv.potions > 0 && G.hp < G.maxHp) {
      acts.push({ label: 'Drink potion', cls: 'primary', fn: () => { drinkPotion(); openInventory(); } });
    }
    acts.push({ label: 'Close', fn: closeOverlay });
    setOverlayActions(acts);
  }

  /* ════════════════════════════════════════════════════════
     FALSE OMEN
     ════════════════════════════════════════════════════════ */
  function hasOmen() { return G.scrolls.some((s) => s.key === 'omen'); }

  function castOmenRoom() {
    const idx = G.scrolls.findIndex((s) => s.key === 'omen');
    if (idx < 0) return;
    const current = dungeonRoom(G.dungeon.currentId);
    const unexploredExits = current
      ? current.exits.map((e, i) => (e === null ? i : -1)).filter((i) => i >= 0)
      : [];
    if (!unexploredExits.length) return;

    openOverlay('FALSE OMEN', '<p class="flavor">You bend fate. Choose what the next room holds.</p>', () => {});
    const labels = ['Nothing', 'Pit trap', 'Soothsayer', 'Weak monster', 'Tough monster', 'Peddler'];
    setOverlayActions(labels.map((lab, i) => ({
      label: `${i + 1}. ${lab}`,
      cls: i === 5 ? 'primary' : '',
      fn: () => {
        G.scrolls.splice(idx, 1);
        G.falseOmen = i + 1;
        closeOverlay();
        render();
        ventureThruDoor(unexploredExits[0]);
      },
    })));
  }

  /* ════════════════════════════════════════════════════════
     LEVEL UP
     ════════════════════════════════════════════════════════ */
  function checkLevelUp() {
    // Inside a barrow/keep detour the rambler's own silver and points
    // ride along; don't let Dark Fort's silver/room triggers fire off
    // them (that would burn 40 forest silver and leak boons). A barrow
    // can still grant a retained level-up via the basilisk's special,
    // which calls doLevelUp directly.
    if (G.sub) return false;
    if (G.levelList.length === 0) return false;
    if (G.roomsExplored >= 12 && G.points >= 15) { doLevelUp('points'); return true; }
    if (G.silver >= 40) { doLevelUp('silver'); return true; }
    return false;
  }

  function doLevelUp(via) {
    let how = '';
    if (via === 'points')   { G.points = 0; G.roomsExplored = 0; how = 'You have braved 12 rooms and earned glory. (Points reset; a fresh catacomb beckons.)'; }
    else if (via === 'silver')   { G.silver -= 40; how = 'You return 40 silver to the poor of the ruined Wästland homes.'; }
    else if (via === 'basilisk') { how = 'The basilisk\'s death-magic hurls you to a higher station.'; }
    render();

    let roll;
    do { roll = d(6); } while (!G.levelList.includes(roll));
    G.levelList = G.levelList.filter((x) => x !== roll);

    const eff = applyLevelEffect(roll);
    heading('LEVEL UP');
    openOverlay('LEVEL UP',
      `<p>${how}</p><p>You roll a <span class="die-inline">${roll}</span> on the boons table:</p><p><b>${eff.title}</b></p><p class="flavor">${eff.text}</p>`,
      () => {}, 'level');

    if (eff.chooser) {
      eff.chooser();
    } else {
      setOverlayActions([{ label: G.levelList.length ? 'Onward' : 'Retire a legend', cls: 'primary', fn: () => {
        closeOverlay();
        if (G.levelList.length === 0) { winGame(); return; }
        render();
        presentRoomActions();
      } }]);
    }
    render();
  }

  function applyLevelEffect(roll) {
    switch (roll) {
      case 1:
        G.title = (Math.random() < 0.5 ? 'SIR ' : 'LADY ') + 'KARGUNT';
        return { title: 'Knighted!', text: 'You may call yourself sir or lady Kargunt. But a name or title won\'t save you.' };
      case 2:
        G.attackBonus += 1;
        return { title: '+1 to attack', text: 'From now on add +1 when attacking monsters.' };
      case 3:
        G.maxHp += 5; G.hp += 5;
        return { title: 'Hardier flesh', text: 'Your maximum hit points increase by +5 (now ' + G.maxHp + ').' };
      case 4:
        G.inv.potions += 5;
        return { title: 'Five potions', text: 'A not-very-occult herbmaster salutes your endeavors and gives you 5 potions.' };
      case 5:
        G.weapons.push({ name: 'Mighty Zweihänder', dmg: dmg(6, 2), atk: 0 });
        return { title: 'Mighty Zweihänder', text: 'You find a MIGHTY ZWEIHÄNDER (d6+2 damage). Equip it from your PACK.' };
      default:
        return { title: 'Sworn foes', text: 'Choose one WEAK and one TOUGH monster — from now on their damage is halved.', chooser: chooseHalved };
    }
  }

  function chooseHalved() {
    const weak  = ['BLOOD-DRENCHED SKELETON', 'CATACOMB CULTIST', 'GOBLIN', 'UNDEAD HOUND'];
    const tough = ['NECRO-SORCERER', 'SMALL STONE TROLL', 'MEDUSA', 'RUIN BASILISK'];
    let pickWeak = null, tWrapPick = null;
    const body = $('#overlay-body');
    const wWrap = el('div'); wWrap.innerHTML = '<p><b>Weak monster:</b></p>';
    const tWrap = el('div'); tWrap.innerHTML = '<p><b>Tough monster:</b></p>';
    body.appendChild(wWrap); body.appendChild(tWrap);
    const finish = () => {
      setOverlayActions([{ label: 'Seal the oath', cls: 'primary', disabled: !(pickWeak && tWrapPick),
        fn: () => {
          G.halved[pickWeak] = true; G.halved[tWrapPick] = true;
          logLine(`<span class="good">${pickWeak}</span> and <span class="good">${tWrapPick}</span> will forever deal halved damage to you.`);
          closeOverlay();
          if (G.levelList.length === 0) { winGame(); return; }
          render(); presentRoomActions();
        } }]);
    };
    weak.forEach((nm) => {
      const b = el('button', 'act', nm);
      b.addEventListener('click', () => { pickWeak = nm; markChosen(wWrap, b); finish(); });
      wWrap.appendChild(b);
    });
    tough.forEach((nm) => {
      const b = el('button', 'act', nm);
      b.addEventListener('click', () => { tWrapPick = nm; markChosen(tWrap, b); finish(); });
      tWrap.appendChild(b);
    });
    finish();
  }
  function markChosen(wrap, btn) {
    wrap.querySelectorAll('button').forEach((x) => x.classList.remove('primary'));
    btn.classList.add('primary');
  }

  /* ════════════════════════════════════════════════════════
     ENDINGS
     ════════════════════════════════════════════════════════ */
  function die(msg, kind) {
    if (G.over) return;
    // inside a barrow/keep detour, death is reported back to the forest
    if (G.sub) { G.over = true; G.combat = null; finishSub(true, msg); return; }
    G.over = true;
    G.combat = null;
    render();
    heading('DEATH');
    logLine(msg);
    openOverlay('YOU DIED',
      `<img class="death-skull" src="assets/skull.png" alt="">
       <p>${msg}</p>
       <p>Rooms explored: <b>${G.roomsExplored}</b> · Points: <b>${G.points}</b> · Silver: <b>${G.silver}</b> · Catacomb: <b>${G.catacomb}</b></p>
       <p class="flavor">Everything you knew blackens and burns.</p>`,
      () => {}, 'death');
    setOverlayActions([
      { label: '☠ Roll a new rogue', cls: 'primary', fn: () => { closeOverlay(); startTitle(); } },
      { label: '‹ Menu', cls: 'ghost', fn: () => { closeOverlay(); window.GameMenu && window.GameMenu(); } },
    ]);
  }

  function winGame() {
    if (G.sub) { finishSub(false); return; }
    G.over = true;
    openOverlay('YOU RETIRE',
      `<p>Every boon is claimed. You retire and remain in your cottage or castle until the 7th Misery occurs and everything you know blackens and burns.</p>
       <p class="flavor">Congratulations, Kargunt.</p>`,
      () => {}, 'level');
    setOverlayActions([
      { label: 'Begin anew', cls: 'primary', fn: () => { closeOverlay(); startTitle(); } },
      { label: '‹ Menu', cls: 'ghost', fn: () => { closeOverlay(); window.GameMenu && window.GameMenu(); } },
    ]);
  }

  /* ── overlay plumbing ─────────────────────────────────── */
  function openOverlay(title, bodyHtml, _onClose, cls) {
    $('#overlay-title').className  = cls || '';
    $('#overlay-title').textContent = title;
    $('#overlay-body').innerHTML   = bodyHtml;
    $('#overlay-actions').innerHTML = '';
    overlay.classList.remove('hidden');
  }
  function setOverlayActions(list) {
    const box = $('#overlay-actions');
    box.innerHTML = '';
    list.forEach((a) => {
      const b = el('button', 'act' + (a.cls ? ' ' + a.cls : ''), a.label);
      if (a.disabled) b.disabled = true; else b.addEventListener('click', a.fn);
      box.appendChild(b);
    });
  }
  function closeOverlay() { overlay.classList.add('hidden'); }

  /* ── chrome (masthead + stat labels) ──────────────────── */
  function applyFortChrome() {
    const mt = $('#mast-title'); if (mt) mt.textContent = 'DARK FORT';
    $('#stat4-lbl').textContent  = 'ROOMS';
    $('#stat4-max').textContent  = '/12';
    $('#map-label').textContent  = 'DUNGEON MAP';
    document.body.classList.remove('forest');
    if (window.GameMode && window.GameMode.current !== 'fort-sub') window.GameMode.current = 'fort';
  }

  /* ════════════════════════════════════════════════════════
     BARROW / KEEP SUB-DUNGEON
     Entered from Dark Forest. Runs a bounded Dark Fort crawl
     seeded from the forest rambler, then hands a result back.
     ════════════════════════════════════════════════════════ */
  function startSub(opts) {
    newGame();
    const c = opts.character || {};
    G.sub = {
      maxRooms: opts.maxRooms || 6, roomsDone: 0, onReturn: opts.onReturn,
      label: opts.label || 'THE DARK', startAttackBonus: 0,
      startMaxHp: c.maxHp != null ? c.maxHp : G.maxHp,
    };
    G.hp = c.hp != null ? c.hp : G.hp;
    G.maxHp = c.maxHp != null ? c.maxHp : G.maxHp;
    G.silver = c.silver != null ? c.silver : G.silver;
    G.weapon = { name: c.weaponName || 'Blade', dmg: dmg(6, (c.weaponMod || 0) + (c.dmgBonus || 0)), atk: c.weaponAtk || 0 };
    G.weapons = [G.weapon];
    G.attackBonus = c.attackBonus || 0;
    G.sub.startAttackBonus = G.attackBonus;
    applyFortChrome();
    render();
    logBox.innerHTML = '';
    heading(G.sub.label);
    logLine(`You enter with <span class="hit">${G.hp} hp</span> and a <b>${G.weapon.name}</b>. <b>${G.sub.maxRooms}</b> rooms of old dark await.`);
    enterEntrance();
  }

  function subComplete() {
    heading('THE WAY OUT');
    logLine('You have plundered the last room. A stair climbs back toward the trees.');
    setActions([
      { label: '↟ Climb back to the forest', cls: 'primary', fn: () => finishSub(false) },
      { label: '☰ Pack', cls: 'ghost', fn: openInventory },
    ]);
  }

  function finishSub(died, deathMsg) {
    const sub = G.sub;
    const result = {
      hp: G.hp, maxHp: G.maxHp, silver: G.silver,
      bonusMaxHp: Math.max(0, G.maxHp - sub.startMaxHp),
      bonusAttack: Math.max(0, G.attackBonus - sub.startAttackBonus),
      died: !!died, deathMsg: deathMsg || '',
    };
    G.sub = null;
    G.over = true;
    if (typeof sub.onReturn === 'function') sub.onReturn(result);
  }

  /* ── public API (boot is owned by boot.js) ────────────── */
  window.DarkFort = { init: initMapClicks, start: startTitle, startSub };
})();
