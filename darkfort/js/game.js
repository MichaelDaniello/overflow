/* ============================================================
   DARK FORT — GAME ENGINE
   A faithful solo play of the Mörk Borg micro-RPG "Dark Fort".
   The dice drive both the rules AND the picture: every room's
   2d6 shape + d4 doors + encounter roll is handed to the art
   engine (art.js) and drawn on the canvas.
   ============================================================ */

(function () {
  'use strict';

  /* ── tiny DOM helpers ─────────────────────────────────── */
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
      unopenedDoors: 0,
      weapons: [startWeapon],
      weapon: startWeapon,
      attackBonus: 0,
      inv: { armor: 0, potions: 0, ropes: 0, cloaks: 0 },
      scrolls: [],
      halved: {},                 // monster name -> true
      levelList: [1, 2, 3, 4, 5, 6],
      falseOmen: null,            // chosen room-table result
      room: null,
      combat: null,
      aegisUses: 0,
      catacomb: 1,
      over: false,
    };
    // starting item (table B)
    grantStartItem(d(4));
  }

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
      case 3: G.scrolls.push(makeScroll(1)); break; // summon weak daemon
      default: G.inv.cloaks++; break;
    }
  }

  function makeScroll(r) {
    switch (r) {
      case 1: return { key: 'summon', name: 'Summon Weak Daemon', uses: 1, eff: 'd6 dmg' };
      case 2: return { key: 'palms',  name: 'Palms Open the Southern Gate', uses: d(4), eff: 'd6+1 dmg' };
      case 3: return { key: 'aegis',  name: 'Aegis of Sorrow', uses: d(4), eff: '-d4 dmg' };
      default:return { key: 'omen',   name: 'False Omen', uses: 1, eff: 'bend fate' };
    }
  }

  function addItem(r, silent) {
    switch (r) {
      case 1: { const w = weaponByRoll(d(4)); G.weapons.push(w);
                if (!silent) logLine(`A <b>${w.name}</b> (${dmgLabel(w.dmg)}${w.atk?` /+${w.atk} atk`:''}) lies among the filth. <i>Equip it from your PACK.</i>`); return; }
      case 2: G.inv.potions++; if (!silent) logLine('A <span class="good">potion</span> (heal d6 hp).'); return;
      case 3: G.inv.ropes++;   if (!silent) logLine('A coil of <b>rope</b> (+1 on trap rolls).'); return;
      case 4: { const sc = makeScroll(d(4)); G.scrolls.push(sc);
                if (!silent) logLine(`A <span class="good">scroll</span>: <b>${sc.name}</b> (${sc.eff}${sc.uses>1?`, ${sc.uses} uses`:''}).`); return; }
      case 5: G.inv.armor++;   if (!silent) logLine('A suit of <b>armor</b> (-d4 damage).'); return;
      default: G.inv.cloaks++; if (!silent) logLine('A <span class="good">cloak of invisibility</span>.'); return;
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
    if (r === 1) return mk('NECRO-SORCERER',   'sorcerer', 4, dmg(4),    8,  { tough: true, special: 'sorcerer' });
    if (r === 2) return mk('SMALL STONE TROLL','troll',    5, dmg(6, 1), 9,  { tough: true, killPoints: 7 });
    if (r === 3) return mk('MEDUSA',           'medusa',   4, dmg(6),    10, { tough: true, special: 'medusa' });
    return         mk('RUIN BASILISK',         'basilisk', 4, dmg(6),    11, { tough: true, special: 'basilisk' });
  }
  function mk(name, art, points, dspec, hp, extra) {
    return Object.assign({ name, art, points, dmg: dspec, hp, maxHp: hp, tough: false }, extra);
  }

  /* ════════════════════════════════════════════════════════
     RENDERING
     ════════════════════════════════════════════════════════ */
  function render() {
    if (!G) return;
    $('#cs-name').textContent  = G.title;
    $('#stat-hp').textContent  = Math.max(0, G.hp);
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
    G.scrolls.forEach((s) => p.push(`<span class="good">${s.name}${s.uses > 1 ? `(${s.uses})` : ''}</span>`));
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
    DarkFortArt.render(canvas, G.room.spec);
  }

  function flashHp() {
    document.querySelector('.stat.hp').classList.add('dmg-flash');
    document.querySelector('#scene-frame').classList.add('shake');
    setTimeout(() => {
      document.querySelector('.stat.hp').classList.remove('dmg-flash');
      document.querySelector('#scene-frame').classList.remove('shake');
    }, 450);
  }

  /* ════════════════════════════════════════════════════════
     ROOM SHAPES & DOORS
     ════════════════════════════════════════════════════════ */
  const SHAPE_2D6 = {
    2: 'Irregular cave', 3: 'Oval', 4: 'Cross-shaped', 5: 'Corridor',
    6: 'Square', 7: 'Square', 8: 'Square', 9: 'Round',
    10: 'Rectangular', 11: 'Triangular', 12: 'Skull-shaped',
  };
  function rollShape() {
    const a = d(6), b = d(6);
    return { shape: SHAPE_2D6[a + b], dice: [a, b] };
  }
  // door table d4: 1 none, 2 one, 3-4 two
  function rollDoors() {
    const r = d(4);
    const n = r === 1 ? 0 : r === 2 ? 1 : 2;
    return { n, roll: r };
  }

  /* ════════════════════════════════════════════════════════
     GAME FLOW
     ════════════════════════════════════════════════════════ */
  function startTitle() {
    DarkFortArt.renderTitle(canvas);
    setCaption('DARK FORT');
    logBox.innerHTML = '';
    heading('THE CATACOMB ROGUE ENTERS THE STAGE');
    flavor('A dying world. A bottomless catacomb. One torch, one blade, and the certainty of a bad death. You are Kargunt.');
    diceTray.innerHTML = '';
    setActions([{ label: '⚔ Enter the Dark Fort', cls: 'primary', fn: beginRun }]);
  }

  function beginRun() {
    newGame();
    render();
    logBox.innerHTML = '';
    heading('YOU ARE KARGUNT');
    logLine(`You begin with <span class="hit">${G.hp} hp</span>, <span class="gold">${G.silver} silver</span>, a <b>${G.weapon.name}</b> (${dmgLabel(G.weapon.dmg)}${G.weapon.atk?` /+${G.weapon.atk} atk`:''}) and ${describeStartItem()}.`);
    enterEntrance();
  }

  function describeStartItem() {
    if (G.inv.armor)   return 'a suit of <b>armor</b>';
    if (G.inv.potions) return 'a <b>potion</b>';
    if (G.scrolls.length) return `a scroll of <b>${G.scrolls[0].name}</b>`;
    if (G.inv.cloaks)  return 'a <b>cloak of invisibility</b>';
    return 'nothing else';
  }

  function enterEntrance() {
    const sh = rollShape();
    const r = d(4); // entrance: doors AND event
    G.room = {
      newDoors: r,                // entrance: d4 doors lead further in
      explored: false,
      spec: { seed: (Math.random() * 1e9) | 0, shape: sh.shape, doors: r, encounter: { kind: 'nothing' } },
    };
    heading('ENTRANCE ROOM');
    showDice([
      { tag: '2d6 SHAPE', val: sh.dice[0] + sh.dice[1], color: 'd-yellow' },
      { tag: 'D4 DOORS', val: r, color: 'd-pink' },
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
      logLine(`A dying mystic presses a scroll into your hand: <b>${sc.name}</b> (${sc.eff}${sc.uses>1?`, ${sc.uses} uses`:''}).`);
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

  /* ── advancing to a new room ──────────────────────────── */
  function venture() {
    if (G.unopenedDoors <= 0) { deadEnd(); return; }
    G.unopenedDoors--;       // pass through one unopened door
    enterRoom();
  }

  function enterRoom() {
    const sh = rollShape();
    const doors = rollDoors();
    let result;
    if (G.falseOmen != null) { result = G.falseOmen; G.falseOmen = null; }
    else result = d(6);

    G.room = {
      newDoors: doors.n,
      explored: false,
      spec: { seed: (Math.random() * 1e9) | 0, shape: sh.shape, doors: doors.n, encounter: { kind: 'nothing' } },
    };

    heading('A NEW ROOM');
    showDice([
      { tag: '2d6 SHAPE', val: sh.dice[0] + sh.dice[1], color: 'd-yellow' },
      { tag: 'D4 DOORS', val: doors.roll, color: 'd-pink' },
      { tag: 'D6 ROOM', val: result },
    ]);
    setCaption(`${sh.shape.toUpperCase()} · ${doors.n} DOOR${doors.n !== 1 ? 'S' : ''}`);
    flavor(`A ${sh.shape.toLowerCase()} room opens before you, with ${doors.n === 0 ? 'no further doors' : doors.n + ' door' + (doors.n !== 1 ? 's' : '')}.`);

    resolveRoom(result, sh);
    render();
  }

  function resolveRoom(result, sh) {
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
        let r = d(6);
        let bonus = 0;
        if (G.inv.ropes > 0) { bonus = 1; }
        const total = r + bonus;
        showDice([{ tag: 'D6 TRAP', val: r, color: 'd-pink' }].concat(bonus ? [{ tag: 'ROPE', val: '+1', color: 'd-yellow' }] : []));
        if (total <= 3) {
          const dm = d(6);
          logLine(`The floor gives way! You take <span class="hit">${dm} damage</span>.${bonus?' (rope softened the fall)':''}`);
          damagePlayer(dm, true);
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
          damagePlayer(dm, true);
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
    if (G.room && !G.room.explored) {
      G.room.explored = true;
      G.unopenedDoors += G.room.newDoors;
      G.roomsExplored++;
    }
    render();
    if (checkLevelUp()) return; // level-up overlay takes over
    presentRoomActions();
  }

  function presentRoomActions() {
    const canVenture = G.unopenedDoors > 0;
    const acts = [];
    if (canVenture) {
      acts.push({ label: `⛧ Venture through a door (${G.unopenedDoors} open)`, cls: 'primary', fn: venture });
    } else {
      acts.push({ label: '⛧ Try the last door…', cls: 'danger', fn: deadEnd });
    }
    acts.push({ label: '☰ Pack', cls: 'ghost', fn: openInventory });
    if (hasOmen() && canVenture) acts.push({ label: '👁 False Omen (pick room)', fn: castOmenRoom });
    setActions(acts);
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
      { label: `Flee (d4 dmg)`, cls: 'danger', fn: flee },
    ];
    if (G.inv.potions > 0) acts.push({ label: `Drink potion (${G.inv.potions})`, fn: () => { drinkPotion(); combatActions(); } });
    if (G.inv.cloaks > 0)  acts.push({ label: `Cloak away (${G.inv.cloaks})`, cls: 'ghost', fn: cloakEscape });
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
    // armor
    if (G.inv.armor > 0) {
      const a = d(4);
      dm = Math.max(0, dm - a);
      note += ` armor −${a};`;
    }
    // aegis
    if (G.aegisUses > 0) {
      const a = d(4);
      dm = Math.max(0, dm - a);
      G.aegisUses--;
      note += ` aegis −${a};`;
    }
    logLine(`${prefix} <span class="hit">${m.name} hits you (${tag})</span> for <span class="hit">${dm}</span>.${note ? ' (' + note.trim() + ')' : ''}`);
    damagePlayer(dm, false, true);
  }

  function damagePlayer(amount, ignoreArmorAlreadyHandled, fromMonster) {
    G.hp -= amount;
    if (amount > 0) flashHp();
    render();
    if (G.hp <= 0) {
      die('Your wounds open and the dark drinks you down. <b>Kargunt is dead.</b>');
    }
  }

  function monsterSlain() {
    const m = G.combat.monster;
    const earned = m.killPoints || m.points;
    G.points += earned;
    heading('SLAIN');
    logLine(`<b>${m.name}</b> falls. You earn <span class="good">${earned} points</span>.`);

    // loot
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
    render();
    // room becomes explored
    if (G.room && !G.room.explored) {
      G.room.explored = true;
      G.unopenedDoors += G.room.newDoors;
      G.roomsExplored++;
      render();
    }
    if (leveledByBasilisk) { doLevelUp('basilisk'); return; }
    if (checkLevelUp()) return;
    presentRoomActions();
  }

  function flee() {
    if (!G.combat) return;
    const dm = d(4);
    showDice([{ tag: 'D4 FLEE', val: dm, color: 'd-pink' }]);
    logLine(`You flee, taking <span class="hit">${dm} damage</span>. The room is left unexplored.`);
    const door = G.room.newDoors;       // you back out; that door stays open behind you
    G.combat = null;
    damagePlayer(dm, false);
    if (G.over) return;
    // fleeing: room not explored, you retreat to the corridor; the door you came through is spent.
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
     SHOP (peddler)
     ════════════════════════════════════════════════════════ */
  const SHOP = [
    { name: 'Potion (heal d6 hp)', price: 4,  buy: () => G.inv.potions++ },
    { name: 'Random scroll',       price: 7,  buy: () => G.scrolls.push(makeScroll(d(4))) },
    { name: 'Dagger (d4 /+1 atk)', price: 6,  buy: () => G.weapons.push(weaponByRoll(2)) },
    { name: 'Rope (+1 trap roll)', price: 5,  buy: () => G.inv.ropes++ },
    { name: 'Warhammer (d6)',      price: 9,  buy: () => G.weapons.push(weaponByRoll(1)) },
    { name: 'Sword (d6 /+1 atk)',  price: 12, buy: () => G.weapons.push(weaponByRoll(3)) },
    { name: 'Flail (d6+1)',        price: 15, buy: () => G.weapons.push(weaponByRoll(4)) },
    { name: 'Mighty Zweihänder (d6+2)', price: 25, buy: () => G.weapons.push({ name: 'Mighty Zweihänder', dmg: dmg(6, 2), atk: 0 }) },
    { name: 'Armor (−d4 damage)',  price: 10, buy: () => G.inv.armor++ },
    { name: 'Cloak of invisibility', price: 15, buy: () => G.inv.cloaks++ },
  ];

  function openShop() {
    openOverlay('THE PEDDLER', '', () => {});
    renderShop();
  }

  function renderShop() {
    const body = $('#overlay-body');
    body.innerHTML = `<p class="flavor">"Blood-soaked coin only, wanderer."</p>
      <p><span class="gold">You hold ${G.silver} silver.</span></p>`;
    SHOP.forEach((item, i) => {
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
    // sell some things back at half-ish value
    const sellables = [];
    if (G.inv.potions) sellables.push({ nm: 'Potion', val: 2, take: () => G.inv.potions-- });
    if (G.inv.ropes)   sellables.push({ nm: 'Rope', val: 2, take: () => G.inv.ropes-- });
    if (G.weapons.length > 1) sellables.push({ nm: G.weapons[G.weapons.length-1].name, val: 4, take: () => {
      const w = G.weapons.pop(); if (G.weapon === w) G.weapon = G.weapons[0];
    } });
    if (sellables.length) {
      body.appendChild(el('p', null, '<b>Sell:</b>'));
      sellables.forEach((s) => {
        const row = el('div', 'shop-row');
        row.innerHTML = `<span class="nm">${s.nm}</span><span class="pr">+${s.val}s</span>`;
        const b = el('button', 'act', 'Sell');
        b.addEventListener('click', () => { s.take(); G.silver += s.val; render(); logLine(`Sold <b>${s.nm}</b> for <span class="gold">${s.val}s</span>.`); renderShop(); });
        row.appendChild(b); body.appendChild(row);
      });
    }
    setOverlayActions([{ label: 'Leave the stall', cls: 'primary', fn: () => { closeOverlay(); logLine('The peddler dissolves into smoke. The room is explored.'); finishRoom(); } }]);
  }

  /* ════════════════════════════════════════════════════════
     INVENTORY
     ════════════════════════════════════════════════════════ */
  function openInventory() {
    openOverlay('YOUR PACK', '', () => {});
    const body = $('#overlay-body');
    body.innerHTML = '';
    // weapons
    body.appendChild(el('p', null, '<b>WEAPONS</b>'));
    G.weapons.forEach((w) => {
      const row = el('div', 'shop-row');
      const equipped = w === G.weapon;
      row.innerHTML = `<span class="nm">${w.name} <small>(${dmgLabel(w.dmg)}${w.atk?` /+${w.atk} atk`:''})</small>${equipped?' ◀ wielded':''}</span>`;
      if (!equipped) {
        const b = el('button', 'act', 'Wield');
        b.addEventListener('click', () => { G.weapon = w; render(); openInventory(); });
        row.appendChild(b);
      }
      body.appendChild(row);
    });
    // consumables
    const cons = [];
    if (G.inv.potions) cons.push(`Potion ×${G.inv.potions}`);
    if (G.inv.armor)   cons.push(`Armor ×${G.inv.armor}`);
    if (G.inv.ropes)   cons.push(`Rope ×${G.inv.ropes}`);
    if (G.inv.cloaks)  cons.push(`Cloak ×${G.inv.cloaks}`);
    body.appendChild(el('p', null, `<b>GEAR</b><br>${cons.length ? cons.join(' · ') : '<i>none</i>'}`));
    if (G.scrolls.length) {
      body.appendChild(el('p', null, `<b>SCROLLS</b><br>${G.scrolls.map((s) => `${s.name}${s.uses>1?` (${s.uses})`:''}`).join('<br>')}`));
    }
    const acts = [];
    if (G.inv.potions > 0 && G.hp < G.maxHp) acts.push({ label: 'Drink potion', cls: 'primary', fn: () => { drinkPotion(); openInventory(); } });
    acts.push({ label: 'Close', fn: closeOverlay });
    setOverlayActions(acts);
  }

  /* ════════════════════════════════════════════════════════
     FALSE OMEN — pick next room result
     ════════════════════════════════════════════════════════ */
  function hasOmen() { return G.scrolls.some((s) => s.key === 'omen'); }
  function castOmenRoom() {
    const idx = G.scrolls.findIndex((s) => s.key === 'omen');
    if (idx < 0) return;
    openOverlay('FALSE OMEN', '<p class="flavor">You bend fate. Choose what the next room holds.</p>', () => {});
    const labels = ['Nothing', 'Pit trap', 'Soothsayer', 'Weak monster', 'Tough monster', 'Peddler'];
    setOverlayActions(labels.map((lab, i) => ({
      label: `${i + 1}. ${lab}`,
      cls: i === 5 ? 'primary' : '',
      fn: () => { G.scrolls.splice(idx, 1); G.falseOmen = i + 1; closeOverlay(); render(); venture(); },
    })));
  }

  /* ════════════════════════════════════════════════════════
     LEVEL UP
     ════════════════════════════════════════════════════════ */
  function checkLevelUp() {
    if (G.levelList.length === 0) return false;
    if (G.roomsExplored >= 12 && G.points >= 15) { doLevelUp('points'); return true; }
    if (G.silver >= 40) { doLevelUp('silver'); return true; }
    return false;
  }

  function doLevelUp(via) {
    // pay the cost / reset
    let how = '';
    if (via === 'points') { G.points = 0; G.roomsExplored = 0; how = 'You have braved 12 rooms and earned glory. (Points reset; a fresh catacomb beckons.)'; }
    else if (via === 'silver') { G.silver -= 40; how = 'You return 40 silver to the poor of the ruined Wästland homes.'; }
    else if (via === 'basilisk') { how = 'The basilisk\'s death-magic hurls you to a higher station.'; }
    render();

    // roll a fresh result off the list
    let roll;
    do { roll = d(6); } while (!G.levelList.includes(roll));
    G.levelList = G.levelList.filter((x) => x !== roll);

    const eff = applyLevelEffect(roll);
    heading('LEVEL UP');
    openOverlay('LEVEL UP', `<p>${how}</p><p>You roll a <span class="die-inline">${roll}</span> on the boons table:</p><p><b>${eff.title}</b></p><p class="flavor">${eff.text}</p>`, () => {}, 'level');

    if (eff.chooser) {
      eff.chooser();   // sets its own overlay actions
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
        return { title: 'Sworn foes', text: 'Choose one WEAK and one TOUGH monster — from now on their damage is halved. This can never be changed.', chooser: chooseHalved };
    }
  }

  function chooseHalved() {
    const weak = ['BLOOD-DRENCHED SKELETON', 'CATACOMB CULTIST', 'GOBLIN', 'UNDEAD HOUND'];
    const tough = ['NECRO-SORCERER', 'SMALL STONE TROLL', 'MEDUSA', 'RUIN BASILISK'];
    let pickWeak = null;
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
    let tWrapPick = null;
    weak.forEach((nm) => { const b = el('button', 'act', nm); b.addEventListener('click', () => { pickWeak = nm; markChosen(wWrap, b); finish(); }); wWrap.appendChild(b); });
    tough.forEach((nm) => { const b = el('button', 'act', nm); b.addEventListener('click', () => { tWrapPick = nm; markChosen(tWrap, b); finish(); }); tWrap.appendChild(b); });
    finish();
  }
  function markChosen(wrap, btn) {
    wrap.querySelectorAll('button').forEach((x) => x.classList.remove('primary'));
    btn.classList.add('primary');
  }

  /* ════════════════════════════════════════════════════════
     ENDINGS
     ════════════════════════════════════════════════════════ */
  function damageNoArmor() {}

  function deadEnd() {
    if (G.unopenedDoors > 0) { venture(); return; }
    die('No door. No way on. You have reached a dead end and the catacomb becomes your tomb. <b>Your adventure is over.</b>', 'deadend');
  }

  function die(msg, kind) {
    if (G.over) return;
    G.over = true;
    G.combat = null;
    render();
    heading('DEATH');
    logLine(msg);
    openOverlay('YOU DIED', `<p>${msg}</p>
      <p>Rooms explored: <b>${G.roomsExplored}</b> · Points: <b>${G.points}</b> · Silver: <b>${G.silver}</b> · Catacomb: <b>${G.catacomb}</b></p>
      <p class="flavor">Everything you knew blackens and burns.</p>`, () => {}, 'death');
    setOverlayActions([{ label: '☠ Roll a new rogue', cls: 'primary', fn: () => { closeOverlay(); startTitle(); } }]);
  }

  function winGame() {
    G.over = true;
    openOverlay('YOU RETIRE', `<p>Every boon is claimed. You retire and remain in your cottage or castle until the 7th Misery occurs and everything you know blackens and burns.</p>
      <p class="flavor">Congratulations, Kargunt.</p>`, () => {}, 'level');
    setOverlayActions([{ label: 'Begin anew', cls: 'primary', fn: () => { closeOverlay(); startTitle(); } }]);
  }

  /* ── overlay plumbing ─────────────────────────────────── */
  function openOverlay(title, bodyHtml, _onClose, cls) {
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

  /* ── boot ─────────────────────────────────────────────── */
  window.addEventListener('DOMContentLoaded', startTitle);
})();
