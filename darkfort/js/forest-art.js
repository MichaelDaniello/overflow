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

  const Ink = window.Ink;
  const HATCH = 'rgba(8,10,6,0.32)';

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
    const c = '#34302a', dk = COL.black;
    const hatch = { color: HATCH, spacing: 5, angle: 0.5 };
    // far legs
    Ink.taper(ctx, cx + 22, cy + 30, cx + 30, cy + 72, 7, 4, { fill: '#26231e', stroke: dk, lw: 2 });
    Ink.taper(ctx, cx - 26, cy + 30, cx - 22, cy + 72, 7, 4, { fill: '#26231e', stroke: dk, lw: 2 });
    // body
    Ink.form(ctx, cc => {
      cc.moveTo(cx - 44, cy + 2);
      cc.quadraticCurveTo(cx - 50, cy - 18, cx - 30, cy - 16);
      cc.quadraticCurveTo(cx + 10, cy - 22, cx + 40, cy - 6);
      cc.quadraticCurveTo(cx + 58, cy + 2, cx + 44, cy + 20);
      cc.quadraticCurveTo(cx + 10, cy + 28, cx - 30, cy + 24);
      cc.quadraticCurveTo(cx - 46, cy + 18, cx - 44, cy + 2);
    }, { fill: c, stroke: dk, lw: 3, rnd, box: { x: cx - 50, y: cy - 22, w: 108, h: 50 }, hatch, shadeFrom: 'rgba(0,0,0,0.45)' });
    // near legs
    Ink.taper(ctx, cx - 30, cy + 22, cx - 34, cy + 74, 7, 4, { fill: c, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 30, cy + 22, cx + 34, cy + 74, 7, 4, { fill: c, stroke: dk, lw: 2 });
    // raised hackles
    for (let i = 0; i < 5; i++) Ink.spike(ctx, cx - 28 + i * 14, cy - 18, 8 + rnd() * 4, 4, 0.2, c);
    // head + snout
    Ink.form(ctx, cc => { cc.ellipse(cx - 52, cy - 2, 18, 14, -0.25, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 2.5, rnd });
    Ink.form(ctx, cc => { cc.moveTo(cx - 62, cy - 8); cc.lineTo(cx - 92, cy - 2); cc.lineTo(cx - 90, cy + 6); cc.lineTo(cx - 62, cy + 8); cc.closePath(); }, { fill: c, stroke: dk, lw: 2.5, rnd });
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx - 46, cy - 14); ctx.lineTo(cx - 52, cy - 32); ctx.lineTo(cx - 38, cy - 16); ctx.closePath(); ctx.fill();
    // snarl
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.moveTo(cx - 78, cy + 4); ctx.lineTo(cx - 90, cy + 8); ctx.lineTo(cx - 72, cy + 10); ctx.closePath(); ctx.fill();
    Ink.fang(ctx, cx - 84, cy + 2, 6, 1.8, COL.bone); Ink.fang(ctx, cx - 76, cy + 4, 6, 1.8, COL.bone);
    Ink.eye(ctx, cx - 56, cy - 4, 3, COL.yellow);
  }

  function drawBear(ctx, cx, cy, rnd) {
    const c = '#241a12', dk = COL.black;
    const hatch = { color: 'rgba(0,0,0,0.3)', spacing: 5, angle: 1.3 };
    // bulk body
    Ink.form(ctx, cc => {
      cc.moveTo(cx - 42, cy - 18);
      cc.quadraticCurveTo(cx - 58, cy + 40, cx - 36, cy + 72);
      cc.quadraticCurveTo(cx, cy + 82, cx + 36, cy + 72);
      cc.quadraticCurveTo(cx + 58, cy + 40, cx + 42, cy - 18);
      cc.quadraticCurveTo(cx, cy - 34, cx - 42, cy - 18);
    }, { fill: c, stroke: dk, lw: 4, rnd, jitter: 2.5, box: { x: cx - 58, y: cy - 34, w: 116, h: 116 }, hatch, shadeFrom: 'rgba(0,0,0,0.5)' });
    // arms + claws
    Ink.taper(ctx, cx - 34, cy - 6, cx - 58, cy + 50, 14, 10, { fill: c, stroke: dk, lw: 3 });
    Ink.taper(ctx, cx + 34, cy - 6, cx + 58, cy + 50, 14, 10, { fill: c, stroke: dk, lw: 3 });
    for (let s = -1; s <= 1; s++) { Ink.claw(ctx, cx - 58 + s * 8, cy + 58, 12, 0.1, 3, COL.bone); Ink.claw(ctx, cx + 58 + s * 8, cy + 58, 12, -0.1, 3, COL.bone); }
    // head
    Ink.form(ctx, cc => { cc.ellipse(cx, cy - 40, 28, 26, 0, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 3, rnd, box: { x: cx - 28, y: cy - 66, w: 56, h: 52 }, hatch });
    ctx.fillStyle = c; ctx.strokeStyle = dk; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx - 22, cy - 62, 10, 0, 7); ctx.arc(cx + 22, cy - 62, 10, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3a2c1e'; ctx.beginPath(); ctx.ellipse(cx, cy - 30, 14, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(cx, cy - 36, 4, 0, 7); ctx.fill();
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.ellipse(cx, cy - 22, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    Ink.eye(ctx, cx - 11, cy - 46, 2.6, COL.yellow); Ink.eye(ctx, cx + 11, cy - 46, 2.6, COL.yellow);
  }

  function drawWildman(ctx, cx, cy, rnd) {
    const skin = '#6a4a34', dk = COL.black;
    const hatch = { color: HATCH, spacing: 5, angle: 1.2 };
    // spear behind
    ctx.strokeStyle = COL.bark; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 34, cy + 70); ctx.lineTo(cx + 18, cy - 82); ctx.stroke();
    ctx.fillStyle = COL.bone; ctx.beginPath(); ctx.moveTo(cx + 18, cy - 82); ctx.lineTo(cx + 10, cy - 62); ctx.lineTo(cx + 28, cy - 66); ctx.closePath(); ctx.fill();
    // legs
    Ink.taper(ctx, cx - 10, cy + 40, cx - 18, cy + 82, 8, 5, { fill: skin, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 12, cy + 40, cx + 20, cy + 82, 8, 5, { fill: skin, stroke: dk, lw: 2 });
    // lean torso
    Ink.form(ctx, cc => {
      cc.moveTo(cx - 18, cy - 20); cc.quadraticCurveTo(cx - 26, cy + 16, cx - 14, cy + 44);
      cc.quadraticCurveTo(cx, cy + 50, cx + 14, cy + 44); cc.quadraticCurveTo(cx + 26, cy + 16, cx + 18, cy - 20);
      cc.quadraticCurveTo(cx, cy - 28, cx - 18, cy - 20);
    }, { fill: skin, stroke: dk, lw: 3, rnd, box: { x: cx - 26, y: cy - 28, w: 52, h: 78 }, hatch, shadeFrom: 'rgba(0,0,0,0.4)' });
    // arms
    Ink.taper(ctx, cx - 14, cy - 12, cx - 34, cy + 22, 6, 4, { fill: skin, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 14, cy - 12, cx + 30, cy + 40, 6, 4, { fill: skin, stroke: dk, lw: 2 });
    // head + wild hair
    Ink.form(ctx, cc => { cc.ellipse(cx, cy - 38, 16, 18, 0, 0, Math.PI * 2); }, { fill: skin, stroke: dk, lw: 2.5, rnd });
    ctx.strokeStyle = '#1a1008'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.9 + i * 0.45; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 12, cy - 44 + Math.sin(a) * 12); ctx.lineTo(cx + Math.cos(a) * 30 + (rnd() - 0.5) * 8, cy - 44 + Math.sin(a) * 30); ctx.stroke(); }
    ctx.strokeStyle = COL.pink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 40); ctx.lineTo(cx + 12, cy - 40); ctx.stroke();
    ctx.strokeStyle = COL.bone; ctx.beginPath(); ctx.moveTo(cx - 8, cy - 30); ctx.lineTo(cx + 8, cy - 30); ctx.stroke();
    Ink.eye(ctx, cx - 6, cy - 38, 2.4, COL.yellow); Ink.eye(ctx, cx + 6, cy - 38, 2.4, COL.yellow);
  }

  function drawBandit(ctx, cx, cy, rnd) {
    const cloak = '#2c2c34', dk = COL.black;
    Ink.form(ctx, c => {
      c.moveTo(cx, cy - 60);
      c.lineTo(cx + 30, cy - 48);
      c.quadraticCurveTo(cx + 50, cy + 30, cx + 40, cy + 80);
      c.quadraticCurveTo(cx, cy + 70, cx - 40, cy + 80);
      c.quadraticCurveTo(cx - 50, cy + 30, cx - 30, cy - 48);
      c.closePath();
    }, { fill: cloak, stroke: dk, lw: 4, rnd, jitter: 2, box: { x: cx - 50, y: cy - 60, w: 100, h: 140 }, hatch: { color: 'rgba(0,0,0,0.45)', spacing: 7, angle: 1.4 } });
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy - 30); ctx.lineTo(cx + 6, cy + 76); ctx.stroke();
    // hood
    ctx.fillStyle = '#1e1e24'; ctx.beginPath(); ctx.moveTo(cx - 22, cy - 44); ctx.quadraticCurveTo(cx, cy - 78, cx + 22, cy - 44); ctx.quadraticCurveTo(cx, cy - 40, cx - 22, cy - 44); ctx.fill();
    // skull half-mask in the hood shadow
    ctx.fillStyle = '#0c0b08'; ctx.beginPath(); ctx.ellipse(cx, cy - 50, 14, 17, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COL.bone; ctx.beginPath(); ctx.arc(cx, cy - 52, 11, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
    ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(cx - 4, cy - 52, 3, 0, 7); ctx.arc(cx + 5, cy - 52, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 1.4; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 4, cy - 44); ctx.lineTo(cx + i * 4, cy - 40); ctx.stroke(); }
    // sword arm
    Ink.taper(ctx, cx + 18, cy - 8, cx + 40, cy + 8, 6, 4, { fill: cloak, stroke: dk, lw: 2 });
    ctx.save(); ctx.translate(cx + 40, cy + 8); ctx.rotate(-1.05);
    ctx.fillStyle = COL.stone; ctx.strokeStyle = dk; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, 8); ctx.lineTo(-3, -54); ctx.lineTo(0, -62); ctx.lineTo(3, -54); ctx.lineTo(3, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.bone; ctx.fillRect(-9, 8, 18, 4); ctx.restore();
  }

  function drawSpiders(ctx, cx, cy, rnd) {
    const dk = '#100c0a';
    const spider = (x, y, s) => {
      ctx.strokeStyle = dk; ctx.lineWidth = Math.max(1.5, s * 0.18); ctx.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = 0.4 + i * 0.42;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - Math.cos(a) * s * 1.6, y - Math.sin(a) * s * 2.0, x - Math.cos(a) * s * 2.4, y - Math.sin(a) * s * 1.0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * s * 1.6, y - Math.sin(a) * s * 2.0, x + Math.cos(a) * s * 2.4, y - Math.sin(a) * s * 1.0); ctx.stroke();
      }
      Ink.form(ctx, c => { c.ellipse(x, y + s * 0.5, s * 0.8, s, 0, 0, Math.PI * 2); }, { fill: dk, stroke: dk, lw: 1, rnd });
      Ink.form(ctx, c => { c.ellipse(x, y - s * 0.6, s * 0.6, s * 0.55, 0, 0, Math.PI * 2); }, { fill: dk, stroke: dk, lw: 1, rnd });
      ctx.fillStyle = COL.pink; ctx.beginPath(); ctx.arc(x - s * 0.25, y - s * 0.7, Math.max(1, s * 0.12), 0, 7); ctx.arc(x + s * 0.25, y - s * 0.7, Math.max(1, s * 0.12), 0, 7); ctx.fill();
    };
    ctx.strokeStyle = 'rgba(222,216,196,0.22)'; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const x = cx - 90 + i * 30; ctx.beginPath(); ctx.moveTo(x, cy - 90); ctx.lineTo(x + (rnd() - 0.5) * 30, cy + 80); ctx.stroke(); }
    for (let i = 0; i < 6; i++) spider(cx + (rnd() - 0.5) * 170, cy - 40 + rnd() * 120, 7 + rnd() * 6);
    spider(cx, cy + 6, 30);
  }

  function drawGriffon(ctx, cx, cy, rnd) {
    const body = '#7a5e2c', dk = COL.black;
    const wing = (dir) => {
      Ink.form(ctx, c => {
        c.moveTo(cx, cy - 14);
        c.lineTo(cx + dir * 96, cy - 58);
        c.lineTo(cx + dir * 92, cy - 20);
        c.lineTo(cx + dir * 70, cy + 6);
        c.lineTo(cx + dir * 26, cy + 18);
        c.closePath();
      }, { fill: '#5c481f', stroke: dk, lw: 3, rnd, box: { x: cx, y: cy - 58, w: dir * 96, h: 76 }, hatch: { color: 'rgba(0,0,0,0.35)', spacing: 6, angle: dir > 0 ? 0.6 : -0.6 } });
      ctx.strokeStyle = dk; ctx.lineWidth = 1.5;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(cx + dir * (20 + i * 16), cy - 46 + i * 12); ctx.lineTo(cx + dir * (30 + i * 16), cy - 20 + i * 10); ctx.stroke(); }
    };
    wing(-1); wing(1);
    Ink.form(ctx, c => { c.ellipse(cx, cy + 24, 32, 38, 0, 0, Math.PI * 2); }, { fill: body, stroke: dk, lw: 3, rnd, box: { x: cx - 32, y: cy - 14, w: 64, h: 76 }, hatch: { color: HATCH, spacing: 5, angle: 1.3 }, shadeFrom: 'rgba(0,0,0,0.4)' });
    Ink.taper(ctx, cx - 16, cy + 50, cx - 20, cy + 76, 9, 6, { fill: body, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 16, cy + 50, cx + 20, cy + 76, 9, 6, { fill: body, stroke: dk, lw: 2 });
    for (let s = -1; s <= 1; s++) { Ink.claw(ctx, cx - 20 + s * 6, cy + 78, 8, 0, 2.5, COL.bone); Ink.claw(ctx, cx + 20 + s * 6, cy + 78, 8, 0, 2.5, COL.bone); }
    // eagle neck + head
    Ink.taper(ctx, cx, cy + 6, cx - 2, cy - 30, 12, 9, { fill: '#8a6c34', stroke: dk, lw: 2 });
    Ink.form(ctx, c => { c.ellipse(cx - 2, cy - 40, 16, 15, 0, 0, Math.PI * 2); }, { fill: '#a98a44', stroke: dk, lw: 2.5, rnd });
    ctx.fillStyle = COL.yellow; ctx.strokeStyle = dk; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 14, cy - 44); ctx.quadraticCurveTo(cx - 34, cy - 40, cx - 12, cy - 34); ctx.closePath(); ctx.fill(); ctx.stroke();
    Ink.eye(ctx, cx - 2, cy - 44, 3, COL.yellow); ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(cx - 2, cy - 44, 1.6, 0, 7); ctx.fill();
  }

  function drawDruid(ctx, cx, cy, rnd) {
    const robe = '#202c18', dk = COL.black;
    Ink.form(ctx, c => {
      c.moveTo(cx, cy - 58);
      c.lineTo(cx + 22, cy - 48);
      c.quadraticCurveTo(cx + 44, cy + 30, cx + 40, cy + 80);
      c.quadraticCurveTo(cx, cy + 70, cx - 40, cy + 80);
      c.quadraticCurveTo(cx - 44, cy + 30, cx - 22, cy - 48);
      c.closePath();
    }, { fill: robe, stroke: dk, lw: 4, rnd, jitter: 2, box: { x: cx - 44, y: cy - 58, w: 88, h: 138 }, hatch: { color: 'rgba(0,0,0,0.4)', spacing: 7, angle: 1.4 } });
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 12, cy - 30); ctx.lineTo(cx + i * 16, cy + 76); ctx.stroke(); }
    // bone antlers
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const antler = (dir) => {
      ctx.beginPath();
      ctx.moveTo(cx + dir * 8, cy - 58); ctx.quadraticCurveTo(cx + dir * 30, cy - 86, cx + dir * 22, cy - 104);
      ctx.moveTo(cx + dir * 20, cy - 78); ctx.lineTo(cx + dir * 38, cy - 84);
      ctx.moveTo(cx + dir * 24, cy - 92); ctx.lineTo(cx + dir * 40, cy - 100); ctx.stroke();
    };
    antler(-1); antler(1);
    ctx.fillStyle = '#0a0e07'; ctx.beginPath(); ctx.moveTo(cx - 18, cy - 44); ctx.quadraticCurveTo(cx, cy - 72, cx + 18, cy - 44); ctx.quadraticCurveTo(cx, cy - 40, cx - 18, cy - 44); ctx.fill();
    Ink.eye(ctx, cx - 6, cy - 50, 2.6, COL.green); Ink.eye(ctx, cx + 6, cy - 50, 2.6, COL.green);
    ctx.strokeStyle = COL.bark; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 34, cy + 60); ctx.quadraticCurveTo(cx + 42, cy - 10, cx + 50, cy - 78); ctx.stroke();
    Ink.eye(ctx, cx + 50, cy - 80, 7, COL.green);
  }

  function drawZombie(ctx, cx, cy, rnd) {
    const flesh = '#46502f', dk = COL.black;
    const hatch = { color: HATCH, spacing: 5, angle: 1.1 };
    // long spindly splayed legs with knobby knees
    Ink.taper(ctx, cx - 6, cy + 16, cx - 32, cy + 84, 7, 4, { fill: flesh, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 10, cy + 16, cx + 30, cy + 84, 7, 4, { fill: flesh, stroke: dk, lw: 2 });
    Ink.form(ctx, c => { c.ellipse(cx - 22, cy + 52, 6, 7, 0, 0, 7); }, { fill: flesh, stroke: dk, lw: 2, rnd });
    Ink.form(ctx, c => { c.ellipse(cx + 22, cy + 52, 6, 7, 0, 0, 7); }, { fill: flesh, stroke: dk, lw: 2, rnd });
    // hunched, twisted torso leaning forward
    Ink.form(ctx, c => {
      c.moveTo(cx - 28, cy - 18);
      c.quadraticCurveTo(cx - 40, cy + 10, cx - 16, cy + 24);
      c.quadraticCurveTo(cx + 4, cy + 30, cx + 22, cy + 20);
      c.quadraticCurveTo(cx + 34, cy - 6, cx + 18, cy - 34);
      c.quadraticCurveTo(cx - 6, cy - 44, cx - 28, cy - 18);
    }, { fill: flesh, stroke: dk, lw: 3, rnd, jitter: 3, box: { x: cx - 40, y: cy - 44, w: 76, h: 74 }, hatch, shadeFrom: 'rgba(0,0,0,0.5)' });
    // protruding spine knobs
    ctx.fillStyle = flesh; ctx.strokeStyle = dk; ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { const t = i / 3, x = cx - 24 + t * 44, y = cy - 30 + t * 46; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.stroke(); }
    // long dangling arms + claws
    Ink.taper(ctx, cx - 22, cy - 6, cx - 40, cy + 48, 5, 3, { fill: flesh, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 18, cy - 4, cx + 44, cy + 44, 5, 3, { fill: flesh, stroke: dk, lw: 2 });
    Ink.claw(ctx, cx - 40, cy + 48, 11, -0.2, 2.5, '#2a301c');
    Ink.claw(ctx, cx + 44, cy + 44, 11, 0.2, 2.5, '#2a301c');
    // sunken lolling head
    Ink.form(ctx, c => { c.ellipse(cx - 6, cy - 30, 12, 13, -0.3, 0, Math.PI * 2); }, { fill: flesh, stroke: dk, lw: 2.5, rnd });
    Ink.eye(ctx, cx - 10, cy - 30, 2.4, COL.yellow);
    ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(cx - 1, cy - 29, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = dk; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 22); ctx.lineTo(cx - 2, cy - 21); ctx.stroke();
    // bulbous fungal caps erupting from back and skull
    const caps = [[cx + 6, cy - 40, 9], [cx + 16, cy - 28, 7], [cx - 14, cy - 40, 6], [cx + 24, cy - 12, 8], [cx - 2, cy - 46, 7]];
    caps.forEach((p, i) => {
      const capCol = i % 2 ? '#7a2f3e' : '#b9a98c';
      Ink.form(ctx, c => { c.ellipse(p[0], p[1], p[2], p[2] * 0.72, 0, Math.PI, 0); }, { fill: capCol, stroke: dk, lw: 1.5, rnd });
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p[0], p[1], p[2] * 0.5, p[2] * 0.3, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#3a2018'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0], p[1] + p[2]); ctx.stroke();
    });
    ctx.fillStyle = 'rgba(108,255,74,0.10)'; ctx.beginPath(); ctx.arc(cx, cy - 12, 72, 0, 7); ctx.fill();
  }

  function drawPlant(ctx, cx, cy, rnd) {
    const stalk = '#2e4420', dk = COL.black;
    Ink.taper(ctx, cx, cy + 82, cx, cy - 12, 16, 12, { fill: stalk, stroke: dk, lw: 3 });
    ctx.strokeStyle = stalk; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 10, cy + 30); ctx.quadraticCurveTo(cx - 64, cy + 10, cx - 76, cy + 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 10, cy + 30); ctx.quadraticCurveTo(cx + 64, cy + 6, cx + 78, cy + 54); ctx.stroke();
    // bulbous maw
    Ink.form(ctx, c => {
      c.moveTo(cx - 32, cy - 16);
      c.quadraticCurveTo(cx - 46, cy - 58, cx - 10, cy - 66);
      c.quadraticCurveTo(cx, cy - 68, cx + 10, cy - 66);
      c.quadraticCurveTo(cx + 46, cy - 58, cx + 32, cy - 16);
      c.quadraticCurveTo(cx, cy - 6, cx - 32, cy - 16);
    }, { fill: '#5a2030', stroke: dk, lw: 3, rnd, box: { x: cx - 46, y: cy - 68, w: 92, h: 62 }, hatch: { color: 'rgba(0,0,0,0.3)', spacing: 5, angle: 1.2 } });
    ctx.fillStyle = '#15080c'; ctx.beginPath(); ctx.ellipse(cx, cy - 34, 18, 24, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, tx = cx + Math.cos(a) * 20, ty = cy - 34 + Math.sin(a) * 26;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(a - Math.PI / 2); Ink.fang(ctx, 0, 0, 8, 2.4, COL.bone); ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,230,0,0.18)';
    for (let i = 0; i < 26; i++) ctx.fillRect(cx - 70 + rnd() * 140, cy - 80 + rnd() * 90, 2, 2);
  }

  function drawWyvern(ctx, cx, cy, rnd) {
    const c = '#2e3a42', mem = '#1f2a32', dk = COL.black;
    const wing = (dir) => {
      Ink.form(ctx, cc => {
        cc.moveTo(cx + dir * 6, cy - 12);
        cc.lineTo(cx + dir * 108, cy - 46);
        cc.lineTo(cx + dir * 86, cy - 8);
        cc.lineTo(cx + dir * 104, cy + 18);
        cc.lineTo(cx + dir * 70, cy + 10);
        cc.lineTo(cx + dir * 22, cy + 18);
        cc.closePath();
      }, { fill: mem, stroke: dk, lw: 3, rnd, box: { x: cx, y: cy - 46, w: dir * 108, h: 64 }, hatch: { color: 'rgba(0,0,0,0.3)', spacing: 7, angle: dir > 0 ? 0.5 : -0.5 } });
      ctx.strokeStyle = dk; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + dir * 6, cy - 12); ctx.lineTo(cx + dir * 108, cy - 46);
      ctx.moveTo(cx + dir * 40, cy - 2); ctx.lineTo(cx + dir * 86, cy - 8);
      ctx.moveTo(cx + dir * 50, cy + 6); ctx.lineTo(cx + dir * 104, cy + 18); ctx.stroke();
    };
    wing(-1); wing(1);
    Ink.form(ctx, cc => { cc.ellipse(cx, cy + 24, 22, 32, 0, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 3, rnd, box: { x: cx - 22, y: cy - 8, w: 44, h: 64 }, hatch: { color: HATCH, spacing: 5, angle: 1.2 }, shadeFrom: 'rgba(0,0,0,0.4)' });
    Ink.taper(ctx, cx - 12, cy + 48, cx - 18, cy + 72, 7, 4, { fill: c, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 12, cy + 48, cx + 18, cy + 72, 7, 4, { fill: c, stroke: dk, lw: 2 });
    // S-neck + head
    Ink.serpent(ctx, [[cx, cy + 6], [cx + 18, cy - 22], [cx + 8, cy - 48], [cx + 14, cy - 64]], 11, 7, { fill: c, stroke: dk, lw: 2.5, rnd });
    Ink.form(ctx, cc => { cc.ellipse(cx + 16, cy - 66, 16, 11, -0.3, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 2.5, rnd });
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.moveTo(cx + 26, cy - 70); ctx.lineTo(cx + 50, cy - 74); ctx.lineTo(cx + 30, cy - 58); ctx.closePath(); ctx.fill();
    Ink.fang(ctx, cx + 34, cy - 70, 5, 1.6, COL.bone); Ink.fang(ctx, cx + 42, cy - 70, 5, 1.6, COL.bone);
    Ink.eye(ctx, cx + 12, cy - 68, 2.6, COL.yellow);
    // tail + stinger
    Ink.serpent(ctx, [[cx, cy + 44], [cx - 30, cy + 62], [cx - 58, cy + 44], [cx - 72, cy + 24]], 9, 3, { fill: c, stroke: dk, lw: 2.5, rnd });
    Ink.spike(ctx, cx - 72, cy + 24, 14, 5, -2.2, COL.bone);
  }

  function drawGiant(ctx, cx, cy, rnd) {
    const c = '#6a201e', dk = COL.black;
    const hatch = { color: 'rgba(0,0,0,0.32)', spacing: 6, angle: 1.3 };
    Ink.taper(ctx, cx - 22, cy + 40, cx - 30, cy + 84, 16, 11, { fill: c, stroke: dk, lw: 3 });
    Ink.taper(ctx, cx + 22, cy + 40, cx + 30, cy + 84, 16, 11, { fill: c, stroke: dk, lw: 3 });
    Ink.form(ctx, cc => {
      cc.moveTo(cx - 48, cy - 34);
      cc.quadraticCurveTo(cx - 60, cy + 0, cx - 44, cy + 44);
      cc.quadraticCurveTo(cx, cy + 54, cx + 44, cy + 44);
      cc.quadraticCurveTo(cx + 60, cy + 0, cx + 48, cy - 34);
      cc.quadraticCurveTo(cx, cy - 46, cx - 48, cy - 34);
    }, { fill: c, stroke: dk, lw: 5, rnd, jitter: 2.5, box: { x: cx - 60, y: cy - 46, w: 120, h: 100 }, hatch, shadeFrom: 'rgba(0,0,0,0.5)' });
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy - 40); ctx.lineTo(cx, cy + 40); ctx.moveTo(cx - 24, cy - 20); ctx.quadraticCurveTo(cx, cy - 10, cx + 24, cy - 20); ctx.stroke();
    Ink.taper(ctx, cx - 44, cy - 22, cx - 84, cy + 44, 18, 14, { fill: c, stroke: dk, lw: 4 });
    Ink.form(ctx, cc => { cc.ellipse(cx - 86, cy + 50, 18, 16, 0, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 3, rnd });
    Ink.taper(ctx, cx + 44, cy - 22, cx + 86, cy + 38, 18, 14, { fill: c, stroke: dk, lw: 4 });
    Ink.form(ctx, cc => { cc.ellipse(cx + 88, cy + 44, 18, 16, 0, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 3, rnd });
    Ink.form(ctx, cc => { cc.ellipse(cx, cy - 50, 18, 16, 0, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 3, rnd });
    ctx.fillStyle = dk; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 42); ctx.lineTo(cx + 12, cy - 42); ctx.lineTo(cx, cy - 34); ctx.closePath(); ctx.fill();
    Ink.eye(ctx, cx - 8, cy - 54, 2.8, COL.yellow); Ink.eye(ctx, cx + 8, cy - 54, 2.8, COL.yellow);
    splatter(ctx, cx, cy + 70, rnd, COL.blood, 36);
    splatter(ctx, cx + 30, cy + 30, rnd, COL.blood, 18);
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
