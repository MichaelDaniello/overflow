/* ============================================================
   DARK FOREST — GAME ENGINE
   A wilderness hex-crawl adaptation of Dark Fort (Nick Waber,
   v0.07). Roll terrain (2d6), encounter (d6) and trails (d6),
   wander the hex map, hunt, camp, and die badly in the woods.
   Barrow/Keep hexes drop you into a contained Dark Fort crawl.
   ============================================================ */

(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  const Art = window.DarkForestArt;
  const COL = Art.COL;

  const canvas    = $('#room-canvas');
  const caption   = $('#scene-caption');
  const logBox    = $('#log');
  const actionBox = $('#actions');
  const diceTray  = $('#dice-tray');
  const overlay   = $('#overlay');

  /* ── dice ─────────────────────────────────────────────── */
  const d = (n) => 1 + Math.floor(Math.random() * n);
  const d6 = () => d(6);
  const sum = (n, sides) => { let t = 0; for (let i = 0; i < n; i++) t += d(sides); return t; };

  /* ── hex grid ─────────────────────────────────────────── */
  // pointy-top axial coords. 6 neighbour directions.
  const HEX_DIRS = [
    { dq: +1, dr: 0 },  // 0 E
    { dq: +1, dr: -1 }, // 1 NE
    { dq: 0,  dr: -1 }, // 2 NW
    { dq: -1, dr: 0 },  // 3 W
    { dq: -1, dr: +1 }, // 4 SW
    { dq: 0,  dr: +1 }, // 5 SE
  ];
  const MAP_W = 9, MAP_H = 7; // rectangular bounds (odd-r offset)

  function axialToOffset(q, r) { return { col: q + (r - (r & 1)) / 2, row: r }; }
  function inBounds(q, r) {
    const o = axialToOffset(q, r);
    return o.col >= 0 && o.col < MAP_W && o.row >= 0 && o.row < MAP_H;
  }
  function hexKey(q, r) { return q + ',' + r; }

  /* ── game state ───────────────────────────────────────── */
  let F = null;

  function newGame() {
    const w = weaponByRoll(d6());
    F = {
      title: 'KARGUNT',
      hp: 6 + d6(), maxHp: 0,
      silver: 6 + d6(),
      rations: 6 + d6(),
      points: 0,
      weapon: w,
      weapons: [w],
      attackBonus: 0,
      dmgBonus: 0,
      campHealBonus: 0,
      resupplyBonus: 0,
      items: { gloves: false, bedroll: false, messkit: false },
      armorFights: 0,         // remaining fights of -d6 damage soak
      scrolls: [],
      owlFights: 0,
      thornsReady: 0,
      feyLuck: 0,
      silentHexes: 0,
      druidReturning: false,
      starve: 0,
      levelTaken: {},
      hexes: {},              // key -> hex object
      cur: null,              // {q,r}
      combat: null,
      pendingBarrow: null,
      started: false,
      over: false,
    };
    F.maxHp = F.hp;
    grantStartItem(d6());
  }

  function weaponByRoll(r) {
    switch (r) {
      case 1: return { name: 'Battle Axe', mod: 0,  atk: 0, special: null,        note: '' };
      case 2: return { name: 'Quarterstaff', mod: 0, atk: 0, special: 'trail',    note: '+1 trail rolls' };
      case 3: return { name: 'Sling', mod: -1, atk: 0, ranged: true, special: 'forage', note: '-1 dmg · +2 forage · ranged' };
      case 4: return { name: 'Dagger', mod: -1, atk: 0, special: 'reroll',        note: '-1 dmg · reroll a 1' };
      case 5: return { name: 'Sword', mod: 0,  atk: 1, special: null,             note: '+1 attack' };
      default:return { name: 'Longbow', mod: 1, atk: 0, ranged: true, special: null, note: '+1 dmg · ranged' };
    }
  }

  function grantStartItem(r) {
    switch (r) {
      case 1: { const w = weaponByRoll(d6()); F.weapons.push(w); break; }
      case 2: F.items.gloves = true; break;
      case 3: F.items.bedroll = true; break;
      case 4: F.items.messkit = true; break;
      case 5: F.armorFights += sum(2, 6); break;
      default: F.scrolls.push(makeScroll(d6())); break;
    }
  }

  function makeScroll(r) {
    switch (r) {
      case 1: return { key: 'balm',   name: 'Healing Balm',          uses: 2,    eff: 'restore d6 HP' };
      case 2: return { key: 'silent', name: 'Silent Passage',        uses: 2,    eff: 'evade monsters d6 hexes, keep their points' };
      case 3: return { key: 'weald',  name: 'Wealdken',              uses: 2,    eff: 'reveal 3 trails from this hex' };
      case 4: return { key: 'fey',    name: 'Fey Luck',              uses: 1,    eff: 'reroll one die' };
      case 5: return { key: 'owl',    name: 'Summon Spectral Owl',   uses: 1,    eff: '+d6 dmg for 2 fights' };
      default:return { key: 'thorns', name: 'Constricting Thorns',   uses: 1,    eff: '2d6 dmg, one fight' };
    }
  }

  /* ── monsters ─────────────────────────────────────────── */
  function mk(name, art, points, dmgFn, hp, extra) {
    return Object.assign({ name, art, points, dmgFn, hp, maxHp: hp, tough: false }, extra || {});
  }
  function weakMonster() {
    const r = d6();
    if (r === 1) return mk('DIRE WOLF',      'wolf',    3, () => d6(),     d6());
    if (r === 2) return mk('RAVENING BEAR',  'bear',    4, () => d6() + 1, d6() + 2);
    if (r === 3) return mk('PAINTED WILDMAN','wildman', 3, () => d6(),     d6(), { silver: d6(), loot: 'item' });
    if (r === 4) return mk('BANDIT',         'bandit',  3, () => d6(),     d6(), { armor: true, silver: sum(2, 6), loot: 'weapon' });
    if (r === 5) { const m = mk('SPIDER SWARM','spiders',4, null, Math.max(1, d6() - 1), { swarm: true }); return m; }
    return mk('TWO WEAK FOES', 'wolf', 0, null, 0, { pair: true });
  }
  // a guaranteed single weak monster (never the "roll twice" result)
  function weakSingle() { let m; do { m = weakMonster(); } while (m.pair); return m; }
  function toughMonster() {
    const r = d6();
    if (r === 1) return mk('GRIFFON',          'griffon', 5, () => d6() + 1, sum(2, 6), { tough: true, special: 'griffon' });
    if (r === 2) return mk('DRUID',            'druid',   4, () => Math.max(1, d6() - 1), d6() + 2, { tough: true, special: 'druid', silver: d6() });
    if (r === 3) return mk('FUNGAL ZOMBIE',    'zombie',  5, () => Math.max(1, d6() - 1), d6(), { tough: true, special: 'zombie', silver: d6() });
    if (r === 4) return mk('CARNIVOROUS PLANT','plant',   5, () => d6() + 1, sum(2, 6), { tough: true, special: 'plant' });
    if (r === 5) return mk('WYVERN',           'wyvern',  5, () => sum(2, 6), d6(), { tough: true, special: 'wyvern' });
    return mk('BLOOD GIANT',  'giant', 6, () => sum(2, 6), sum(2, 6), { tough: true, special: 'giant', silver: d6() * d6() });
  }

  /* ════════════════════════════════════════════════════════
     RENDER / UI
     ════════════════════════════════════════════════════════ */
  function applyChrome() {
    $('#mast-title').textContent = 'DARK FOREST';
    $('#stat4-lbl').textContent = 'RATIONS';
    $('#stat4-max').textContent = '';
    $('#map-label').textContent = 'FOREST MAP';
    document.body.classList.add('forest');
    if (window.GameMode) window.GameMode.current = 'forest';
  }

  function render() {
    if (!F) return;
    $('#cs-name').textContent = F.title;
    $('#stat-hp').textContent = Math.max(0, F.hp);
    $('#stat-maxhp').textContent = '/' + F.maxHp;
    $('#stat-silver').textContent = F.silver;
    $('#stat-points').textContent = F.points;
    $('#stat-rooms').textContent = F.rations;
    const atk = F.weapon.atk + F.attackBonus - F.starve;
    $('#stat-weapon').innerHTML =
      `${F.weapon.name} <small>(d6${dmgMod() ? (dmgMod() > 0 ? '+' : '') + dmgMod() : ''}${atk ? ` /${atk > 0 ? '+' : ''}${atk} atk` : ''})</small>`;
    $('#stat-pack').innerHTML = packSummary();
  }

  function dmgMod() { return F.weapon.mod + F.dmgBonus - F.starve; }

  function packSummary() {
    const p = [];
    if (F.weapons.length > 1) p.push(`weapons×${F.weapons.length}`);
    if (F.items.gloves)  p.push('gloves');
    if (F.items.bedroll) p.push('bedroll');
    if (F.items.messkit) p.push('mess kit');
    if (F.armorFights)   p.push(`<span class="good">armour(${F.armorFights})</span>`);
    F.scrolls.forEach((s) => p.push(`<span class="good">${s.name}${s.uses > 1 ? ` (${s.uses})` : ''}</span>`));
    return p.length ? p.join(' · ') : '<i>empty</i>';
  }

  function logLine(html, cls) {
    const e = el('div', 'log-entry' + (cls ? ' ' + cls : ''), html);
    logBox.appendChild(e);
    logBox.scrollTop = logBox.scrollHeight;
  }
  function heading(t) { logLine(t, 'heading'); }
  function flavor(t)  { logLine(t, 'flavor'); }

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

  function flashHp() {
    document.querySelector('.stat.hp').classList.add('dmg-flash');
    document.querySelector('#scene-frame').classList.add('shake');
    setTimeout(() => {
      document.querySelector('.stat.hp').classList.remove('dmg-flash');
      document.querySelector('#scene-frame').classList.remove('shake');
    }, 450);
  }

  function curHex() { return F.cur ? F.hexes[hexKey(F.cur.q, F.cur.r)] : null; }

  function drawScene() {
    const h = curHex();
    if (!h) return;
    Art.renderHex(canvas, { seed: h.seed, terrain: h.terrain, encounter: h.encounter });
    drawForestMap();
  }

  /* ════════════════════════════════════════════════════════
     HEX MAP CANVAS
     ════════════════════════════════════════════════════════ */
  const HEX_SIZE = 22;
  function hexCenter(q, r, originX, originY) {
    const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
    const y = HEX_SIZE * 1.5 * r;
    return { x: x + originX, y: y + originY };
  }
  function hexCorners(cx, cy) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 180 * (60 * i - 90);
      pts.push([cx + HEX_SIZE * Math.cos(a), cy + HEX_SIZE * Math.sin(a)]);
    }
    return pts;
  }

  // compute the pixel origin so the whole bounded map fits centred
  function mapOrigin(mc) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const r = row, q = col - (row - (row & 1)) / 2;
        const c = hexCenter(q, r, 0, 0);
        minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
        minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
      }
    }
    const PAD = HEX_SIZE + 6;
    const W = (maxX - minX) + PAD * 2;
    const H = (maxY - minY) + PAD * 2;
    mc.width = Math.max(640, Math.round(W));
    mc.height = Math.round(H);
    return { ox: PAD - minX + (mc.width - W) / 2, oy: PAD - minY };
  }

  function drawForestMap() {
    const mc = $('#map-canvas');
    if (!mc) return;
    const ctx = mc.getContext('2d');
    if (!ctx) return;
    if (!F) {
      mc.width = 640; mc.height = 160;
      ctx.fillStyle = '#0c0e09'; ctx.fillRect(0, 0, 640, 160);
      ctx.fillStyle = '#2a3a22'; ctx.font = 'bold 10px Anton, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('THE MAP FILLS AS YOU WANDER', 320, 80);
      ctx.textBaseline = 'alphabetic';
      return;
    }
    const { ox, oy } = mapOrigin(mc);

    ctx.fillStyle = '#0c0e09';
    ctx.fillRect(0, 0, mc.width, mc.height);

    // all in-bounds hex outlines (fog)
    for (let row = 0; row < MAP_H; row++) {
      for (let col = 0; col < MAP_W; col++) {
        const r = row, q = col - (row - (row & 1)) / 2;
        const c = hexCenter(q, r, ox, oy);
        const corners = hexCorners(c.x, c.y);
        ctx.beginPath();
        corners.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.closePath();
        const h = F.hexes[hexKey(q, r)];
        if (h) {
          ctx.fillStyle = (Art.TERRAIN[h.terrain] || {}).col || '#223018';
          ctx.fill();
        }
        ctx.strokeStyle = h ? '#5a5640' : '#1c1e16';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // trails between explored hexes + dangling stubs
    Object.values(F.hexes).forEach((h) => {
      const c = hexCenter(h.q, h.r, ox, oy);
      h.trails.forEach((tr) => {
        const dir = HEX_DIRS[tr.dir];
        const nq = h.q + dir.dq, nr = h.r + dir.dr;
        const nc = hexCenter(nq, nr, ox, oy);
        const neigh = F.hexes[hexKey(nq, nr)];
        ctx.strokeStyle = tr.travelled ? '#7a6a3a' : (neigh ? '#7a6a3a' : '#46402a');
        ctx.setLineDash(tr.travelled || neigh ? [] : [3, 4]);
        ctx.lineWidth = tr.travelled ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo((c.x + nc.x) / 2, (c.y + nc.y) / 2);
        if (neigh) ctx.lineTo(nc.x, nc.y);
        ctx.stroke();
      });
    });
    ctx.setLineDash([]);

    // markers
    Object.values(F.hexes).forEach((h) => {
      const c = hexCenter(h.q, h.r, ox, oy);
      const isCur = F.cur && h.q === F.cur.q && h.r === F.cur.r;
      const info = Art.TERRAIN[h.terrain] || {};
      if (info.sub) {
        ctx.fillStyle = COL.pink;
        ctx.font = 'bold 13px Anton, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(h.terrain === 'Cursed Barrow' ? '☠' : '⌂', c.x, c.y + 1);
      }
      if (isCur) {
        ctx.strokeStyle = COL.yellow; ctx.lineWidth = 3;
        const corners = hexCorners(c.x, c.y);
        ctx.beginPath();
        corners.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
        ctx.closePath(); ctx.stroke();
        ctx.fillStyle = COL.yellow;
        ctx.beginPath(); ctx.arc(c.x, c.y, 4, 0, 7); ctx.fill();
      }
    });
    ctx.textBaseline = 'alphabetic';
  }

  function initMapClicks() {
    const mc = $('#map-canvas');
    if (!mc) return;
    mc.addEventListener('click', (e) => {
      if (!window.GameMode || window.GameMode.current !== 'forest') return;
      if (!F || F.over || F.combat) return;
      if (overlay && !overlay.classList.contains('hidden')) return;
      const rect = mc.getBoundingClientRect();
      const px = (e.clientX - rect.left) * (mc.width / rect.width);
      const py = (e.clientY - rect.top) * (mc.height / rect.height);
      const { ox, oy } = mapOrigin(mc);

      if (!F.started) {
        // dropping the die: any in-bounds hex
        for (let row = 0; row < MAP_H; row++) {
          for (let col = 0; col < MAP_W; col++) {
            const r = row, q = col - (row - (row & 1)) / 2;
            const c = hexCenter(q, r, ox, oy);
            if (Math.hypot(px - c.x, py - c.y) <= HEX_SIZE) { beginAt(q, r); return; }
          }
        }
        return;
      }
      // travel to an adjacent explored hex (backtrack) or along a known trail
      const here = curHex();
      if (!here) return;
      for (let dirIdx = 0; dirIdx < 6; dirIdx++) {
        const dir = HEX_DIRS[dirIdx];
        const nq = here.q + dir.dq, nr = here.r + dir.dr;
        const c = hexCenter(nq, nr, ox, oy);
        if (Math.hypot(px - c.x, py - c.y) <= HEX_SIZE) {
          const trail = here.trails.find((t) => t.dir === dirIdx);
          if (trail) travelTrail(trail);
          return;
        }
      }
    });
  }

  /* ════════════════════════════════════════════════════════
     FLOW
     ════════════════════════════════════════════════════════ */
  function startTitle() {
    applyChrome();
    Art.renderTitle(canvas);
    setCaption('DARK FOREST');
    diceTray.innerHTML = '';
    logBox.innerHTML = '';
    heading('THE DEEP WOODS RAMBLER ENTERS THE STAGE');
    flavor('A dying world choked with cursed trees. You are still Kargunt. The forest wants you to stay forever.');
    F = null;
    drawForestMap();
    setActions([
      { label: '🌲 Enter the Dark Forest', cls: 'primary', fn: beginRun },
      { label: '‹ Menu', cls: 'ghost', fn: () => window.GameMenu && window.GameMenu() },
    ]);
  }

  function beginRun() {
    newGame();
    applyChrome();
    render();
    logBox.innerHTML = '';
    heading('YOU ARE KARGUNT');
    logLine(`You begin with <span class="hit">${F.hp} hp</span>, <span class="gold">${F.silver} silver</span>, <b>${F.rations} rations</b>, a <b>${F.weapon.name}</b>${F.weapon.note ? ` <small>(${F.weapon.note})</small>` : ''} and ${describeStart()}.`);
    Art.renderTitle(canvas);
    setCaption('DROP THE DIE');
    flavor('Drop a die onto the map — click any hex, or use the button — and your adventure begins.');
    drawForestMap();
    setActions([{ label: '🎲 Drop the die into the woods', cls: 'primary', fn: dropDie }]);
  }

  function describeStart() {
    if (F.weapons.length > 1) return `a spare <b>${F.weapons[1].name}</b>`;
    if (F.items.gloves)  return 'a pair of <b>heavy gloves</b>';
    if (F.items.bedroll) return 'a <b>bedroll</b>';
    if (F.items.messkit) return 'a <b>mess kit</b>';
    if (F.armorFights)   return `<b>armour</b> (good for ${F.armorFights} fights)`;
    if (F.scrolls.length) return `a scroll of <b>${F.scrolls[0].name}</b>`;
    return 'nothing else';
  }

  function dropDie() {
    let q, r;
    do {
      const row = Math.floor(Math.random() * MAP_H);
      const col = Math.floor(Math.random() * MAP_W);
      r = row; q = col - (row - (row & 1)) / 2;
    } while (!inBounds(q, r));
    beginAt(q, r);
  }

  function beginAt(q, r) {
    F.started = true;
    enterHex(q, r, null);
  }

  /* ── entering a hex ───────────────────────────────────── */
  function enterHex(q, r, viaTrail) {
    if (!inBounds(q, r)) { edgeOfMap(); return; }

    // mark the trail we came along as travelled
    if (viaTrail) viaTrail.travelled = true;

    F.cur = { q, r };
    const existing = F.hexes[hexKey(q, r)];

    // consume a ration for entering a hex
    consumeRation();
    if (F.over) return;

    if (existing) {
      // re-entering an explored hex
      drawScene();
      heading('FAMILIAR GROUND');
      setCaption(`${existing.terrain.toUpperCase()} · REVISITED`);
      flavor('You have walked this hex before. The forest is quiet — for now.');
      render();
      presentHexActions();
      return;
    }

    // brand-new hex: roll terrain
    const tRoll = sum(2, 6);
    const terrain = Art.TERRAIN_2D6[tRoll];
    const hex = {
      q, r, terrain, seed: (Math.random() * 1e9) | 0,
      encounter: { kind: 'nothing' },
      trails: [], foraged: false, camped: false, explored: false,
    };
    F.hexes[hexKey(q, r)] = hex;

    heading('A NEW HEX');
    showDice([{ tag: '2d6 TERRAIN', val: tRoll, color: 'd-yellow' }]);
    setCaption(terrain.toUpperCase());
    flavor(`You push into ${terrain.toLowerCase()}.`);
    drawScene();
    render();

    if (Art.TERRAIN[terrain].sub) {
      // Barrow / Ruined Keep → Dark Fort detour. The hex stays
      // "pending" until you actually go in, so closing the Pack
      // can't skip the descent.
      logLine(`<b>${terrain}.</b> A black doorway gapes. <i>You switch to DARK FORT for 3d6 rooms.</i>`);
      F.pendingBarrow = terrain;
      barrowEntryActions(terrain);
      return;
    }

    rollEncounter(hex);
  }

  function consumeRation() {
    if (F.rations > 0) {
      F.rations--;
      if (F.rations === 0) flavor('That was your last ration. Hunger gnaws.');
    } else {
      // starving: -1 att/dmg and -1 max HP per hex with no food
      F.starve++;
      F.maxHp = Math.max(1, F.maxHp - 1);
      if (F.hp > F.maxHp) F.hp = F.maxHp;
      logLine('<span class="hit">Starving.</span> Your strength wanes (−1 attack/damage, −1 max HP).');
      if (F.hp <= 0) { die('You starve to death beneath indifferent trees.'); return; }
    }
    render();
  }

  function rollEncounter(hex) {
    // Silent Passage: evade monster encounters, still bank the points
    let roll = d6();
    showDice([{ tag: 'D6 ENCOUNTER', val: roll, color: 'd-pink' }]);
    switch (roll) {
      case 1:
        hex.encounter = { kind: 'nothing' };
        hex.explored = true;
        drawScene();
        logLine('<b>Nothing of note.</b> The hex is explored.');
        rollTrails(hex);
        break;
      case 2:
        hex.encounter = { kind: 'hazard' };
        drawScene();
        environmentalHazard(hex);
        break;
      case 3:
        hex.encounter = { kind: 'trickster' };
        drawScene();
        faerieTrickster(hex);
        break;
      case 4:
        spawnMonsterEncounter(hex, false);
        break;
      case 5:
        spawnMonsterEncounter(hex, true);
        break;
      default:
        hex.encounter = { kind: 'tinkerer' };
        drawScene();
        heading('GNOMISH TINKERER');
        flavor('A gnome with a rattling cart wants to trade.');
        openTinkerer(hex);
    }
    render();
  }

  function spawnMonsterEncounter(hex, tough) {
    if (F.silentHexes > 0) {
      F.silentHexes--;
      const m = tough ? toughMonster() : weakMonster();
      const pts = m.pair ? 0 : m.points;
      F.points += pts;
      hex.encounter = { kind: 'nothing' };
      hex.explored = true;
      drawScene();
      heading('SILENT PASSAGE');
      logLine(`You drift past the ${tough ? 'tough' : 'weak'} thing unseen${pts ? ` and pocket <span class="good">${pts} points</span>` : ''}. (${F.silentHexes} hexes of silence left.)`);
      if (checkLevelUp()) return;
      rollTrails(hex);
      return;
    }
    const m = tough ? toughMonster() : weakMonster();
    if (m.pair) {
      const a = weakSingle(), b = weakSingle();
      hex.encounter = { kind: 'monster', art: a.art, tough: false };
      drawScene();
      heading('TWO WEAK MONSTERS');
      logLine('<b>Two weak monsters</b> close in. You face them one at a time.');
      startCombat(a, [b]);
    } else {
      hex.encounter = { kind: 'monster', art: m.art, tough };
      drawScene();
      heading(tough ? 'A TOUGH MONSTER' : 'A WEAK MONSTER');
      startCombat(m, []);
    }
  }

  /* ── environmental hazard (#2) ────────────────────────── */
  function environmentalHazard(hex) {
    heading('ENVIRONMENTAL HAZARD');
    let r = d6();
    let bonus = F.items.gloves ? 1 : 0;
    const total = r + bonus;
    showDice([{ tag: 'D6 HAZARD', val: r, color: 'd-pink' }].concat(bonus ? [{ tag: 'GLOVES', val: '+1', color: 'd-yellow' }] : []));
    if (total <= 2) {
      const dm = d6();
      logLine(`The land turns on you — <span class="hit">${dm} damage</span>.`);
      hurt(dm);
      if (F.over) return;
    } else if (total <= 4) {
      loseRandomItem();
    } else {
      logLine('You weather it. Unharmed.');
    }
    hex.explored = true;
    rollTrails(hex);
  }

  function loseRandomItem() {
    const pool = [];
    if (F.weapons.length > 1) pool.push('weapon');
    if (F.items.gloves) pool.push('gloves');
    if (F.items.bedroll) pool.push('bedroll');
    if (F.items.messkit) pool.push('messkit');
    if (F.armorFights) pool.push('armor');
    F.scrolls.forEach((_, i) => pool.push('scroll:' + i));
    if (!pool.length) {
      const lost = Math.min(F.rations, d6());
      F.rations -= lost;
      logLine(`Nothing to lose but food — <span class="hit">${lost} rations</span> gone.`);
      render();
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick === 'weapon') { const w = F.weapons.pop(); if (F.weapon === w) F.weapon = F.weapons[0]; logLine(`You lose your <b>${w.name}</b>.`); }
    else if (pick === 'gloves')  { F.items.gloves = false; logLine('You lose your <b>heavy gloves</b>.'); }
    else if (pick === 'bedroll') { F.items.bedroll = false; logLine('You lose your <b>bedroll</b>.'); }
    else if (pick === 'messkit') { F.items.messkit = false; logLine('You lose your <b>mess kit</b>.'); }
    else if (pick === 'armor')   { F.armorFights = 0; logLine('Your <b>armour</b> is torn away.'); }
    else if (pick.startsWith('scroll:')) { const i = +pick.split(':')[1]; const s = F.scrolls.splice(i, 1)[0]; if (s) logLine(`You lose the scroll <b>${s.name}</b>.`); }
    render();
  }

  /* ── faerie trickster (#3) ────────────────────────────── */
  function faerieTrickster(hex) {
    heading('FAERIE TRICKSTER');
    const r = d6();
    showDice([{ tag: 'D6 FAERIE', val: r, color: r === 6 ? 'd-pink' : 'd-yellow' }]);
    if (r === 1) { const s = makeScroll(d6()); F.scrolls.push(s); logLine(`The faerie gifts a scroll: <b>${s.name}</b>.`); }
    else if (r === 2) { F.silver += 10; logLine('<span class="gold">+10 silver</span> spills from a hollow log.'); }
    else if (r === 3) { F.points += 3; logLine('<span class="good">+3 points</span> of forbidden insight.'); }
    else if (r === 4) { F.hp = Math.min(F.maxHp, F.hp + 2); logLine('<span class="good">+2 HP</span> of fey vigor.'); }
    else if (r === 5) {
      logLine('The faerie flings you across the wood…');
      render();
      hex.explored = true;
      teleportRandom();
      return;
    } else {
      render();
      die('The faerie drags you down into faerieland, laughing. Your adventure ends here.', 'faerie');
      return;
    }
    hex.explored = true;
    render();
    if (checkLevelUp()) return;
    rollTrails(hex);
  }

  function teleportRandom() {
    let q, r;
    do {
      const row = Math.floor(Math.random() * MAP_H);
      const col = Math.floor(Math.random() * MAP_W);
      r = row; q = col - (row - (row & 1)) / 2;
    } while (!inBounds(q, r));
    // if the dropped die "rolls a 6", the destination becomes a barrow/keep
    const key = hexKey(q, r);
    if (!F.hexes[key] && d6() === 6) {
      F.hexes[key] = {
        q, r, terrain: Math.random() < 0.5 ? 'Cursed Barrow' : 'Ruined Keep',
        seed: (Math.random() * 1e9) | 0, encounter: { kind: 'nothing' },
        trails: [], foraged: false, camped: false, explored: false, forced: true,
      };
    }
    enterHex(q, r, null);
  }

  /* ── trails (movement options) ────────────────────────── */
  function rollTrails(hex) {
    if (F.over) return;
    if (hex.trails.length === 0) {
      let r = d6();
      let bonus = F.weapon.special === 'trail' ? 1 : 0;
      const total = Math.min(6, r + bonus);
      const n = total <= 1 ? 0 : total <= 3 ? 1 : total <= 5 ? 2 : 3;
      showDice([{ tag: 'D6 TRAIL', val: r, color: 'd-yellow' }].concat(bonus ? [{ tag: 'STAFF', val: '+1', color: 'd-yellow' }] : []));
      assignTrails(hex, n);
      if (n === 0) flavor('Terrain blocks the way ahead. You must backtrack.');
      else flavor(`${n} trail${n !== 1 ? 's' : ''} wind away into the trees.`);
    }
    hex.explored = true;
    render();
    if (checkLevelUp()) return;
    presentHexActions();
  }

  function assignTrails(hex, n) {
    // choose n distinct directions, preferring in-bounds & unexplored neighbours
    const order = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    const chosen = [];
    // first pass: in-bounds, no hex yet
    for (const dir of order) {
      if (chosen.length >= n) break;
      const dd = HEX_DIRS[dir];
      const nq = hex.q + dd.dq, nr = hex.r + dd.dr;
      if (inBounds(nq, nr) && !F.hexes[hexKey(nq, nr)]) chosen.push(dir);
    }
    // second pass: any remaining direction (may lead off-map → edge rule)
    for (const dir of order) {
      if (chosen.length >= n) break;
      if (!chosen.includes(dir)) chosen.push(dir);
    }
    hex.trails = chosen.map((dir) => ({ dir, travelled: false }));
  }

  function dirName(dir) {
    return ['east', 'north-east', 'north-west', 'west', 'south-west', 'south-east'][dir];
  }

  function presentHexActions() {
    if (F.over) return;
    const hex = curHex();
    if (!hex) return;
    const acts = [];

    // travel each trail
    hex.trails.forEach((tr) => {
      const dd = HEX_DIRS[tr.dir];
      const nq = hex.q + dd.dq, nr = hex.r + dd.dr;
      const neigh = F.hexes[hexKey(nq, nr)];
      const label = neigh
        ? `→ ${dirName(tr.dir)} (${neigh.terrain.toLowerCase()})`
        : `→ Take the ${dirName(tr.dir)} trail`;
      acts.push({ label, cls: 'primary', fn: () => travelTrail(tr) });
    });

    // backtrack to any explored hex that still has an untravelled trail
    const backs = backtrackTargets(hex);
    backs.forEach((b) => {
      acts.push({ label: `← Backtrack: ${b.hex.terrain.toLowerCase()}`, cls: 'ghost', fn: () => stepToward(b) });
    });

    if (!hex.foraged) acts.push({ label: '🍖 Forage', fn: forage });
    if (!hex.camped && F.rations >= 2) acts.push({ label: '⛺ Make camp (2 rations)', fn: makeCamp });
    acts.push({ label: '☰ Pack', cls: 'ghost', fn: openPack });

    if (!acts.some((a) => a.cls === 'primary') && backs.length === 0) {
      // utterly stuck: let the forest shove you somewhere
      acts.unshift({ label: '🌫 Force a path (lose a ration)', cls: 'danger', fn: () => { consumeRation(); if (!F.over) { hex.trails = []; rollTrails(hex); } } });
    }
    setActions(acts);
  }

  // explored hexes reachable that still have an untravelled trail
  function backtrackTargets(from) {
    const targets = [];
    const seen = new Set([hexKey(from.q, from.r)]);
    for (let dirIdx = 0; dirIdx < 6; dirIdx++) {
      const dd = HEX_DIRS[dirIdx];
      const nq = from.q + dd.dq, nr = from.r + dd.dr;
      const neigh = F.hexes[hexKey(nq, nr)];
      if (neigh && !seen.has(hexKey(nq, nr))) {
        seen.add(hexKey(nq, nr));
        targets.push({ dirIdx, hex: neigh });
      }
    }
    return targets;
  }

  function stepToward(target) {
    const here = curHex();
    // ensure a trail record exists in this direction so the map links up
    let tr = here.trails.find((t) => t.dir === target.dirIdx);
    if (!tr) { tr = { dir: target.dirIdx, travelled: false }; here.trails.push(tr); }
    travelTrail(tr);
  }

  function travelTrail(tr) {
    if (F.over || !F.cur) return;
    const here = curHex();
    const dd = HEX_DIRS[tr.dir];
    const nq = here.q + dd.dq, nr = here.r + dd.dr;
    tr.travelled = true;
    enterHex(nq, nr, tr);
  }

  function edgeOfMap() {
    heading('THE EDGE OF THE FOREST');
    const r = sum(2, 6);
    showDice([{ tag: '2d6 EDGE', val: r, color: r === 2 || r === 12 ? 'd-yellow' : 'd-pink' }]);
    if (r === 2 || r === 12) {
      flavor('The trees thin. Grey sky. You are free of the forest\'s curse.');
      winGame();
    } else {
      logLine('The trickster will not let you leave. You are flung back into the deep wood.');
      render();
      teleportRandom();
    }
  }

  /* ── camp & forage ────────────────────────────────────── */
  function forage() {
    const hex = curHex();
    if (hex.foraged) return;
    hex.foraged = true;
    heading('FORAGING');
    const r = d6();
    showDice([{ tag: 'D6 FORAGE', val: r, color: 'd-yellow' }]);
    let gained = 0;
    if (r === 1) gained = sum(2, 6) + 1;
    else if (r <= 3) gained = d6() + 1;
    else if (r <= 5) gained = 0;
    else {
      logLine('Your foraging stirs up a <span class="hit">weak monster!</span>');
      render();
      startCombat(weakSingle(), []);
      return;
    }
    if (gained > 0) {
      if (F.items.messkit) gained += 2;
      if (F.weapon.special === 'forage') gained += 2;
      gained += F.resupplyBonus;
      F.rations += gained;
      if (F.starve > 0) { F.starve = 0; logLine('You eat. Strength returns.'); }
      logLine(`You gather <span class="good">${gained} rations</span>.`);
    } else {
      logLine('Poor ground. No food here.');
    }
    render();
    presentHexActions();
  }

  function makeCamp() {
    const hex = curHex();
    if (hex.camped || F.rations < 2) return;
    hex.camped = true;
    F.rations -= 2;
    heading('MAKING CAMP');
    const r = d6();
    showDice([{ tag: 'D6 CAMP', val: r, color: 'd-yellow' }]);
    if (r === 1) {
      let h = d6() + (F.items.bedroll ? 1 : 0) + F.campHealBonus;
      F.hp = Math.min(F.maxHp, F.hp + h);
      logLine(`Well-rested. You heal <span class="good">${h} HP</span>.`);
    } else if (r <= 3) {
      let h = 2 + F.campHealBonus;
      F.hp = Math.min(F.maxHp, F.hp + h);
      logLine(`Adequate rest. You heal <span class="good">${h} HP</span>.`);
    } else if (r <= 5) {
      logLine('Poor rest. No healing.');
    } else {
      logLine('A <span class="hit">weak monster</span> falls upon your camp!');
      render();
      startCombat(weakSingle(), []);
      return;
    }
    render();
    presentHexActions();
  }

  /* ════════════════════════════════════════════════════════
     COMBAT
     ════════════════════════════════════════════════════════ */
  function startCombat(m, queue) {
    F.combat = { monster: m, queue: queue || [], thornsUsedThisFight: false };
    if (F.owlFights > 0) logLine('<i>The spectral owl wheels overhead (+d6 damage).</i>');
    logLine(`<b>${m.name}</b> — ${m.points} pts, ${m.hp} hp.`);
    combatActions();
    render();
  }

  function combatActions() {
    if (!F.combat) return;
    const acts = [
      { label: '⚔ Attack', cls: 'primary', fn: attackRound },
      { label: 'Flee (d6 dmg, −d6 pts)', cls: 'danger', fn: flee },
    ];
    F.scrolls.forEach((s, i) => {
      if (s.key === 'balm')   acts.push({ label: `Healing Balm (${s.uses})`, fn: () => castBalm(i) });
      if (s.key === 'owl' && F.owlFights === 0) acts.push({ label: 'Summon Owl', fn: () => castOwl(i) });
      if (s.key === 'thorns') acts.push({ label: 'Constricting Thorns', fn: () => castThorns(i) });
      if (s.key === 'fey')    acts.push({ label: 'Fey Luck (reroll)', fn: () => { F.feyLuck++; F.scrolls.splice(i, 1); logLine('You ready <span class="good">Fey Luck</span> — your next failed attack rerolls.'); render(); combatActions(); } });
    });
    setActions(acts);
  }

  function attackRound() {
    if (!F.combat) return;
    const m = F.combat.monster;

    // spider swarm grows each round before you strike
    if (m.swarm) { m.hp += 1; }

    let roll = d6();
    const natural1 = roll === 1;
    let atk = F.weapon.atk + F.attackBonus - F.starve;
    // dagger: reroll a natural 1
    if (natural1 && F.weapon.special === 'reroll') { const r2 = d6(); logLine(`<i>Dagger rerolls the 1 → ${r2}.</i>`); roll = r2; }
    // fey luck: reroll a failed attack
    let total = roll + atk;
    if (roll !== 1 && total < m.points && F.feyLuck > 0) {
      F.feyLuck--;
      const r2 = d6();
      logLine(`<span class="good">Fey Luck</span> rerolls → ${r2}.`);
      roll = r2; total = roll + atk;
    }

    const hitYou = (roll === 1) || (total < m.points);
    const dice = [{ tag: 'D6 ATK', val: roll, color: hitYou ? 'd-pink' : 'd-yellow' }];
    if (atk) dice.push({ tag: 'MOD', val: (atk > 0 ? '+' : '') + atk, color: 'd-yellow' });

    // wyvern in flight: melee no-effect, free attack
    if (m.flightRounds > 0 && !F.weapon.ranged) {
      m.flightRounds--;
      showDice(dice);
      logLine('The <b>wyvern</b> is aloft — your melee swing finds only air.');
      monsterHits('It dives:');
      if (F.over) return;
      render(); combatActions(); return;
    }
    if (m.flightRounds > 0) m.flightRounds--;

    if (!hitYou) {
      let dm = Math.max(1, d6() + dmgMod());
      if (F.owlFights > 0) dm += d6();
      if (m.armor) { const soak = d6(); dm = Math.max(0, dm - soak); }
      dice.push({ tag: 'DMG', val: dm });
      m.hp -= dm;
      showDice(dice);
      logLine(`You strike (${total} ≥ ${m.points}) for <span class="good">${dm}</span>.${m.armor ? ' <i>(armour soaked some)</i>' : ''} ${m.name} at ${Math.max(0, m.hp)} hp.`);
      // wyvern flight trigger on being hit
      if (m.special === 'wyvern' && m.hp > 0 && rollIn(2)) { m.flightRounds = 1; logLine('<i>The wyvern takes flight — only ranged weapons can touch it next round.</i>'); }
      // druid vanish on being hit
      if (m.special === 'druid' && m.hp > 0 && rollIn(1)) { logLine('<i>The druid melts into the bracken — it will return in your next fight.</i>'); F.druidReturning = true; endMonster(true); return; }
      if (m.hp <= 0) { monsterSlain(); return; }
    } else {
      showDice(dice);
      monsterHits(roll === 1 ? 'It always finds the gap (natural 1):' : `You fail (${total} < ${m.points}).`);
      if (F.over) return;
    }
    render();
    combatActions();
  }

  function monsterHits(prefix) {
    const m = F.combat.monster;
    let dm = m.dmgFn ? m.dmgFn() : d6();
    if (m.swarm) dm = d6() + Math.max(0, m.hp - 5);
    if (m.special === 'plant') dm += d6(); // pollen flare on a hit
    if (F.armorFights > 0) {
      const soak = d6();
      dm = Math.max(0, dm - soak);
      F.armorFights--;
      logLine(`${prefix} <span class="hit">${m.name} hits for ${dm}</span> <i>(armour −${soak}; ${F.armorFights} fights left)</i>.`);
    } else {
      logLine(`${prefix} <span class="hit">${m.name} hits you for ${dm}</span>.`);
    }
    hurt(dm);
  }

  function hurt(amount) {
    F.hp -= amount;
    if (amount > 0) flashHp();
    render();
    if (F.hp <= 0) die('Your blood soaks into the roots. <b>Kargunt is dead.</b>');
  }

  function endMonster(vanished) {
    // pollen / lingering damage cleanup, then advance queue or finish
    F.owlFights = Math.max(0, F.owlFights); // owl decremented per fight below
    advanceCombat(vanished);
  }

  function monsterSlain() {
    const m = F.combat.monster;
    heading('SLAIN');
    F.points += m.points;
    logLine(`<b>${m.name}</b> falls. <span class="good">+${m.points} points</span>.`);

    if (m.silver) { F.silver += m.silver; logLine(`<span class="gold">+${m.silver} silver.</span>`); }
    if (m.loot === 'item' && rollIn(1)) { grantStartItem(2 + Math.floor(Math.random() * 5)); logLine('It carried an <b>item</b>.'); }
    if (m.loot === 'weapon' && rollIn(1)) { const w = weaponByRoll(d6()); F.weapons.push(w); logLine(`It carried a <b>${w.name}</b>. <i>(Wield from PACK.)</i>`); }

    // tough-monster specials on death
    if (m.special === 'griffon') {
      const doses = d6();
      F.scrolls.push({ key: 'balm', name: 'Griffon Blood', uses: doses, eff: 'restore d6 HP' });
      logLine(`<span class="good">You bottle griffon blood — ${doses} doses, each heals d6 HP.</span>`);
    } else if (m.special === 'druid' && rollIn(2)) {
      const s = makeScroll(d6()); F.scrolls.push(s);
      logLine(`The druid leaves behind a scroll: <b>${s.name}</b>.`);
    } else if (m.special === 'zombie') {
      if (rollIn(1)) { F.combat = null; render(); die('Spores burrow into your lungs. You become part of the wood. Your adventure ends here.', 'spores'); return; }
      if (rollIn(3)) { logLine('<span class="hit">The fungal zombie rises again!</span>'); m.hp = d6(); m.maxHp = m.hp; render(); combatActions(); return; }
    } else if (m.special === 'plant' && rollIn(2)) {
      const f = sum(2, 6); F.armorFights += f;
      logLine(`<span class="good">You strip its leaves into armour (${f} fights of −d6 damage).</span>`);
    } else if (m.special === 'giant' && rollIn(2)) {
      logLine('<span class="good">The giant\'s death-roar lifts you a whole level!</span>');
      F.combat = null;
      doLevelUp(true);
      return;
    }

    advanceCombat(false);
  }

  function advanceCombat(vanished) {
    // a fight is over (slain or vanished): consume one owl-fight charge
    if (F.owlFights > 0) F.owlFights--;
    const queue = F.combat ? F.combat.queue : [];
    F.combat = null;

    // queued second monster?
    if (queue && queue.length) {
      const next = queue.shift();
      logLine('<i>The second foe lunges!</i>');
      startCombat(next, queue);
      return;
    }
    // druid returns to haunt the next fight
    if (F.druidReturning && !vanished) {
      F.druidReturning = false;
      logLine('<i>The vanished druid returns, vengeful!</i>');
      const dr = toughMonster();
      // force a druid
      const druid = mk('DRUID', 'druid', 4, () => Math.max(1, d6() - 1), d6() + 2, { tough: true, special: 'druid', silver: d6() });
      startCombat(druid, []);
      return;
    }

    const hex = curHex();
    if (hex) hex.explored = true;
    render();
    if (checkLevelUp()) return;
    if (hex && hex.trails.length === 0) rollTrails(hex);
    else presentHexActions();
  }

  function flee() {
    if (!F.combat) return;
    const dm = d6();
    const lost = d6();
    F.points = Math.max(0, F.points - lost);
    showDice([{ tag: 'D6 FLEE', val: dm, color: 'd-pink' }, { tag: 'PTS', val: '-' + lost }]);
    logLine(`You flee, taking <span class="hit">${dm} damage</span> and losing <span class="hit">${lost} points</span>.`);
    const queue = F.combat.queue;
    F.combat = null;
    if (F.owlFights > 0) F.owlFights--;
    hurt(dm);
    if (F.over) return;
    // fleeing abandons the whole encounter
    if (queue && queue.length) logLine('<i>You leave both foes behind.</i>');
    F.druidReturning = false;
    render();
    presentHexActions();
  }

  /* ── combat scrolls ───────────────────────────────────── */
  function castBalm(i) {
    const s = F.scrolls[i];
    const h = d6();
    F.hp = Math.min(F.maxHp, F.hp + h);
    s.uses--;
    if (s.uses <= 0) F.scrolls.splice(i, 1);
    showDice([{ tag: 'BALM d6', val: h, color: 'd-yellow' }]);
    logLine(`<span class="good">${s.name}</span> — you heal <span class="good">${h} HP</span>.`);
    render();
    if (F.combat) combatActions(); else presentHexActions();
  }
  function castOwl(i) {
    F.owlFights = 2;
    F.scrolls.splice(i, 1);
    logLine('<span class="good">A spectral owl</span> answers — +d6 damage for 2 fights.');
    render(); combatActions();
  }
  function castThorns(i) {
    if (!F.combat) return;
    const m = F.combat.monster;
    const dm = sum(2, 6);
    m.hp -= dm;
    F.scrolls.splice(i, 1);
    showDice([{ tag: 'THORNS 2d6', val: dm, color: 'd-pink' }]);
    logLine(`<span class="good">Constricting Thorns</span> crush ${m.name} for <span class="good">${dm}</span>.`);
    if (m.hp <= 0) { monsterSlain(); return; }
    render(); combatActions();
  }
  function rollIn(n) { return d6() <= n; } // n-in-6 chance

  /* ════════════════════════════════════════════════════════
     TINKERER (trade)
     ════════════════════════════════════════════════════════ */
  function openTinkerer(hex) {
    openOverlay('GNOMISH TINKERER', '', 'level');
    renderTinkerer(hex);
  }
  function renderTinkerer(hex) {
    const body = $('#overlay-body');
    body.innerHTML = `<p class="flavor">"Trinkets! Steel! Bottled whispers!"</p>
      <p><span class="gold">${F.silver} silver</span> · <b>${F.rations} rations</b></p>
      <p>Buys/sells items &amp; weapons for <b>10s</b>, scrolls for <b>20s</b>.</p>`;

    // sell your gear
    const sellables = [];
    F.weapons.forEach((w, i) => sellables.push({ nm: w.name + (w === F.weapon ? ' ◀' : ''), val: 10, disabled: F.weapons.length <= 1, take: () => { F.weapons.splice(i, 1); if (F.weapon === w) F.weapon = F.weapons[0]; } }));
    if (F.items.gloves)  sellables.push({ nm: 'Heavy gloves', val: 10, take: () => F.items.gloves = false });
    if (F.items.bedroll) sellables.push({ nm: 'Bedroll', val: 10, take: () => F.items.bedroll = false });
    if (F.items.messkit) sellables.push({ nm: 'Mess kit', val: 10, take: () => F.items.messkit = false });
    F.scrolls.forEach((s, i) => sellables.push({ nm: s.name, val: 20, take: () => F.scrolls.splice(i, 1) }));

    if (sellables.length) {
      body.appendChild(el('p', null, '<b>Sell:</b>'));
      sellables.forEach((s) => {
        const row = el('div', 'shop-row');
        row.innerHTML = `<span class="nm">${s.nm}</span><span class="pr">+${s.val}s</span>`;
        const b = el('button', 'act', 'Sell');
        if (s.disabled) b.disabled = true;
        else b.addEventListener('click', () => { s.take(); F.silver += s.val; render(); logLine(`Sold <b>${s.nm.replace(/ ◀$/, '')}</b> for <span class="gold">${s.val}s</span>.`); renderTinkerer(hex); });
        row.appendChild(b); body.appendChild(row);
      });
    }

    // buy
    const buys = [
      { nm: 'Random weapon', val: 10, do: () => F.weapons.push(weaponByRoll(d6())) },
      { nm: 'Heavy gloves',  val: 10, do: () => F.items.gloves = true,  has: () => F.items.gloves },
      { nm: 'Bedroll',       val: 10, do: () => F.items.bedroll = true, has: () => F.items.bedroll },
      { nm: 'Mess kit',      val: 10, do: () => F.items.messkit = true, has: () => F.items.messkit },
      { nm: 'Armour (2d6 fights)', val: 10, do: () => F.armorFights += sum(2, 6) },
      { nm: 'Random scroll', val: 20, do: () => F.scrolls.push(makeScroll(d6())) },
    ];
    body.appendChild(el('p', null, '<b>Buy:</b>'));
    buys.forEach((it) => {
      if (it.has && it.has()) return;
      const row = el('div', 'shop-row');
      row.innerHTML = `<span class="nm">${it.nm}</span><span class="pr">${it.val}s</span>`;
      const b = el('button', 'act', 'Buy');
      if (F.silver < it.val) b.disabled = true;
      else b.addEventListener('click', () => { F.silver -= it.val; it.do(); render(); logLine(`Bought <b>${it.nm}</b> for <span class="gold">${it.val}s</span>.`); renderTinkerer(hex); });
      row.appendChild(b); body.appendChild(row);
    });

    setOverlayActions([{ label: 'Wave the gnome off', cls: 'primary', fn: () => { closeOverlay(); hex.explored = true; if (hex.trails.length === 0) rollTrails(hex); else presentHexActions(); } }]);
  }

  /* ════════════════════════════════════════════════════════
     PACK
     ════════════════════════════════════════════════════════ */
  function openPack() {
    openOverlay('YOUR PACK', '', 'level');
    const body = $('#overlay-body');
    body.innerHTML = '';
    body.appendChild(el('p', null, '<b>WEAPONS</b>'));
    F.weapons.forEach((w) => {
      const row = el('div', 'shop-row');
      const eq = w === F.weapon;
      row.innerHTML = `<span class="nm">${w.name}${eq ? ' ◀' : ''} <small>(d6${w.mod ? (w.mod > 0 ? '+' : '') + w.mod : ''}${w.note ? ' · ' + w.note : ''})</small></span>`;
      if (!eq) { const b = el('button', 'act', 'Wield'); b.addEventListener('click', () => { F.weapon = w; render(); openPack(); }); row.appendChild(b); }
      body.appendChild(row);
    });
    const gear = [];
    if (F.items.gloves)  gear.push('Heavy gloves <small class="cs-v">— +1 on hazard rolls</small>');
    if (F.items.bedroll) gear.push('Bedroll <small class="cs-v">— +1 healing in camp</small>');
    if (F.items.messkit) gear.push('Mess kit <small class="cs-v">— +2 rations on forage</small>');
    if (F.armorFights)   gear.push(`Armour <small class="cs-v">— −d6 damage for ${F.armorFights} more fights</small>`);
    body.appendChild(el('p', null, `<b>GEAR</b><br>${gear.length ? gear.join('<br>') : '<i>none</i>'}`));
    if (F.scrolls.length) {
      body.appendChild(el('p', null, `<b>SCROLLS</b><br>${F.scrolls.map((s) => `${s.name}${s.uses > 1 ? ` (${s.uses})` : ''} <small class="cs-v">— ${s.eff}</small>`).join('<br>')}`));
    }
    const acts = [];
    // out-of-combat usable scrolls
    F.scrolls.forEach((s, i) => {
      if (s.key === 'balm' && F.hp < F.maxHp) acts.push({ label: `Use ${s.name}`, cls: 'primary', fn: () => { closeOverlay(); castBalm(i); } });
      if (s.key === 'silent') acts.push({ label: 'Cast Silent Passage', fn: () => { F.silentHexes += d6(); s.uses--; if (s.uses <= 0) F.scrolls.splice(i, 1); logLine(`<span class="good">Silent Passage</span> — you move unseen for ${F.silentHexes} hexes.`); closeOverlay(); render(); presentHexActions(); } });
      if (s.key === 'weald') acts.push({ label: 'Cast Wealdken', fn: () => { const h = curHex(); s.uses--; if (s.uses <= 0) F.scrolls.splice(i, 1); h.trails = []; assignTrails(h, 3); logLine('<span class="good">Wealdken</span> reveals 3 trails.'); closeOverlay(); render(); presentHexActions(); } });
    });
    acts.push({ label: 'Close', fn: () => {
      closeOverlay();
      if (F.combat) return;
      if (F.pendingBarrow) barrowEntryActions(F.pendingBarrow);
      else presentHexActions();
    } });
    setOverlayActions(acts);
  }

  /* ════════════════════════════════════════════════════════
     LEVEL UP
     ════════════════════════════════════════════════════════ */
  function checkLevelUp() {
    if (F.points >= 15) { doLevelUp(false); return true; }
    return false;
  }

  function doLevelUp(fromGiant) {
    if (!fromGiant) F.points -= 15;
    let roll;
    const taken = Object.keys(F.levelTaken).length;
    if (taken >= 6) { roll = d6(); } // all taken; just give the boon again as a flat bonus
    else { do { roll = d6(); } while (F.levelTaken[roll]); }
    F.levelTaken[roll] = true;
    const eff = applyLevel(roll);
    heading('LEVEL UP');
    openOverlay('LEVEL UP', `<p>You cross a threshold of power.</p><p>D6 → <span class="die-inline">${roll}</span></p><p><b>${eff.title}</b></p><p class="flavor">${eff.text}</p>`, 'level');
    setOverlayActions([{ label: 'Onward', cls: 'primary', fn: () => { closeOverlay(); render(); if (F.combat) combatActions(); else { const h = curHex(); if (h && h.trails.length === 0 && !F.over) rollTrails(h); else presentHexActions(); } } }]);
    render();
  }

  function applyLevel(roll) {
    switch (roll) {
      case 1: F.attackBonus += 1; return { title: '+1 attack', text: 'Add +1 to all attack rolls.' };
      case 2: F.dmgBonus += 1; return { title: '+1 damage', text: 'Add +1 to all damage.' };
      case 3: F.feyLuck += 1; return { title: 'Reroll', text: 'You may reroll a die once (a Fey-Luck charge added).' };
      case 4: F.campHealBonus += 1; return { title: '+1 camp healing', text: 'Heal +1 more whenever you make camp.' };
      case 5: { const g = d6(); F.maxHp += g; F.hp += g; return { title: '+' + g + ' max HP', text: 'Your maximum hit points rise by d6 (=' + g + ').' }; }
      default: F.resupplyBonus += 1; F.title = 'KARGUNT, FRIEND OF THE GREEN'; return { title: 'Friend of the Green', text: 'The Fey Court favours you: +1 ration on every forage, and a fine new title.' };
    }
  }

  /* ════════════════════════════════════════════════════════
     BARROW / KEEP → DARK FORT detour
     ════════════════════════════════════════════════════════ */
  function barrowEntryActions(terrain) {
    setActions([
      { label: '⚔ Enter the ' + (terrain === 'Cursed Barrow' ? 'barrow' : 'keep'), cls: 'primary', fn: () => enterSubDungeon(terrain) },
      { label: '☰ Pack', cls: 'ghost', fn: openPack },
    ]);
  }

  function enterSubDungeon(terrain) {
    F.pendingBarrow = null;
    const rooms = sum(3, 6);
    logLine(`<i>You descend. ${rooms} rooms of old Dark Fort dark await.</i>`);
    const character = {
      hp: F.hp, maxHp: F.maxHp, silver: F.silver,
      weaponName: F.weapon.name, weaponMod: F.weapon.mod, weaponAtk: F.weapon.atk,
      attackBonus: F.attackBonus, dmgBonus: F.dmgBonus,
    };
    window.GameMode.current = 'fort-sub';
    window.DarkFort.startSub({
      maxRooms: rooms,
      character,
      label: terrain.toUpperCase(),
      onReturn: (result) => {
        // retain HP, silver and any level gains; points are NOT kept
        window.GameMode.current = 'forest';
        applyChrome();
        F.silver = result.silver;
        if (result.bonusMaxHp) F.maxHp += result.bonusMaxHp;
        if (result.bonusAttack) F.attackBonus += result.bonusAttack;
        F.hp = Math.min(F.maxHp, Math.max(0, result.hp));
        if (result.died) { render(); die(result.deathMsg || 'You died in the dark below the forest.'); return; }
        render();
        const hex = curHex();
        heading('BACK TO THE SURFACE');
        logLine(`You climb out of the ${terrain.toLowerCase()} into grey forest light.`);
        flavor('Whatever power you gained below, you keep. The dead keep their points.');
        drawScene();
        if (hex) { hex.explored = true; rollTrails(hex); }
      },
    });
  }

  /* ════════════════════════════════════════════════════════
     ENDINGS
     ════════════════════════════════════════════════════════ */
  function die(msg) {
    if (F.over) return;
    F.over = true;
    F.combat = null;
    render();
    heading('DEATH');
    logLine(msg);
    openOverlay('YOU DIED', `<img class="death-skull" src="assets/skull.png" alt="">
      <p>${msg}</p>
      <p>Hexes walked: <b>${Object.keys(F.hexes).length}</b> · Points: <b>${F.points}</b> · Silver: <b>${F.silver}</b></p>
      <p class="flavor">The forest keeps you forever.</p>`, 'death');
    setOverlayActions([
      { label: '☠ Roll a new rambler', cls: 'primary', fn: () => { closeOverlay(); startTitle(); } },
      { label: '‹ Menu', cls: 'ghost', fn: () => { closeOverlay(); window.GameMenu && window.GameMenu(); } },
    ]);
  }

  function winGame() {
    F.over = true;
    openOverlay('YOU ESCAPE', `<p>You break the treeline and the curse loosens its grip. You walk free of the Dark Forest — one of the very few who ever do.</p>
      <p>Points: <b>${F.points}</b> · Silver: <b>${F.silver}</b> · Hexes walked: <b>${Object.keys(F.hexes).length}</b></p>
      <p class="flavor">Congratulations, Kargunt.</p>`, 'level');
    setOverlayActions([
      { label: 'Wander anew', cls: 'primary', fn: () => { closeOverlay(); startTitle(); } },
      { label: '‹ Menu', cls: 'ghost', fn: () => { closeOverlay(); window.GameMenu && window.GameMenu(); } },
    ]);
  }

  /* ── overlay plumbing ─────────────────────────────────── */
  function openOverlay(title, bodyHtml, cls) {
    $('#overlay-title').className = cls || '';
    $('#overlay-title').textContent = title;
    $('#overlay-body').innerHTML = bodyHtml;
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

  window.DarkForest = { init: initMapClicks, start: startTitle };
})();
