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

  function drawMenuSplash() {
    const canvas = $('#room-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#0a0a08';
    ctx.fillRect(0, 0, W, H);

    // left half — the catacomb (skull), right half — the forest (moon + trees)
    const C = (window.DarkFortArt && window.DarkFortArt.COL) || { yellow: '#ffe600', pink: '#ff2079' };

    // dividing slash
    ctx.strokeStyle = C.pink; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(W * 0.52, 0); ctx.lineTo(W * 0.48, H); ctx.stroke();

    // LEFT: skull on a torn plate (reuse the art engine if ready)
    try {
      if (window.DarkFortArt) {
        // a smaller skull, left-of-centre
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W * 0.5, H); ctx.clip();
        // grime
        ctx.fillStyle = 'rgba(255,230,0,0.05)';
        for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * W * 0.5, Math.random() * H, 2, 2);
        ctx.restore();
      }
    } catch (e) {}

    // RIGHT: a crude pine + moon
    ctx.fillStyle = '#16241a';
    ctx.fillRect(W * 0.52, 0, W * 0.48, H);
    ctx.fillStyle = 'rgba(255,230,0,0.85)';
    ctx.beginPath(); ctx.arc(W * 0.78, H * 0.28, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16241a';
    ctx.beginPath(); ctx.arc(W * 0.80, H * 0.25, 42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0c1810';
    for (let i = 0; i < 6; i++) {
      const x = W * 0.58 + i * (W * 0.07);
      const h = 120 + (i % 3) * 70;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const ty = H - 40 - k * h * 0.28;
        const w = (h * 0.3) * (1 - k * 0.2);
        ctx.moveTo(x - w, ty); ctx.lineTo(x, ty - h * 0.36); ctx.lineTo(x + w, ty);
      }
      ctx.fill();
    }

    // skull glyph on the left (drawn directly so it shows even before PNG loads)
    drawMenuSkull(ctx, W * 0.25, H * 0.42, 120);

    // headings
    ctx.textAlign = 'center';
    ctx.fillStyle = C.yellow;
    ctx.font = "bold 30px Anton, sans-serif";
    ctx.fillText('DARK FORT', W * 0.25, H - 60);
    ctx.fillText('DARK FOREST', W * 0.76, H - 60);
    ctx.fillStyle = C.pink;
    ctx.font = "bold 16px Anton, sans-serif";
    ctx.fillText('THE CATACOMB', W * 0.25, H - 36);
    ctx.fillText('THE DEEP WOODS', W * 0.76, H - 36);
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
    $('#mast-title').textContent = 'MÖRK BORG';
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
    $('#scene-caption').textContent = 'CHOOSE YOUR DOOM';
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
