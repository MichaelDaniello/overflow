/* ============================================================
   DARK FOREST — ART ENGINE
   Draws the current hex's terrain backdrop and whatever the
   encounter dice produced (monster, trickster, tinkerer, hazard),
   in the same filthy Mörk Borg ink style as the Dark Fort rooms.
   The hex-map grid itself is drawn by forest.js (it owns state);
   this file paints the big "scene" canvas and the creatures.
   ============================================================ */

(function () {
  'use strict';

  const COL = {
    black:  '#0a0a08',
    ink:    '#14160f',
    paper:  '#e9e4d4',
    bone:   '#ded8c4',
    yellow: '#ffe600',
    pink:   '#ff2079',
    blood:  '#a01818',
    green:  '#6cff4a',
    moss:   '#3a5a2a',
    mossD:  '#243a1a',
    bark:   '#2a2018',
    stone:  '#8a8470',
  };

  // 2d6 → terrain, plus a colour for the map tile and a scene key.
  const TERRAIN = {
    'Cursed Barrow': { col: '#473a52', key: 'barrow', sub: true },
    'Fetid pond':    { col: '#2c3a2c', key: 'pond' },
    'Pine barrens':  { col: '#27392b', key: 'pine' },
    'Fen/Bog':       { col: '#373a22', key: 'bog' },
    'Deep forest':   { col: '#18281b', key: 'forest' },
    'Burned land':   { col: '#221d18', key: 'burned' },
    'Crags':         { col: '#3d3c37', key: 'crags' },
    'Ravine':        { col: '#1b1922', key: 'ravine' },
    'Ruined Keep':   { col: '#3a352d', key: 'keep', sub: true },
  };

  const TERRAIN_2D6 = {
    2: 'Cursed Barrow', 3: 'Fetid pond', 4: 'Pine barrens',
    5: 'Fen/Bog', 6: 'Fen/Bog', 7: 'Deep forest', 8: 'Deep forest',
    9: 'Burned land', 10: 'Crags', 11: 'Ravine', 12: 'Ruined Keep',
  };

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function splatter(ctx, x, y, rnd, color, max) {
    ctx.fillStyle = color;
    const blobs = 6 + Math.floor(rnd() * 10);
    for (let i = 0; i < blobs; i++) {
      const a = rnd() * Math.PI * 2, dd = rnd() * max, r = 1 + rnd() * (max * 0.18);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * dd, y + Math.sin(a) * dd, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function halo(ctx, cx, cy, r, color) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function limb(ctx, x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  /* ── a single far tree silhouette ─────────────────────── */
  function tree(ctx, x, baseY, h, col, kind) {
    ctx.fillStyle = col;
    if (kind === 'pine') {
      ctx.fillRect(x - 2, baseY - h * 0.2, 4, h * 0.2);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const ty = baseY - h * 0.2 - i * h * 0.26;
        const w = (h * 0.32) * (1 - i * 0.22);
        ctx.moveTo(x - w, ty);
        ctx.lineTo(x, ty - h * 0.34);
        ctx.lineTo(x + w, ty);
      }
      ctx.fill();
    } else if (kind === 'dead') {
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x, baseY - h);
      ctx.moveTo(x, baseY - h * 0.6); ctx.lineTo(x - h * 0.25, baseY - h * 0.85);
      ctx.moveTo(x, baseY - h * 0.45); ctx.lineTo(x + h * 0.22, baseY - h * 0.7);
      ctx.stroke();
    } else {
      ctx.fillRect(x - 3, baseY - h * 0.45, 6, h * 0.45);
      ctx.beginPath();
      ctx.ellipse(x, baseY - h * 0.62, h * 0.34, h * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ── terrain backdrops ────────────────────────────────── */
  function drawTerrain(ctx, W, H, terrain, rnd) {
    const info = TERRAIN[terrain] || TERRAIN['Deep forest'];
    // sky / depth gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0c0e09');
    g.addColorStop(0.55, info.col);
    g.addColorStop(1, COL.black);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const horizon = H * 0.62;
    const key = info.key;

    // distant tree wall for forested terrains
    if (key === 'forest' || key === 'pine' || key === 'bog') {
      const kind = key === 'pine' ? 'pine' : 'round';
      for (let i = 0; i < 14; i++) {
        const x = (i / 13) * W + (rnd() - 0.5) * 30;
        const h = 120 + rnd() * 160;
        tree(ctx, x, horizon + 30, h, key === 'forest' ? COL.mossD : '#20301c', kind);
      }
    }
    if (key === 'burned') {
      for (let i = 0; i < 11; i++) {
        tree(ctx, (i / 10) * W + (rnd() - 0.5) * 20, horizon + 20, 90 + rnd() * 150, '#0d0b09', 'dead');
      }
      // smoulder
      ctx.fillStyle = 'rgba(160,24,24,0.25)';
      for (let i = 0; i < 30; i++) ctx.fillRect(rnd() * W, horizon + rnd() * (H - horizon), 2, 2);
    }
    if (key === 'pine') {
      ctx.fillStyle = '#1b2a1d';
      ctx.fillRect(0, horizon + 20, W, H - horizon);
    }

    // ground
    ctx.fillStyle = info.col;
    ctx.fillRect(0, horizon, W, H - horizon);

    if (key === 'pond' || key === 'bog') {
      // a sickly pool
      ctx.fillStyle = key === 'pond' ? '#1d2c1c' : '#2a2e16';
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.82, W * 0.40, H * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(108,255,74,0.25)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(W / 2, H * 0.82, W * (0.18 + i * 0.07), H * (0.06 + i * 0.03), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // reeds
      ctx.strokeStyle = '#3a3a1e'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 16; i++) {
        const x = rnd() * W, hh = 20 + rnd() * 50;
        ctx.beginPath(); ctx.moveTo(x, H * 0.86); ctx.lineTo(x + (rnd() - 0.5) * 14, H * 0.86 - hh); ctx.stroke();
      }
    }
    if (key === 'crags') {
      ctx.fillStyle = '#4a4842'; ctx.strokeStyle = COL.black; ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const x = (i / 5) * W, bw = 60 + rnd() * 70, bh = 80 + rnd() * 150;
        ctx.beginPath();
        ctx.moveTo(x - bw / 2, H); ctx.lineTo(x - bw * 0.15, H - bh);
        ctx.lineTo(x + bw * 0.2, H - bh * 0.8); ctx.lineTo(x + bw / 2, H);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    if (key === 'ravine') {
      ctx.fillStyle = COL.black;
      ctx.beginPath();
      ctx.moveTo(W * 0.2, horizon);
      ctx.lineTo(W * 0.44, H); ctx.lineTo(W * 0.56, H);
      ctx.lineTo(W * 0.8, horizon);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#2a2832'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(W * (0.3 + i * 0.02), horizon + i * 14);
        ctx.lineTo(W * (0.48 + i * 0.008), H - i * 20);
        ctx.stroke();
      }
    }
    if (key === 'barrow') {
      ctx.fillStyle = '#2c2436';
      ctx.beginPath();
      ctx.ellipse(W / 2, H * 0.9, W * 0.42, H * 0.28, 0, Math.PI, 0);
      ctx.fill();
      // black doorway into the mound
      ctx.fillStyle = COL.black;
      ctx.fillRect(W / 2 - 26, H * 0.74, 52, 90);
      ctx.beginPath(); ctx.arc(W / 2, H * 0.74, 26, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#5a4a6a'; ctx.lineWidth = 4; ctx.strokeRect(W / 2 - 26, H * 0.74, 52, 90);
      ctx.fillStyle = COL.green;
      for (let i = 0; i < 6; i++) ctx.fillRect(W / 2 - 18 + rnd() * 36, H * 0.78 + rnd() * 70, 2, 2);
    }
    if (key === 'keep') {
      ctx.fillStyle = '#46413a'; ctx.strokeStyle = COL.black; ctx.lineWidth = 4;
      const bx = W / 2 - 90;
      for (let i = 0; i < 3; i++) {
        const th = [150, 200, 130][i];
        ctx.fillRect(bx + i * 70, H - th, 56, th);
        ctx.strokeRect(bx + i * 70, H - th, 56, th);
        // crenellations
        for (let c = 0; c < 3; c++) ctx.fillRect(bx + i * 70 + c * 20, H - th - 12, 12, 12);
      }
      ctx.fillStyle = COL.black;
      ctx.fillRect(W / 2 - 18, H - 90, 36, 90);
      ctx.beginPath(); ctx.arc(W / 2, H - 90, 18, Math.PI, 0); ctx.fill();
    }

    // ground speckle + grime
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 120; i++) ctx.fillRect(rnd() * W, horizon + rnd() * (H - horizon), rnd() * 2, rnd() * 2);
    splatter(ctx, rnd() * W, rnd() * H * 0.3, rnd, COL.black, 50);
    if (rnd() < 0.4) splatter(ctx, rnd() * W, H * 0.8, rnd, COL.blood, 30);
  }

  /* ── creatures ────────────────────────────────────────── */
  function drawWolf(ctx, cx, cy, rnd) {
    const c = '#4a4640';
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, cy + 10, 60, 26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx - 56, cy - 6, 24, 18, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // snout
    ctx.beginPath(); ctx.moveTo(cx - 74, cy - 10); ctx.lineTo(cx - 100, cy - 2); ctx.lineTo(cx - 74, cy + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    // ears
    ctx.beginPath(); ctx.moveTo(cx - 48, cy - 22); ctx.lineTo(cx - 56, cy - 42); ctx.lineTo(cx - 40, cy - 26); ctx.fill();
    // legs
    limb(ctx, cx - 28, cy + 32, cx - 32, cy + 74, 8, c);
    limb(ctx, cx + 26, cy + 32, cx + 30, cy + 74, 8, c);
    limb(ctx, cx - 6, cy + 34, cx - 4, cy + 74, 8, c);
    limb(ctx, cx + 8, cy + 34, cx + 10, cy + 74, 8, c);
    // eye + fangs
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(cx - 60, cy - 8, 4, 0, 7); ctx.fill();
    ctx.fillStyle = COL.bone; ctx.beginPath(); ctx.moveTo(cx - 88, cy + 2); ctx.lineTo(cx - 84, cy + 12); ctx.lineTo(cx - 80, cy + 2); ctx.fill();
  }

  function drawBear(ctx, cx, cy, rnd) {
    const c = '#3a2c20';
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, 64, 60, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 48, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // ears
    ctx.beginPath(); ctx.arc(cx - 26, cy - 70, 11, 0, 7); ctx.arc(cx + 26, cy - 70, 11, 0, 7); ctx.fill(); ctx.stroke();
    // snout
    ctx.fillStyle = '#52402e'; ctx.beginPath(); ctx.ellipse(cx, cy - 38, 16, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx, cy - 44, 5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(cx - 13, cy - 54, 4, 0, 7); ctx.arc(cx + 13, cy - 54, 4, 0, 7); ctx.fill();
    // claws
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - 50 + i * 10, cy + 64); ctx.lineTo(cx - 50 + i * 10, cy + 80); ctx.stroke(); }
  }

  function drawWildman(ctx, cx, cy, rnd) {
    const skin = '#7a5a44';
    ctx.fillStyle = skin; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    // body
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, 26, 46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 40, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // war paint
    ctx.strokeStyle = COL.pink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 16, cy - 44); ctx.lineTo(cx + 16, cy - 44); ctx.stroke();
    ctx.strokeStyle = COL.bone; ctx.beginPath(); ctx.moveTo(cx - 10, cy - 34); ctx.lineTo(cx + 10, cy - 34); ctx.stroke();
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(cx - 8, cy - 42, 3, 0, 7); ctx.arc(cx + 8, cy - 42, 3, 0, 7); ctx.fill();
    // spear
    ctx.strokeStyle = COL.bark; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 38, cy + 60); ctx.lineTo(cx + 24, cy - 78); ctx.stroke();
    ctx.fillStyle = COL.bone; ctx.beginPath(); ctx.moveTo(cx + 24, cy - 78); ctx.lineTo(cx + 16, cy - 60); ctx.lineTo(cx + 32, cy - 64); ctx.fill();
    // legs/arms
    limb(ctx, cx - 12, cy + 60, cx - 18, cy + 84, 7, skin);
    limb(ctx, cx + 12, cy + 60, cx + 18, cy + 84, 7, skin);
  }

  function drawBandit(ctx, cx, cy, rnd) {
    ctx.fillStyle = '#3a3a42'; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    // cloaked body
    ctx.beginPath(); ctx.moveTo(cx, cy - 64); ctx.lineTo(cx + 44, cy + 76); ctx.lineTo(cx - 44, cy + 76); ctx.closePath(); ctx.fill(); ctx.stroke();
    // hood
    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(cx, cy - 52, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx, cy - 48, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.pink; ctx.beginPath(); ctx.arc(cx - 6, cy - 50, 3, 0, 7); ctx.arc(cx + 6, cy - 50, 3, 0, 7); ctx.fill();
    // armour glint + sword
    ctx.strokeStyle = COL.stone; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 34, cy + 30); ctx.lineTo(cx + 64, cy - 40); ctx.stroke();
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx + 26, cy + 4); ctx.lineTo(cx + 42, cy + 4); ctx.stroke();
  }

  function drawSpiders(ctx, cx, cy, rnd) {
    const spider = (x, y, s) => {
      ctx.fillStyle = '#1a1410'; ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
      for (let i = 0; i < 4; i++) {
        const a = 0.5 + i * 0.4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * s * 2.2, y - Math.sin(a) * s * 1.6);
        ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * s * 2.2, y - Math.sin(a) * s * 1.6); ctx.stroke();
      }
      ctx.fillStyle = COL.pink; ctx.beginPath(); ctx.arc(x - s * 0.3, y - s * 0.2, 1.5, 0, 7); ctx.arc(x + s * 0.3, y - s * 0.2, 1.5, 0, 7); ctx.fill();
    };
    for (let i = 0; i < 9; i++) {
      spider(cx + (rnd() - 0.5) * 180, cy + (rnd() - 0.3) * 150, 8 + rnd() * 12);
    }
    // web strands
    ctx.strokeStyle = 'rgba(222,216,196,0.3)'; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - 90 + rnd() * 180, cy - 90); ctx.lineTo(cx - 90 + rnd() * 180, cy + 80); ctx.stroke(); }
  }

  function drawGriffon(ctx, cx, cy, rnd) {
    const c = '#9a7a3a';
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, 40, 44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // wings
    ctx.fillStyle = '#7a5e2c';
    ctx.beginPath(); ctx.moveTo(cx - 20, cy - 10); ctx.lineTo(cx - 96, cy - 60); ctx.lineTo(cx - 30, cy + 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 20, cy - 10); ctx.lineTo(cx + 96, cy - 60); ctx.lineTo(cx + 30, cy + 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    // eagle head
    ctx.fillStyle = '#c8b878'; ctx.beginPath(); ctx.arc(cx, cy - 44, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.moveTo(cx - 4, cy - 50); ctx.lineTo(cx - 26, cy - 42); ctx.lineTo(cx - 4, cy - 36); ctx.fill();
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx + 6, cy - 50, 4, 0, 7); ctx.fill();
    // talons
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 14, cy + 60); ctx.lineTo(cx + i * 14, cy + 80); ctx.stroke(); }
  }

  function drawDruid(ctx, cx, cy, rnd) {
    ctx.fillStyle = COL.mossD; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx, cy - 70); ctx.lineTo(cx + 46, cy + 78); ctx.lineTo(cx - 46, cy + 78); ctx.closePath(); ctx.fill(); ctx.stroke();
    // antlered hood
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx, cy - 56, 20, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 70); ctx.lineTo(cx - 30, cy - 96); ctx.moveTo(cx - 24, cy - 88); ctx.lineTo(cx - 38, cy - 88);
    ctx.moveTo(cx + 12, cy - 70); ctx.lineTo(cx + 30, cy - 96); ctx.moveTo(cx + 24, cy - 88); ctx.lineTo(cx + 38, cy - 88);
    ctx.stroke();
    ctx.fillStyle = COL.green; ctx.beginPath(); ctx.arc(cx - 7, cy - 56, 3, 0, 7); ctx.arc(cx + 7, cy - 56, 3, 0, 7); ctx.fill();
    // staff
    limb(ctx, cx + 34, cy + 50, cx + 50, cy - 80, 5, COL.bark);
    halo(ctx, cx + 50, cy - 80, 22, 'rgba(108,255,74,0.5)');
    ctx.fillStyle = COL.green; ctx.beginPath(); ctx.arc(cx + 50, cy - 80, 7, 0, 7); ctx.fill();
  }

  function drawZombie(ctx, cx, cy, rnd) {
    const c = '#5a6a3a';
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, cy + 16, 30, 50, 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx - 6, cy - 44, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // fungal caps
    ctx.fillStyle = COL.pink;
    for (let i = 0; i < 5; i++) {
      const x = cx - 18 + rnd() * 40, y = cy - 70 + rnd() * 30;
      ctx.beginPath(); ctx.arc(x, y, 5 + rnd() * 5, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(cx - 12, cy - 46, 4, 0, 7); ctx.fill();
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx + 2, cy - 44, 5, 0, 7); ctx.fill();
    // lurching arm
    limb(ctx, cx + 12, cy - 12, cx + 52, cy - 24, 8, c);
    // spore haze
    ctx.fillStyle = 'rgba(108,255,74,0.12)';
    ctx.beginPath(); ctx.arc(cx, cy - 20, 90, 0, 7); ctx.fill();
  }

  function drawPlant(ctx, cx, cy, rnd) {
    const c = COL.moss;
    // stalk
    limb(ctx, cx, cy + 80, cx, cy - 20, 18, c);
    // bulbous maw
    ctx.fillStyle = '#7a2a3a'; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, cy - 34, 40, 50, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // teeth maw
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.ellipse(cx, cy - 30, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.bone;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 20, cy - 30 + Math.sin(a) * 28);
      ctx.lineTo(cx + Math.cos(a) * 12, cy - 30 + Math.sin(a) * 18);
      ctx.lineTo(cx + Math.cos(a + 0.3) * 20, cy - 30 + Math.sin(a + 0.3) * 28);
      ctx.fill();
    }
    // vines
    ctx.strokeStyle = c; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 16, cy + 10); ctx.quadraticCurveTo(cx - 70, cy, cx - 80, cy + 60); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 16, cy + 10); ctx.quadraticCurveTo(cx + 70, cy, cx + 80, cy + 50); ctx.stroke();
    // pollen
    ctx.fillStyle = 'rgba(255,230,0,0.2)';
    for (let i = 0; i < 30; i++) ctx.fillRect(cx - 90 + rnd() * 180, cy - 90 + rnd() * 120, 2, 2);
  }

  function drawWyvern(ctx, cx, cy, rnd) {
    const c = '#3a4a52';
    // wings spread
    ctx.fillStyle = '#2a3640'; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx - 10, cy - 20); ctx.lineTo(cx - 110, cy - 50); ctx.lineTo(cx - 70, cy + 10); ctx.lineTo(cx - 100, cy + 20); ctx.lineTo(cx - 20, cy + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 10, cy - 20); ctx.lineTo(cx + 110, cy - 50); ctx.lineTo(cx + 70, cy + 10); ctx.lineTo(cx + 100, cy + 20); ctx.lineTo(cx + 20, cy + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
    // body + neck
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx, cy + 24, 26, 36, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 16; ctx.strokeStyle = c; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy + 4); ctx.quadraticCurveTo(cx + 30, cy - 40, cx + 12, cy - 60); ctx.stroke();
    // head
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(cx + 10, cy - 64, 18, 13, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.moveTo(cx + 22, cy - 70); ctx.lineTo(cx + 44, cy - 74); ctx.lineTo(cx + 26, cy - 58); ctx.fill();
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(cx + 6, cy - 68, 4, 0, 7); ctx.fill();
    // tail stinger
    ctx.lineWidth = 12; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(cx, cy + 44); ctx.quadraticCurveTo(cx - 40, cy + 70, cx - 60, cy + 40); ctx.stroke();
    ctx.fillStyle = COL.bone; ctx.beginPath(); ctx.moveTo(cx - 60, cy + 40); ctx.lineTo(cx - 74, cy + 30); ctx.lineTo(cx - 58, cy + 28); ctx.fill();
  }

  function drawGiant(ctx, cx, cy, rnd) {
    const c = '#7a2422';
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 7; ctx.lineJoin = 'round';
    // hulking torso
    ctx.beginPath(); ctx.moveTo(cx - 54, cy - 40); ctx.lineTo(cx + 54, cy - 40); ctx.lineTo(cx + 70, cy + 80); ctx.lineTo(cx - 70, cy + 80); ctx.closePath(); ctx.fill(); ctx.stroke();
    // head
    ctx.beginPath(); ctx.arc(cx, cy - 62, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(cx - 12, cy - 64, 5, 0, 7); ctx.arc(cx + 12, cy - 64, 5, 0, 7); ctx.fill();
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.moveTo(cx - 14, cy - 48); ctx.lineTo(cx + 14, cy - 48); ctx.lineTo(cx, cy - 40); ctx.fill();
    // massive arms + fists
    limb(ctx, cx - 50, cy - 26, cx - 90, cy + 50, 20, c);
    limb(ctx, cx + 50, cy - 26, cx + 92, cy + 40, 20, c);
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx - 90, cy + 50, 18, 0, 7); ctx.arc(cx + 92, cy + 40, 18, 0, 7); ctx.fill(); ctx.stroke();
    // blood drip
    splatter(ctx, cx, cy + 80, rnd, COL.blood, 40);
  }

  /* ── non-combat encounters ────────────────────────────── */
  function drawTrickster(ctx, cx, cy, rnd) {
    halo(ctx, cx, cy, 150, 'rgba(255,32,121,0.25)');
    // little winged faerie
    ctx.fillStyle = COL.pink; ctx.strokeStyle = COL.black; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(cx, cy, 16, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - 30, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // wings
    ctx.fillStyle = 'rgba(255,230,0,0.5)';
    ctx.beginPath(); ctx.ellipse(cx - 24, cy - 6, 22, 12, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 24, cy - 6, 22, 12, 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx - 4, cy - 30, 2, 0, 7); ctx.arc(cx + 4, cy - 30, 2, 0, 7); ctx.fill();
    // sparkles
    ctx.strokeStyle = COL.yellow; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const a = rnd() * 7, dd = 50 + rnd() * 60, x = cx + Math.cos(a) * dd, y = cy + Math.sin(a) * dd;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.stroke();
    }
  }

  function drawTinkerer(ctx, cx, cy, rnd) {
    halo(ctx, cx, cy, 150, 'rgba(255,230,0,0.18)');
    // a gnome with a pack-cart
    ctx.fillStyle = '#5a3a22'; ctx.strokeStyle = COL.black; ctx.lineWidth = 4;
    ctx.fillRect(cx - 70, cy + 20, 80, 50); ctx.strokeRect(cx - 70, cy + 20, 80, 50);
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx - 56, cy + 74, 12, 0, 7); ctx.arc(cx - 6, cy + 74, 12, 0, 7); ctx.fill();
    // gnome
    ctx.fillStyle = '#3a5a3a'; ctx.beginPath(); ctx.moveTo(cx + 36, cy - 40); ctx.lineTo(cx + 58, cy + 40); ctx.lineTo(cx + 14, cy + 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    // pointed red hat
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.moveTo(cx + 36, cy - 70); ctx.lineTo(cx + 52, cy - 28); ctx.lineTo(cx + 20, cy - 28); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.bone; ctx.beginPath(); ctx.arc(cx + 36, cy - 20, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.black; ctx.beginPath(); ctx.arc(cx + 32, cy - 22, 2.5, 0, 7); ctx.arc(cx + 40, cy - 22, 2.5, 0, 7); ctx.fill();
    // trinkets
    ctx.fillStyle = COL.yellow;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cx - 60 + i * 18, cy + 38, 6, 0, 7); ctx.fill(); }
  }

  function drawHazard(ctx, cx, cy, rnd) {
    // lightning-split / falling rocks abstraction
    ctx.strokeStyle = COL.yellow; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 90); ctx.lineTo(cx - 22, cy - 20); ctx.lineTo(cx + 12, cy - 10);
    ctx.lineTo(cx - 14, cy + 70);
    ctx.stroke();
    ctx.fillStyle = COL.pink; ctx.font = "bold 40px Anton, sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('!', cx + 50, cy);
    splatter(ctx, cx, cy + 60, rnd, COL.blood, 40);
  }

  function drawNothing(ctx, cx, cy, scale, rnd) {
    // a quiet wayshrine / cairn
    ctx.fillStyle = COL.stone; ctx.strokeStyle = COL.black; ctx.lineWidth = 4;
    let y = cy + 60, w = 50;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + (rnd() - 0.5) * 8, y, w / 2, 12, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      y -= 24; w *= 0.78;
    }
  }

  const CREATURES = {
    wolf: drawWolf, bear: drawBear, wildman: drawWildman, bandit: drawBandit,
    spiders: drawSpiders, griffon: drawGriffon, druid: drawDruid, zombie: drawZombie,
    plant: drawPlant, wyvern: drawWyvern, giant: drawGiant,
  };

  /* ── main scene render ────────────────────────────────── */
  function renderHex(canvas, spec) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const rnd = mulberry32((spec.seed || 1) >>> 0);
    drawTerrain(ctx, W, H, spec.terrain, rnd);

    const cx = W / 2, cy = H * 0.5;
    const enc = spec.encounter || { kind: 'nothing' };
    if (enc.kind === 'monster') {
      const tough = enc.tough;
      halo(ctx, cx, cy + 30, 200, tough ? 'rgba(160,24,24,0.30)' : 'rgba(108,255,74,0.18)');
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(cx, cy + 130, 96, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(cx, cy + 24); ctx.scale(1.3, 1.3); ctx.translate(-cx, -(cy + 24));
      (CREATURES[enc.art] || drawWolf)(ctx, cx, cy + 24, rnd);
      ctx.restore();
    } else if (enc.kind === 'trickster') {
      drawTrickster(ctx, cx, cy + 10, rnd);
    } else if (enc.kind === 'tinkerer') {
      drawTinkerer(ctx, cx, cy + 10, rnd);
    } else if (enc.kind === 'hazard') {
      drawHazard(ctx, cx, cy + 10, rnd);
    } else {
      drawNothing(ctx, cx, cy, Math.min(W, H) * 0.4, rnd);
    }

    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  /* ── title splash ─────────────────────────────────────── */
  function renderTitle(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const rnd = mulberry32(7777);
    drawTerrain(ctx, W, H, 'Deep forest', rnd);
    // moon
    halo(ctx, W / 2, H * 0.32, 180, 'rgba(255,230,0,0.18)');
    ctx.fillStyle = '#cfc9a8';
    ctx.beginPath(); ctx.arc(W / 2, H * 0.3, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16281b';
    ctx.beginPath(); ctx.arc(W / 2 + 26, H * 0.27, 64, 0, Math.PI * 2); ctx.fill();
    // foreground gnarled trees framing
    tree(ctx, W * 0.12, H, 360, '#0a0f08', 'dead');
    tree(ctx, W * 0.88, H, 380, '#0a0f08', 'dead');
    ctx.fillStyle = COL.yellow; ctx.font = "bold 30px Anton, sans-serif"; ctx.textAlign = 'center';
    ctx.fillText('INTO THE DEEP WOODS', W / 2, H - 50);
  }

  window.DarkForestArt = { renderHex, renderTitle, TERRAIN, TERRAIN_2D6, COL };
})();
