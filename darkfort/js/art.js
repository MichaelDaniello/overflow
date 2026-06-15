/* ============================================================
   DARK FORT — ART ENGINE
   Procedurally draws each room (shape + doors) and the
   encounter inside it, in a filthy Mörk Borg style, onto a
   <canvas>. Everything is generated from the dice, so the
   2d6 room-shape roll and the encounter roll literally build
   the picture you see.
   ============================================================ */

(function () {
  'use strict';

  const COL = {
    black:  '#0a0a08',
    ink:    '#1c1c16',
    paper:  '#e9e4d4',
    paperD: '#c9c3b0',
    stone:  '#b8b2a0',
    stoneD: '#9a937f',
    yellow: '#ffe600',
    pink:   '#ff2079',
    pinkD:  '#c2105a',
    blood:  '#a01818',
    bone:   '#ded8c4',
    green:  '#6cff4a',
  };

  /* ── seeded PRNG so a given room always redraws the same ── */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── geometry helpers ─────────────────────────────────── */

  // build the list of perimeter points for each room shape,
  // normalised to a [-1,1] box then scaled to the canvas.
  function shapePoints(shape, rnd) {
    let pts;
    switch (shape) {
      case 'Square':
        pts = [[-1,-1],[1,-1],[1,1],[-1,1]]; break;
      case 'Rectangular':
        pts = [[-1.15,-0.7],[1.15,-0.7],[1.15,0.7],[-1.15,0.7]]; break;
      case 'Corridor': {
        const horiz = rnd() < 0.5;
        pts = horiz
          ? [[-1.25,-0.34],[1.25,-0.34],[1.25,0.34],[-1.25,0.34]]
          : [[-0.34,-1.2],[0.34,-1.2],[0.34,1.2],[-0.34,1.2]];
        break;
      }
      case 'Oval':
        pts = ellipsePts(1.12, 0.82, 34); break;
      case 'Round':
        pts = ellipsePts(1.02, 1.02, 40); break;
      case 'Triangular':
        pts = [[0,-1.15],[1.15,1.0],[-1.15,1.0]]; break;
      case 'Cross-shaped': {
        const a = 0.4;
        pts = [
          [-a,-1],[a,-1],[a,-a],[1,-a],[1,a],[a,a],
          [a,1],[-a,1],[-a,a],[-1,a],[-1,-a],[-a,-a],
        ];
        break;
      }
      case 'Irregular cave':
        pts = cavePts(rnd); break;
      case 'Skull-shaped':
        pts = skullPts(); break;
      default:
        pts = [[-1,-1],[1,-1],[1,1],[-1,1]];
    }
    return pts;
  }

  function ellipsePts(rx, ry, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      out.push([Math.cos(t) * rx, Math.sin(t) * ry]);
    }
    return out;
  }

  function cavePts(rnd) {
    const n = 22, out = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const r = 0.72 + rnd() * 0.5 + 0.15 * Math.sin(t * 3 + rnd());
      out.push([Math.cos(t) * r * 1.12, Math.sin(t) * r]);
    }
    return out;
  }

  // a crude top-down skull outline
  function skullPts() {
    return [
      [-0.55,-1.0],[0.55,-1.0],[0.95,-0.55],[1.0,-0.05],
      [0.7,0.25],[0.78,0.55],[0.5,0.62],[0.45,1.0],
      [0.18,0.7],[0,1.05],[-0.18,0.7],[-0.45,1.0],
      [-0.5,0.62],[-0.78,0.55],[-0.7,0.25],[-1.0,-0.05],
      [-0.95,-0.55],
    ];
  }

  // draw a path through points with a hand-drawn wobble
  function inkPath(ctx, pts, cx, cy, scale, jitter, rnd, close = true) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const jx = (rnd() - 0.5) * jitter;
      const jy = (rnd() - 0.5) * jitter;
      const x = cx + pts[i][0] * scale + jx;
      const y = cy + pts[i][1] * scale + jy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (close) ctx.closePath();
  }

  /* ── texture: ink splatter & speckle ──────────────────── */
  function splatter(ctx, x, y, rnd, color, max) {
    ctx.fillStyle = color;
    const blobs = 6 + Math.floor(rnd() * 10);
    for (let i = 0; i < blobs; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * max;
      const r = 1 + rnd() * (max * 0.18);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function speckle(ctx, region, rnd, n, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = region.x + rnd() * region.w;
      const y = region.y + rnd() * region.h;
      const r = rnd() * 1.6;
      ctx.fillRect(x, y, r, r);
    }
  }

  /* ── main render ──────────────────────────────────────── */
  function render(canvas, spec) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const rnd = mulberry32(spec.seed || 1);

    // 1. rocky surround (the living rock of the catacomb)
    ctx.fillStyle = COL.ink;
    ctx.fillRect(0, 0, W, H);
    drawRockHatch(ctx, W, H, rnd);

    // 2. the room floor
    const cx = W / 2, cy = H / 2;
    const scale = Math.min(W, H) * 0.40;
    const pts = shapePoints(spec.shape, mulberry32((spec.seed || 1) ^ 0x9e3779b1));

    // floor fill
    ctx.save();
    inkPath(ctx, pts, cx, cy, scale, 6, mulberry32((spec.seed || 1) + 7));
    ctx.fillStyle = COL.stone;
    ctx.fill();
    // floor inner shading + cracks
    ctx.clip();
    floorTexture(ctx, cx, cy, scale, rnd);
    ctx.restore();

    // heavy ragged outline (drawn twice for a rough double line)
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.black;
    ctx.lineWidth = 10;
    inkPath(ctx, pts, cx, cy, scale, 5, mulberry32((spec.seed || 1) + 11));
    ctx.stroke();
    ctx.lineWidth = 3;
    inkPath(ctx, pts, cx, cy, scale, 9, mulberry32((spec.seed || 1) + 23));
    ctx.stroke();

    // 3. doors
    drawDoors(ctx, cx, cy, scale, spec, rnd);

    // 4. encounter in the middle of the room
    drawEncounter(ctx, cx, cy, scale, spec, mulberry32((spec.seed || 1) * 3 + 1));

    // 5. grime pass over the whole frame
    splatter(ctx, rnd() * W, rnd() * H * 0.3, rnd, COL.black, 60);
    splatter(ctx, W * 0.8, H * 0.85, rnd, COL.black, 50);
    if (rnd() < 0.5) splatter(ctx, rnd() * W, rnd() * H, rnd, COL.pinkD, 36);
  }

  function drawRockHatch(ctx, W, H, rnd) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W, y = rnd() * H, len = 6 + rnd() * 22, a = rnd() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    // a few yellow flecks of torchlight
    ctx.fillStyle = 'rgba(255,230,0,0.07)';
    for (let i = 0; i < 30; i++) ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
  }

  function floorTexture(ctx, cx, cy, scale, rnd) {
    // subtle darker stones / flagstones
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 16; i++) {
      const x = cx + (rnd() - 0.5) * scale * 2.4;
      const y = cy + (rnd() - 0.5) * scale * 2.4;
      const len = 12 + rnd() * 40, a = rnd() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      ctx.stroke();
    }
    speckle(ctx, { x: cx - scale * 1.3, y: cy - scale * 1.3, w: scale * 2.6, h: scale * 2.6 },
            rnd, 120, 'rgba(0,0,0,0.13)');
  }

  /* ── doors ────────────────────────────────────────────── */
  function drawDoors(ctx, cx, cy, scale, spec, rnd) {
    const n = spec.doors || 0;
    if (n <= 0) return;
    // candidate edges: top, right, bottom, left
    const edges = [
      { x: cx,             y: cy - scale * 1.02, dir: 'v' },
      { x: cx + scale*1.18, y: cy,               dir: 'h' },
      { x: cx,             y: cy + scale * 1.05, dir: 'v' },
      { x: cx - scale*1.18, y: cy,               dir: 'h' },
    ];
    // deterministic-ish selection
    const order = [0, 1, 2, 3].sort(() => rnd() - 0.5);
    for (let i = 0; i < Math.min(n, 4); i++) {
      const e = edges[order[i]];
      drawDoor(ctx, e.x, e.y, e.dir, rnd);
    }
  }

  function drawDoor(ctx, x, y, dir, rnd) {
    const w = 30, h = 46;
    ctx.save();
    ctx.translate(x, y);
    if (dir === 'h') ctx.rotate(Math.PI / 2);
    // dark opening
    ctx.fillStyle = COL.black;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    // arched top
    ctx.beginPath();
    ctx.arc(0, -h / 2, w / 2, Math.PI, 0);
    ctx.fill();
    // frame
    ctx.strokeStyle = COL.yellow;
    ctx.lineWidth = 4;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // a couple of plank lines
    ctx.strokeStyle = 'rgba(255,230,0,0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + (w / 3) * i, -h / 2);
      ctx.lineTo(-w / 2 + (w / 3) * i, h / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ── encounters ───────────────────────────────────────── */
  function drawEncounter(ctx, cx, cy, scale, spec, rnd) {
    const enc = spec.encounter;
    if (!enc || enc.kind === 'nothing') {
      bonesOnFloor(ctx, cx, cy, scale, rnd);
      return;
    }
    switch (enc.kind) {
      case 'item':       drawItem(ctx, cx, cy, enc.item, rnd); break;
      case 'scroll':     drawItem(ctx, cx, cy, 'Scroll', rnd); break;
      case 'trap':       drawTrap(ctx, cx, cy, scale, rnd); break;
      case 'soothsayer': drawSeer(ctx, cx, cy, rnd); break;
      case 'peddler':    drawPeddler(ctx, cx, cy, rnd); break;
      case 'monster':    drawMonster(ctx, cx, cy, enc.monster, rnd); break;
      default:           bonesOnFloor(ctx, cx, cy, scale, rnd);
    }
  }

  function bonesOnFloor(ctx, cx, cy, scale, rnd) {
    // scattered bones / a lonely skull
    ctx.strokeStyle = COL.bone;
    ctx.fillStyle = COL.bone;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const x = cx + (rnd() - 0.5) * scale * 0.9;
      const y = cy + (rnd() - 0.5) * scale * 0.9 + scale * 0.3;
      const a = rnd() * Math.PI;
      const l = 16 + rnd() * 18;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    // small skull
    const sx = cx + scale * 0.1, sy = cy;
    skullGlyph(ctx, sx, sy, 16, COL.bone, COL.black);
  }

  function skullGlyph(ctx, x, y, r, fill, eye) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0);
    ctx.arc(x, y + r * 0.2, r * 0.9, 0, Math.PI);
    ctx.fill();
    ctx.fillRect(x - r * 0.8, y, r * 1.6, r * 0.7);
    // jaw
    ctx.fillRect(x - r * 0.5, y + r * 0.7, r, r * 0.5);
    // eyes
    ctx.fillStyle = eye;
    ctx.beginPath();
    ctx.arc(x - r * 0.42, y, r * 0.32, 0, Math.PI * 2);
    ctx.arc(x + r * 0.42, y, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    // nose
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.15);
    ctx.lineTo(x - r * 0.18, y + r * 0.6);
    ctx.lineTo(x + r * 0.18, y + r * 0.6);
    ctx.fill();
  }

  // halo behind a central figure for drama
  function halo(ctx, cx, cy, r, color) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── items ────────────────────────────────────────────── */
  function drawItem(ctx, cx, cy, item, rnd) {
    halo(ctx, cx, cy, 120, 'rgba(255,230,0,0.22)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = COL.black;

    const it = (item || '').toLowerCase();
    if (it.includes('potion')) {
      ctx.fillStyle = COL.pink;
      ctx.beginPath();
      ctx.moveTo(-8, -34); ctx.lineTo(8, -34); ctx.lineTo(8, -18);
      ctx.bezierCurveTo(26, -6, 26, 30, 0, 36);
      ctx.bezierCurveTo(-26, 30, -26, -6, -8, -18);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = COL.black; ctx.fillRect(-9, -42, 18, 10);
      ctx.fillStyle = COL.yellow; ctx.beginPath(); ctx.arc(-4, 10, 6, 0, 7); ctx.fill();
    } else if (it.includes('rope')) {
      ctx.strokeStyle = COL.bone; ctx.lineWidth = 9;
      ctx.beginPath();
      for (let a = 0; a < 4; a++) ctx.arc(0, -30 + a * 18, 24 - a * 3, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else if (it.includes('armor')) {
      ctx.fillStyle = COL.stone;
      ctx.beginPath();
      ctx.moveTo(0, -36); ctx.lineTo(34, -22); ctx.lineTo(28, 18);
      ctx.lineTo(0, 40); ctx.lineTo(-28, 18); ctx.lineTo(-34, -22);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = COL.black; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0,-36); ctx.lineTo(0,40); ctx.stroke();
    } else if (it.includes('cloak')) {
      ctx.fillStyle = 'rgba(40,40,55,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.bezierCurveTo(40, -20, 34, 38, 0, 40);
      ctx.bezierCurveTo(-34, 38, -40, -20, 0, -40);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = COL.pink; ctx.setLineDash([6, 5]); ctx.lineWidth = 3; ctx.stroke();
      ctx.setLineDash([]);
    } else if (it.includes('scroll')) {
      ctx.fillStyle = COL.paper;
      ctx.fillRect(-30, -36, 60, 72); ctx.strokeRect(-30, -36, 60, 72);
      ctx.fillStyle = COL.black;
      for (let i = 0; i < 5; i++) ctx.fillRect(-22, -26 + i * 13, 44, 4);
      ctx.fillStyle = COL.pink; ctx.beginPath();
      ctx.arc(0, 14, 9, 0, 7); ctx.fill();
      ctx.strokeStyle = COL.pinkD; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(-34, -36); ctx.lineTo(-34, 36); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(34, -36); ctx.lineTo(34, 36); ctx.stroke();
    } else { // weapon
      ctx.fillStyle = COL.stone;
      ctx.fillRect(-5, -40, 10, 56); ctx.strokeRect(-5, -40, 10, 56);
      ctx.fillStyle = COL.bone;
      ctx.fillRect(-22, 14, 44, 10); ctx.strokeRect(-22, 14, 44, 10);
      ctx.fillStyle = COL.stone;
      ctx.fillRect(-7, 22, 14, 22); ctx.strokeRect(-7, 22, 14, 22);
    }
    ctx.restore();
    sparkle(ctx, cx, cy, rnd);
  }

  function sparkle(ctx, cx, cy, rnd) {
    ctx.strokeStyle = COL.yellow;
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI * 2, d = 60 + rnd() * 40;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      ctx.beginPath();
      ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
      ctx.stroke();
    }
  }

  /* ── trap ─────────────────────────────────────────────── */
  function drawTrap(ctx, cx, cy, scale, rnd) {
    // a black pit with spikes
    ctx.fillStyle = COL.black;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 20, scale * 0.55, scale * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COL.bone;
    for (let i = -3; i <= 3; i++) {
      const x = cx + i * 22 + (rnd() - 0.5) * 8;
      const baseY = cy + 20 + Math.sqrt(Math.max(0, scale*scale*0.11 - (i*22)*(i*22)*0.4)) * 0.6;
      ctx.beginPath();
      ctx.moveTo(x - 8, baseY);
      ctx.lineTo(x, baseY - 40 - rnd() * 16);
      ctx.lineTo(x + 8, baseY);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = COL.pink;
    ctx.font = "bold 26px Anton, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('!', cx, cy - scale * 0.45);
  }

  /* ── soothsayer ───────────────────────────────────────── */
  function drawSeer(ctx, cx, cy, rnd) {
    halo(ctx, cx, cy, 150, 'rgba(255,32,121,0.22)');
    ctx.save();
    ctx.translate(cx, cy + 20);
    // robe
    ctx.fillStyle = COL.ink;
    ctx.strokeStyle = COL.black; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(46, 70); ctx.lineTo(-46, 70);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // hood opening
    ctx.fillStyle = COL.black;
    ctx.beginPath(); ctx.arc(0, -54, 22, 0, Math.PI * 2); ctx.fill();
    // glowing eyes
    ctx.fillStyle = COL.pink;
    ctx.beginPath();
    ctx.arc(-7, -56, 3.5, 0, 7); ctx.arc(7, -56, 3.5, 0, 7); ctx.fill();
    ctx.restore();
    // floating question marks
    ctx.fillStyle = COL.yellow;
    ctx.font = "bold 30px Anton, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('?', cx - 70, cy - 40);
    ctx.font = "bold 46px Anton, sans-serif";
    ctx.fillText('?', cx + 74, cy - 70);
    ctx.font = "bold 22px Anton, sans-serif";
    ctx.fillText('?', cx + 40, cy - 110);
  }

  /* ── peddler ──────────────────────────────────────────── */
  function drawPeddler(ctx, cx, cy, rnd) {
    halo(ctx, cx, cy, 150, 'rgba(255,230,0,0.18)');
    // stall
    ctx.fillStyle = COL.ink;
    ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.fillRect(cx - 90, cy + 30, 180, 56);
    ctx.strokeRect(cx - 90, cy + 30, 180, 56);
    // striped awning
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? COL.pink : COL.yellow;
      ctx.beginPath();
      ctx.moveTo(cx - 96 + i * 32, cy + 30);
      ctx.lineTo(cx - 96 + i * 32 + 16, cy + 14);
      ctx.lineTo(cx - 96 + i * 32 + 32, cy + 30);
      ctx.closePath(); ctx.fill();
    }
    // hooded merchant behind
    ctx.fillStyle = COL.black;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 60);
    ctx.lineTo(cx + 36, cy + 30); ctx.lineTo(cx - 36, cy + 30);
    ctx.closePath(); ctx.fill();
    // void where a face should be
    ctx.fillStyle = COL.green;
    ctx.beginPath(); ctx.arc(cx - 6, cy - 40, 3, 0, 7); ctx.arc(cx + 6, cy - 40, 3, 0, 7); ctx.fill();
    // coins
    ctx.fillStyle = COL.yellow; ctx.strokeStyle = COL.black; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx - 70 + i * 12, cy + 60, 7, 0, 7); ctx.fill(); ctx.stroke();
    }
  }

  /* ── monsters ─────────────────────────────────────────── */
  function drawMonster(ctx, cx, cy, monster, rnd) {
    const key = (monster && monster.art) || 'skeleton';
    halo(ctx, cx, cy, 190, monster && monster.tough
        ? 'rgba(160,24,24,0.30)' : 'rgba(255,32,121,0.16)');
    // ground shadow (drawn under the figure)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 110, 86, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    const fns = {
      skeleton: drawSkeleton,
      cultist:  drawCultist,
      goblin:   drawGoblin,
      hound:    drawHound,
      sorcerer: drawSorcerer,
      troll:    drawTroll,
      medusa:   drawMedusa,
      basilisk: drawBasilisk,
    };
    // scale the figure up so it dominates the room
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1.35, 1.35);
    ctx.translate(-cx, -cy);
    (fns[key] || drawSkeleton)(ctx, cx, cy, rnd);
    ctx.restore();
  }

  function limb(ctx, x1, y1, x2, y2, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function drawSkeleton(ctx, cx, cy, rnd) {
    const c = COL.bone;
    // ribs
    limb(ctx, cx, cy - 50, cx, cy + 30, 8, c);
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = c; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy - 30 + i * 14, 18, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    // arms with a dagger
    limb(ctx, cx, cy - 38, cx - 34, cy + 4, 6, c);
    limb(ctx, cx, cy - 38, cx + 32, cy - 8, 6, c);
    ctx.strokeStyle = COL.stone; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx + 32, cy - 8); ctx.lineTo(cx + 44, cy - 30); ctx.stroke();
    // legs
    limb(ctx, cx - 4, cy + 30, cx - 22, cy + 78, 6, c);
    limb(ctx, cx + 4, cy + 30, cx + 22, cy + 78, 6, c);
    // skull
    skullGlyph(ctx, cx, cy - 66, 20, c, COL.black);
    // blood drench — kept low and dark so the bones stay readable
    ctx.fillStyle = COL.blood;
    splatter(ctx, cx - 4, cy + 60, rnd, COL.blood, 22);
    splatter(ctx, cx + 18, cy + 30, rnd, COL.blood, 14);
  }

  function drawCultist(ctx, cx, cy, rnd) {
    // robe
    ctx.fillStyle = COL.ink; ctx.strokeStyle = COL.black; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 70);
    ctx.lineTo(cx + 50, cy + 80); ctx.lineTo(cx - 50, cy + 80);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // hood
    ctx.fillStyle = COL.black;
    ctx.beginPath(); ctx.arc(cx, cy - 58, 26, 0, Math.PI * 2); ctx.fill();
    // pink sigil
    ctx.strokeStyle = COL.pink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy + 10, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx + 19, cy + 21);
    ctx.lineTo(cx - 19, cy + 21); ctx.closePath(); ctx.stroke();
    // glowing eyes
    ctx.fillStyle = COL.yellow;
    ctx.beginPath(); ctx.arc(cx - 8, cy - 58, 4, 0, 7); ctx.arc(cx + 8, cy - 58, 4, 0, 7); ctx.fill();
    // raised dagger arm
    limb(ctx, cx + 30, cy + 0, cx + 60, cy - 50, 7, COL.ink);
    ctx.strokeStyle = COL.stone; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx + 60, cy - 50); ctx.lineTo(cx + 70, cy - 76); ctx.stroke();
  }

  function drawGoblin(ctx, cx, cy, rnd) {
    // squat body
    ctx.fillStyle = COL.green; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, cy + 20, 38, 44, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // head
    ctx.beginPath(); ctx.arc(cx, cy - 36, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // ears
    ctx.beginPath();
    ctx.moveTo(cx - 24, cy - 40); ctx.lineTo(cx - 56, cy - 54); ctx.lineTo(cx - 22, cy - 24); ctx.closePath();
    ctx.moveTo(cx + 24, cy - 40); ctx.lineTo(cx + 56, cy - 54); ctx.lineTo(cx + 22, cy - 24); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // eyes + grin
    ctx.fillStyle = COL.yellow;
    ctx.beginPath(); ctx.arc(cx - 9, cy - 38, 6, 0, 7); ctx.arc(cx + 9, cy - 38, 6, 0, 7); ctx.fill();
    ctx.fillStyle = COL.black;
    ctx.beginPath(); ctx.arc(cx - 9, cy - 37, 2.5, 0, 7); ctx.arc(cx + 9, cy - 37, 2.5, 0, 7); ctx.fill();
    ctx.strokeStyle = COL.black; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 12, cy - 22); ctx.lineTo(cx + 12, cy - 22); ctx.stroke();
    ctx.fillStyle = COL.bone;
    for (let i = -1; i <= 1; i++) { ctx.beginPath();
      ctx.moveTo(cx + i*8 - 3, cy - 22); ctx.lineTo(cx + i*8, cy - 14); ctx.lineTo(cx + i*8 + 3, cy - 22);
      ctx.closePath(); ctx.fill(); }
    // little legs
    limb(ctx, cx - 16, cy + 58, cx - 22, cy + 80, 8, COL.green);
    limb(ctx, cx + 16, cy + 58, cx + 22, cy + 80, 8, COL.green);
  }

  function drawHound(ctx, cx, cy, rnd) {
    const c = COL.stone;
    // body
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx, cy + 14, 56, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // head low and forward
    ctx.beginPath(); ctx.ellipse(cx - 52, cy + 4, 26, 20, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // snout
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy - 2); ctx.lineTo(cx - 96, cy + 6); ctx.lineTo(cx - 70, cy + 16); ctx.closePath();
    ctx.fill(); ctx.stroke();
    // exposed ribs (undead)
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { ctx.beginPath();
      ctx.moveTo(cx - 14 + i*16, cy - 2); ctx.lineTo(cx - 14 + i*16, cy + 30); ctx.stroke(); }
    // legs
    limb(ctx, cx - 30, cy + 36, cx - 34, cy + 78, 8, c);
    limb(ctx, cx + 30, cy + 36, cx + 34, cy + 78, 8, c);
    limb(ctx, cx - 10, cy + 38, cx - 8, cy + 78, 8, c);
    limb(ctx, cx + 10, cy + 38, cx + 8, cy + 78, 8, c);
    // eye + teeth
    ctx.fillStyle = COL.pink;
    ctx.beginPath(); ctx.arc(cx - 56, cy - 2, 4, 0, 7); ctx.fill();
    ctx.fillStyle = COL.bone;
    ctx.beginPath(); ctx.moveTo(cx - 84, cy + 8); ctx.lineTo(cx - 80, cy + 18); ctx.lineTo(cx - 76, cy + 8); ctx.fill();
  }

  function drawSorcerer(ctx, cx, cy, rnd) {
    // tall robe
    ctx.fillStyle = '#241a30'; ctx.strokeStyle = COL.black; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 86);
    ctx.lineTo(cx + 52, cy + 86); ctx.lineTo(cx - 52, cy + 86);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // skull face hood
    ctx.fillStyle = COL.black;
    ctx.beginPath(); ctx.arc(cx, cy - 70, 28, 0, Math.PI*2); ctx.fill();
    skullGlyph(ctx, cx, cy - 66, 16, COL.bone, COL.blood);
    // death-ray staff
    limb(ctx, cx + 36, cy + 20, cx + 70, cy - 96, 7, '#3a2b4a');
    ctx.fillStyle = COL.green;
    halo(ctx, cx + 70, cy - 96, 36, 'rgba(108,255,74,0.6)');
    ctx.beginPath(); ctx.arc(cx + 70, cy - 96, 11, 0, 7); ctx.fill();
    // crackling magic
    ctx.strokeStyle = COL.green; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = rnd() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + 70, cy - 96);
      ctx.lineTo(cx + 70 + Math.cos(a) * 34, cy - 96 + Math.sin(a) * 34);
      ctx.stroke();
    }
  }

  function drawTroll(ctx, cx, cy, rnd) {
    const c = COL.stoneD;
    // bulky body
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 7; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 50, cy - 30);
    ctx.lineTo(cx + 50, cy - 30);
    ctx.lineTo(cx + 60, cy + 70);
    ctx.lineTo(cx - 60, cy + 70);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // head sunk into shoulders
    ctx.beginPath(); ctx.arc(cx, cy - 50, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // cracks (stone)
    ctx.strokeStyle = COL.black; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 20, cy - 60); ctx.lineTo(cx - 6, cy - 40); ctx.lineTo(cx - 16, cy - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 24, cy - 10); ctx.lineTo(cx + 10, cy + 30); ctx.stroke();
    // glowing eyes
    ctx.fillStyle = COL.yellow;
    ctx.beginPath(); ctx.arc(cx - 11, cy - 52, 5, 0, 7); ctx.arc(cx + 11, cy - 52, 5, 0, 7); ctx.fill();
    // huge arms
    limb(ctx, cx - 46, cy - 18, cx - 78, cy + 50, 16, c);
    limb(ctx, cx + 46, cy - 18, cx + 80, cy + 40, 16, c);
    // club
    ctx.strokeStyle = '#6b5a3a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 80, cy + 40); ctx.lineTo(cx + 104, cy - 30); ctx.stroke();
  }

  function drawMedusa(ctx, cx, cy, rnd) {
    // torso
    ctx.fillStyle = '#4c6b3a'; ctx.strokeStyle = COL.black; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy - 30);
    ctx.lineTo(cx + 26, cy - 30);
    ctx.bezierCurveTo(cx + 50, cy + 60, cx - 50, cy + 60, cx - 26, cy - 30);
    // serpent lower body
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy + 40);
    ctx.bezierCurveTo(cx - 60, cy + 80, cx + 50, cy + 70, cx + 30, cy + 92);
    ctx.lineWidth = 22; ctx.strokeStyle = '#4c6b3a'; ctx.lineCap = 'round'; ctx.stroke();
    // head
    ctx.fillStyle = '#5c7a48';
    ctx.beginPath(); ctx.arc(cx, cy - 48, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.black; ctx.lineWidth = 4; ctx.stroke();
    // snake hair
    ctx.strokeStyle = COL.green; ctx.lineWidth = 5; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * Math.PI - Math.PI;
      const sx = cx + Math.cos(a) * 20, sy = cy - 48 + Math.sin(a) * 20;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + Math.cos(a) * 34, sy + Math.sin(a) * 34 - 10,
                           sx + Math.cos(a) * 26 + (rnd()-0.5)*20, sy + Math.sin(a) * 40);
      ctx.stroke();
    }
    // glowing eyes
    ctx.fillStyle = COL.yellow;
    ctx.beginPath(); ctx.arc(cx - 8, cy - 48, 4, 0, 7); ctx.arc(cx + 8, cy - 48, 4, 0, 7); ctx.fill();
  }

  function drawBasilisk(ctx, cx, cy, rnd) {
    const c = '#5a6b2a';
    // long serpentine body
    ctx.strokeStyle = c; ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 80, cy + 70);
    ctx.quadraticCurveTo(cx - 30, cy + 20, cx + 10, cy + 40);
    ctx.quadraticCurveTo(cx + 60, cy + 60, cx + 50, cy - 10);
    ctx.stroke();
    // head
    ctx.fillStyle = c; ctx.strokeStyle = COL.black; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.ellipse(cx + 50, cy - 36, 30, 24, -0.3, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // jaw open
    ctx.fillStyle = COL.blood;
    ctx.beginPath();
    ctx.moveTo(cx + 72, cy - 44); ctx.lineTo(cx + 100, cy - 50); ctx.lineTo(cx + 96, cy - 28); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COL.bone;
    ctx.beginPath(); ctx.moveTo(cx + 78, cy - 44); ctx.lineTo(cx + 84, cy - 36); ctx.lineTo(cx + 90, cy - 44); ctx.fill();
    // back spikes
    ctx.fillStyle = COL.bone;
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      const x = cx - 80 + t * 130, y = cy + 64 - t * 20 - Math.sin(t*3)*14;
      ctx.beginPath();
      ctx.moveTo(x - 6, y); ctx.lineTo(x, y - 22); ctx.lineTo(x + 6, y); ctx.closePath(); ctx.fill();
    }
    // petrifying eye
    halo(ctx, cx + 44, cy - 40, 26, 'rgba(255,230,0,0.5)');
    ctx.fillStyle = COL.yellow;
    ctx.beginPath(); ctx.arc(cx + 44, cy - 40, 7, 0, 7); ctx.fill();
    ctx.fillStyle = COL.black;
    ctx.beginPath(); ctx.arc(cx + 44, cy - 40, 3, 0, 7); ctx.fill();
  }

  /* ── title splash (for the start screen) ──────────────── */
  function renderTitle(canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const rnd = mulberry32(1337);
    ctx.fillStyle = COL.black; ctx.fillRect(0, 0, W, H);
    drawRockHatch(ctx, W, H, rnd);
    // big central skull
    halo(ctx, W/2, H/2, 240, 'rgba(255,230,0,0.16)');
    skullGlyph(ctx, W/2, H/2 - 20, 110, COL.bone, COL.blood);
    splatter(ctx, W/2, H/2 + 120, rnd, COL.pinkD, 120);
    ctx.fillStyle = COL.yellow;
    ctx.font = "bold 30px Anton, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('DESCEND, KARGUNT', W/2, H - 60);
  }

  window.DarkFortArt = { render, renderTitle, COL };
})();
