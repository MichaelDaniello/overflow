/* ============================================================
   DARK FORT // DARK FOREST — BOOT + START MENU
   Owns the shared shell and lets the player pick which game to
   play. Each engine exposes { init, start }; the Barrow/Keep
   detour hands control between them via window.GameMode.
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

  window.GameMode = { current: null };

  const GOLD = '#c9a23f', CRIM = '#9e2533';

  // resolve assets relative to this script so depth doesn't matter
  let ASSET = 'assets/';
  try {
    const s = document.currentScript && document.currentScript.src;
    if (s) ASSET = s.replace(/js\/boot\.js.*$/, 'assets/');
  } catch (e) {}

  // the start screen uses the two atmospheric scene images
  let fortBg = null, forestBg = null;
  function loadMenuArt() {
    if (typeof Image === 'undefined' || fortBg) return;
    const onload = () => { if (window.GameMode.current === 'menu') drawMenuSplash(); };
    fortBg = new Image(); fortBg.onload = onload; fortBg.src = ASSET + 'darkfort.jpg';
    forestBg = new Image(); forestBg.onload = onload; forestBg.src = ASSET + 'darkforest.jpg';
  }

  // cover-fit an image into a panel rect (crop to fill, keep aspect)
  function coverInto(ctx, img, dx, dy, dw, dh) {
    if (!(img && img.width)) return false;
    const ar = img.width / img.height, par = dw / dh;
    let sw, sh, sx, sy;
    if (ar > par) { sh = img.height; sw = sh * par; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / par; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    return true;
  }

  function drawMenuSplash() {
    const canvas = $('#room-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    // base
    ctx.fillStyle = '#0b0a09'; ctx.fillRect(0, 0, W, H);

    // the two atmospheric scenes, cover-fit into each half
    if (!coverInto(ctx, fortBg, 0, 0, W / 2, H)) { ctx.fillStyle = '#17120d'; ctx.fillRect(0, 0, W / 2, H); }
    if (!coverInto(ctx, forestBg, W / 2, 0, W / 2, H)) { ctx.fillStyle = '#0e150e'; ctx.fillRect(W / 2, 0, W / 2, H); }

    // darken slightly + tint each side for mood and legibility
    ctx.fillStyle = 'rgba(8,6,4,0.28)'; ctx.fillRect(0, 0, W / 2, H);
    ctx.fillStyle = 'rgba(6,10,6,0.24)'; ctx.fillRect(W / 2, 0, W / 2, H);

    // divider
    ctx.strokeStyle = CRIM; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(W * 0.505, 0); ctx.lineTo(W * 0.495, H); ctx.stroke();

    // bottom fade for legible titles
    const bg = ctx.createLinearGradient(0, H * 0.62, 0, H);
    bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, 'rgba(0,0,0,0.88)');
    ctx.fillStyle = bg; ctx.fillRect(0, H * 0.62, W, H * 0.38);

    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD; ctx.font = 'bold 34px Anton, sans-serif';
    ctx.fillText('DARK FORT', W * 0.25, H - 52);
    ctx.fillText('DARK FOREST', W * 0.75, H - 52);
    ctx.fillStyle = CRIM; ctx.font = 'bold 15px Anton, sans-serif';
    ctx.fillText('THE CATACOMB', W * 0.25, H - 30);
    ctx.fillText('THE DEEP WOODS', W * 0.75, H - 30);
  }

  function drawMenuSkull(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = '#ded8c4';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, Math.PI, 0);
    ctx.arc(x, y + r * 0.1, r * 0.45, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(x - r * 0.4, y, r * 0.8, r * 0.35);
    ctx.fillRect(x - r * 0.25, y + r * 0.35, r * 0.5, r * 0.25);
    ctx.fillStyle = '#0a0a08';
    ctx.beginPath();
    ctx.arc(x - r * 0.21, y, r * 0.16, 0, 7);
    ctx.arc(x + r * 0.21, y, r * 0.16, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.08); ctx.lineTo(x - r * 0.09, y + r * 0.3); ctx.lineTo(x + r * 0.09, y + r * 0.3);
    ctx.fill();
    ctx.restore();
  }

  function showMenu() {
    window.GameMode.current = 'menu';
    document.body.classList.remove('forest');
    const mt = $('#mast-title'); if (mt) mt.textContent = 'MÖRK BORG';
    loadMenuArt();
    $('#stat4-lbl').textContent = '—';
    $('#stat4-max').textContent = '';
    $('#map-label').textContent = 'CHOOSE YOUR DOOM';

    // clear the sheet to neutral
    ['#stat-hp', '#stat-silver', '#stat-points', '#stat-rooms'].forEach((s) => { const n = $(s); if (n) n.textContent = '—'; });
    $('#stat-maxhp').textContent = '';
    $('#cs-name').textContent = 'KARGUNT';
    $('#stat-weapon').innerHTML = '—';
    $('#stat-pack').innerHTML = '<i>choose a game</i>';

    drawMenuSplash();
    // the menu art carries its own titles — hide the scene caption so it
    // doesn't overlap them (the games re-show it via setCaption)
    const cap = $('#scene-caption'); if (cap) { cap.textContent = ''; cap.style.display = 'none'; }
    $('#dice-tray').innerHTML = '';
    const mc = $('#map-canvas');
    if (mc) { const c = mc.getContext('2d'); mc.width = 640; mc.height = 120; c.fillStyle = '#0a0a08'; c.fillRect(0, 0, 640, 120); }

    const log = $('#log');
    log.innerHTML = '';
    log.appendChild(el('div', 'log-entry heading', 'TWO WAYS TO DIE BADLY'));
    log.appendChild(el('div', 'log-entry', '<b>DARK FORT</b> — Pelle Nilsson\'s original. Descend a bottomless catacomb room by room: roll the shape, the doors and the horror inside, and try to level up before a bad death finds you.'));
    log.appendChild(el('div', 'log-entry', '<b>DARK FOREST</b> — Nick Waber\'s hex-crawl tribute. Wander a cursed wood across a hex map: roll terrain, encounters and trails, forage and camp, and flee toward the treeline. Barrows and ruined keeps drop you back into Dark Fort.'));
    log.appendChild(el('div', 'log-entry flavor', 'The same rogue. The same name. Kargunt never learns.'));

    const actions = $('#actions');
    actions.innerHTML = '';
    const fort = el('button', 'act primary', '⚔ Play DARK FORT');
    fort.addEventListener('click', () => window.DarkFort.start());
    const forest = el('button', 'act', '🌲 Play DARK FOREST');
    forest.addEventListener('click', () => window.DarkForest.start());
    actions.appendChild(fort);
    actions.appendChild(forest);
  }

  window.GameMenu = showMenu;

  window.addEventListener('DOMContentLoaded', () => {
    if (window.DarkFort && window.DarkFort.init) window.DarkFort.init();
    if (window.DarkForest && window.DarkForest.init) window.DarkForest.init();
    showMenu();
  });
})();
