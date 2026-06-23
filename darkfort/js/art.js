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
    yellow: '#c9a23f',
    pink:   '#9e2533',
    pinkD:  '#5f1620',
    blood:  '#7c1f1f',
    bone:   '#ded8c4',
    green:  '#5e7d3a',
  };

  const Ink = window.Ink;
  const HATCH = 'rgba(10,10,8,0.32)';

  /* ── real Mörk Borg skull art (ink-on-transparent PNG) ──
     Loaded once; until it arrives the procedural glyph stands
     in. When it finishes we redraw whatever is on screen.    */
  let skullImg = null;
  let skullReady = false;
  let lastDraw = null;
  if (typeof Image !== 'undefined') {
    skullImg = new Image();
    skullImg.onload = () => { skullReady = true; if (lastDraw) lastDraw(); };
    // resolve relative to this script so it works from any page depth
    let src = 'assets/skull.png';
    try {
      const s = (typeof document !== 'undefined') && document.currentScript && document.currentScript.src;
      if (s) src = s.replace(/js\/art\.js.*$/, 'assets/skull.png');
    } catch (e) {}
    skullImg.src = src;
  }
  // headless renderers (node-canvas) can inject the loaded image directly
  function setSkull(img) { skullImg = img; skullReady = !!img; }

  // draw the real skull centred on (cx,cy) at a given height.
  // `plate` paints a torn paper backing first, so the black ink
  // reads on dark backgrounds (title, hoods, death screen).
  function drawSkull(ctx, cx, cy, height, opts) {
    opts = opts || {};
    if (!skullReady || !skullImg) { // graceful fallback
      skullGlyph(ctx, cx, cy, height * 0.42, opts.fill || COL.bone, opts.eye || COL.black);
      return;
    }
    const ar = skullImg.width / skullImg.height;
    const h = height, w = h * ar;
    if (opts.plate) paperPlate(ctx, cx, cy, w * 0.92, h * 0.92, opts.rnd);
    ctx.drawImage(skullImg, cx - w / 2, cy - h / 2, w, h);
  }

  function paperPlate(ctx, cx, cy, w, h, rnd) {
    const r = rnd || Math.random;
    ctx.save();
    ctx.fillStyle = COL.paper;
    ctx.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const rr = 0.62 + 0.12 * Math.sin(t * 3 + r() * 6) + r() * 0.06;
      const x = cx + Math.cos(t) * w * rr;
      const y = cy + Math.sin(t) * h * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }


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
    lastDraw = () => render(canvas, spec);
    if (Ink.setRedraw) Ink.setRedraw(lastDraw);
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
  // edge anchor + orientation per compass direction (N,E,S,W)
  function doorEdges(cx, cy, scale) {
    return [
      { x: cx,                y: cy - scale * 1.02, o: 'v' }, // N
      { x: cx + scale * 1.18, y: cy,                o: 'h' }, // E
      { x: cx,                y: cy + scale * 1.05, o: 'v' }, // S
      { x: cx - scale * 1.18, y: cy,                o: 'h' }, // W
    ];
  }

  function drawDoors(ctx, cx, cy, scale, spec, rnd) {
    const edges = doorEdges(cx, cy, scale);
    // direction-aware doors (from the game) keep the room art aligned to
    // the map and the door buttons.
    if (spec.doorList && spec.doorList.length) {
      spec.doorList.forEach((d) => {
        const e = edges[d.dir];
        if (e) drawDoor(ctx, e.x, e.y, e.o, rnd, d.open);
      });
      return;
    }
    // legacy count-based (gallery / title splash)
    const n = spec.doors || 0;
    if (n <= 0) return;
    const order = [0, 1, 2, 3].sort(() => rnd() - 0.5);
    for (let i = 0; i < Math.min(n, 4); i++) {
      const e = edges[order[i]];
      drawDoor(ctx, e.x, e.y, e.o, rnd, false);
    }
  }

  function drawDoor(ctx, x, y, o, rnd, open) {
    const w = 30, h = 46;
    ctx.save();
    ctx.translate(x, y);
    if (o === 'h') ctx.rotate(Math.PI / 2);
    // dark opening
    ctx.fillStyle = COL.black;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.beginPath();
    ctx.arc(0, -h / 2, w / 2, Math.PI, 0);
    ctx.fill();
    // frame — bright for an unexplored door, dim for one already used
    ctx.strokeStyle = open ? 'rgba(201,162,63,0.35)' : COL.yellow;
    ctx.lineWidth = 4;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (!open) {
      ctx.strokeStyle = 'rgba(201,162,63,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-w / 2 + (w / 3) * i, -h / 2);
        ctx.lineTo(-w / 2 + (w / 3) * i, h / 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ── encounters ───────────────────────────────────────── */
  // props that can be overridden by a supplied illustration
  function propImage(ctx, cx, cy, key) {
    const rec = Ink.creatureImage && Ink.creatureImage(key);
    if (rec && rec.ready) {
      Ink.drawCreatureImage(ctx, rec, cx, cy, Math.min(ctx.canvas.width, ctx.canvas.height) * 0.7);
      return true;
    }
    return false;
  }

  function drawEncounter(ctx, cx, cy, scale, spec, rnd) {
    const enc = spec.encounter;
    if (!enc || enc.kind === 'nothing') {
      bonesOnFloor(ctx, cx, cy, scale, rnd);
      return;
    }
    switch (enc.kind) {
      case 'item':       drawItem(ctx, cx, cy, enc.item, rnd); break;
      case 'scroll':     drawItem(ctx, cx, cy, 'Scroll', rnd); break;
      case 'trap':       if (!propImage(ctx, cx, cy, 'trap')) drawTrap(ctx, cx, cy, scale, rnd); break;
      case 'soothsayer': if (!propImage(ctx, cx, cy, 'soothsayer')) drawSeer(ctx, cx, cy, rnd); break;
      case 'peddler':    if (!propImage(ctx, cx, cy, 'peddler')) drawPeddler(ctx, cx, cy, rnd); break;
      case 'monster':    drawMonster(ctx, cx, cy, enc.monster, rnd); break;
      default:           bonesOnFloor(ctx, cx, cy, scale, rnd);
    }
  }

  function bonesOnFloor(ctx, cx, cy, scale, rnd) {
    // an empty room: just dust and a few scattered bone shards along the
    // floor — no big focal skull hovering in the centre.
    ctx.strokeStyle = COL.bone;
    ctx.fillStyle = COL.bone;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = cx + (rnd() - 0.5) * scale * 1.5;
      const y = cy + scale * (0.42 + rnd() * 0.42);
      const a = rnd() * Math.PI;
      const l = 9 + rnd() * 16;
      ctx.globalAlpha = 0.4 + rnd() * 0.3;
      ctx.lineWidth = 3 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // a small half-buried skull tucked low and to the side
    drawSkull(ctx, cx - scale * 0.6, cy + scale * 0.64, 34, { rnd });
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
    // a supplied illustration (assets/creatures/<key>.png) wins
    const rec = Ink.creatureImage && Ink.creatureImage(key);
    if (rec && rec.ready) {
      Ink.drawCreatureImage(ctx, rec, cx, cy, Math.min(ctx.canvas.width, ctx.canvas.height) * 0.7);
      return;
    }
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
    const bone = COL.bone, dk = COL.black;
    const hatch = { color: 'rgba(40,36,26,0.45)', spacing: 5, angle: 1.2 };
    // legs (behind the body)
    Ink.taper(ctx, cx - 7, cy + 36, cx - 20, cy + 62, 7, 5, { fill: bone, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx - 20, cy + 62, cx - 26, cy + 84, 5, 4, { fill: bone, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 7, cy + 36, cx + 20, cy + 62, 7, 5, { fill: bone, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 20, cy + 62, cx + 26, cy + 84, 5, 4, { fill: bone, stroke: dk, lw: 2 });
    // pelvis
    Ink.form(ctx, c => { c.ellipse(cx, cy + 34, 20, 13, 0, 0, Math.PI * 2); },
      { fill: bone, stroke: dk, lw: 3, rnd, box: { x: cx - 22, y: cy + 21, w: 44, h: 28 }, hatch, shadeFrom: 'rgba(0,0,0,0.55)' });
    ctx.fillStyle = COL.ink; ctx.beginPath();
    ctx.moveTo(cx, cy + 30); ctx.lineTo(cx - 9, cy + 44); ctx.lineTo(cx, cy + 40); ctx.lineTo(cx + 9, cy + 44); ctx.closePath(); ctx.fill();
    // spine
    Ink.taper(ctx, cx, cy - 40, cx, cy + 32, 5, 8, { fill: bone, stroke: dk, lw: 2 });
    // dark chest cavity behind the ribs
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath(); ctx.ellipse(cx, cy - 14, 23, 29, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    // ribcage — filled curved ribs
    for (let i = 0; i < 5; i++) {
      const ry = cy - 34 + i * 12, rw = 25 - i * 2;
      Ink.form(ctx, c => {
        c.moveTo(cx, ry - 5);
        c.bezierCurveTo(cx + rw, ry - 7, cx + rw, ry + 9, cx, ry + 7);
        c.bezierCurveTo(cx - rw, ry + 9, cx - rw, ry - 7, cx, ry - 5);
      }, { fill: bone, stroke: dk, lw: 2.5, rnd, jitter: 1.4 });
    }
    // arms
    Ink.taper(ctx, cx - 6, cy - 36, cx - 30, cy - 6, 5.5, 4, { fill: bone, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx - 30, cy - 6, cx - 38, cy + 26, 4, 3, { fill: bone, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 6, cy - 36, cx + 30, cy - 14, 5.5, 4, { fill: bone, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 30, cy - 14, cx + 44, cy - 36, 4, 3, { fill: bone, stroke: dk, lw: 2 });
    // raised rusted dagger
    ctx.save(); ctx.translate(cx + 44, cy - 36); ctx.rotate(-0.5);
    ctx.fillStyle = COL.stone; ctx.strokeStyle = dk; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(-4, -30); ctx.lineTo(0, -38); ctx.lineTo(4, -30); ctx.lineTo(3, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6b5a3a'; ctx.fillRect(-7, 6, 14, 5); ctx.restore();
    // real skull head
    drawSkull(ctx, cx, cy - 70, 90, { rnd });
    splatter(ctx, cx - 4, cy + 58, rnd, COL.blood, 20);
    splatter(ctx, cx + 16, cy + 28, rnd, COL.blood, 12);
  }

  function drawCultist(ctx, cx, cy, rnd) {
    const robe = '#15140f', dk = COL.black;
    // robe silhouette with sleeves and a flared hem
    Ink.form(ctx, c => {
      c.moveTo(cx, cy - 60);
      c.lineTo(cx + 22, cy - 50);
      c.lineTo(cx + 40, cy + 10);
      c.lineTo(cx + 30, cy + 16);
      c.lineTo(cx + 26, cy - 10);
      c.lineTo(cx + 40, cy + 84);
      c.quadraticCurveTo(cx, cy + 74, cx - 40, cy + 84);
      c.lineTo(cx - 26, cy - 10);
      c.lineTo(cx - 30, cy + 16);
      c.lineTo(cx - 40, cy + 10);
      c.lineTo(cx - 22, cy - 50);
      c.closePath();
    }, { fill: robe, stroke: dk, lw: 4, rnd, jitter: 2,
         box: { x: cx - 40, y: cy - 60, w: 80, h: 150 }, hatch: { color: 'rgba(0,0,0,0.5)', spacing: 7, angle: 1.4 } });
    // fold lines
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 12, cy - 28); ctx.lineTo(cx + i * 16, cy + 80); ctx.stroke(); }
    // cowl + void where a face should be
    ctx.fillStyle = '#0c0b08';
    ctx.beginPath(); ctx.moveTo(cx - 24, cy - 44); ctx.quadraticCurveTo(cx, cy - 86, cx + 24, cy - 44); ctx.quadraticCurveTo(cx, cy - 40, cx - 24, cy - 44); ctx.fill();
    ctx.fillStyle = '#040403'; ctx.beginPath(); ctx.ellipse(cx, cy - 52, 16, 20, 0, 0, Math.PI * 2); ctx.fill();
    Ink.eye(ctx, cx - 7, cy - 52, 2.6, COL.yellow);
    Ink.eye(ctx, cx + 7, cy - 52, 2.6, COL.yellow);
    // raised dagger arm + blade
    Ink.taper(ctx, cx + 24, cy - 20, cx + 52, cy - 54, 6, 4, { fill: robe, stroke: dk, lw: 2 });
    ctx.save(); ctx.translate(cx + 52, cy - 54); ctx.rotate(-0.7);
    ctx.fillStyle = COL.stone; ctx.strokeStyle = dk; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-3, 4); ctx.lineTo(-3, -26); ctx.lineTo(0, -34); ctx.lineTo(3, -26); ctx.lineTo(3, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // glowing pink sigil
    ctx.strokeStyle = COL.pink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy + 20, 17, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx + 15, cy + 31); ctx.lineTo(cx - 15, cy + 31); ctx.closePath(); ctx.stroke();
  }

  function drawGoblin(ctx, cx, cy, rnd) {
    const skin = '#2f3a22', dk = COL.black;
    const hatch = { color: HATCH, spacing: 5, angle: 1.1 };
    // hunched, sinewy torso
    Ink.form(ctx, c => {
      c.moveTo(cx - 20, cy - 18);
      c.quadraticCurveTo(cx - 34, cy + 24, cx - 18, cy + 50);
      c.quadraticCurveTo(cx, cy + 58, cx + 20, cy + 50);
      c.quadraticCurveTo(cx + 30, cy + 20, cx + 22, cy - 16);
      c.quadraticCurveTo(cx, cy - 30, cx - 20, cy - 18);
    }, { fill: skin, stroke: dk, lw: 3, rnd, box: { x: cx - 34, y: cy - 30, w: 64, h: 88 }, hatch, shadeFrom: 'rgba(0,0,0,0.5)' });
    // spindly legs
    Ink.taper(ctx, cx - 12, cy + 48, cx - 18, cy + 82, 6, 4, { fill: skin, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 12, cy + 48, cx + 20, cy + 82, 6, 4, { fill: skin, stroke: dk, lw: 2 });
    // arms
    Ink.taper(ctx, cx - 16, cy - 6, cx - 40, cy + 18, 5, 3, { fill: skin, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 16, cy - 8, cx + 42, cy - 22, 5, 3, { fill: skin, stroke: dk, lw: 2 });
    // jagged knife
    ctx.save(); ctx.translate(cx + 42, cy - 22); ctx.rotate(-0.4);
    ctx.fillStyle = COL.stone; ctx.strokeStyle = dk; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(-3, -22); ctx.lineTo(2, -30); ctx.lineTo(3, -20); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // head — big cranium, long hooked nose
    Ink.form(ctx, c => {
      c.moveTo(cx - 18, cy - 34);
      c.quadraticCurveTo(cx - 22, cy - 58, cx + 4, cy - 58);
      c.quadraticCurveTo(cx + 24, cy - 56, cx + 22, cy - 36);
      c.lineTo(cx + 30, cy - 30);
      c.lineTo(cx + 16, cy - 26);
      c.quadraticCurveTo(cx + 4, cy - 22, cx - 18, cy - 34);
    }, { fill: skin, stroke: dk, lw: 3, rnd, box: { x: cx - 22, y: cy - 58, w: 54, h: 36 }, hatch });
    // huge pointed ears
    ctx.fillStyle = skin; ctx.strokeStyle = dk; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 16, cy - 44); ctx.lineTo(cx - 46, cy - 58); ctx.lineTo(cx - 14, cy - 34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 18, cy - 46); ctx.lineTo(cx + 44, cy - 64); ctx.lineTo(cx + 18, cy - 36); ctx.closePath(); ctx.fill(); ctx.stroke();
    // eyes + fanged grin
    Ink.eye(ctx, cx - 4, cy - 44, 3, COL.yellow);
    Ink.eye(ctx, cx + 10, cy - 44, 2.6, COL.yellow);
    ctx.strokeStyle = dk; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 12, cy - 30); ctx.lineTo(cx + 8, cy - 29); ctx.stroke();
    for (let i = 0; i < 3; i++) Ink.fang(ctx, cx - 8 + i * 7, cy - 30, 6, 2, COL.bone);
  }

  function drawHound(ctx, cx, cy, rnd) {
    const c = '#3a352b', dk = COL.black;
    const hatch = { color: HATCH, spacing: 5, angle: 0.6 };
    // emaciated, sway-backed body
    Ink.form(ctx, cc => {
      cc.moveTo(cx - 44, cy + 6);
      cc.quadraticCurveTo(cx - 10, cy - 10, cx + 30, cy - 2);
      cc.quadraticCurveTo(cx + 54, cy + 2, cx + 48, cy + 20);
      cc.quadraticCurveTo(cx + 10, cy + 30, cx - 30, cy + 26);
      cc.quadraticCurveTo(cx - 46, cy + 22, cx - 44, cy + 6);
    }, { fill: c, stroke: dk, lw: 3, rnd, box: { x: cx - 46, y: cy - 12, w: 104, h: 44 }, hatch, shadeFrom: 'rgba(0,0,0,0.45)' });
    // exposed ribs
    ctx.strokeStyle = COL.bone; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - 2 + i * 12, cy - 2); ctx.quadraticCurveTo(cx + 2 + i * 12, cy + 12, cx - 2 + i * 12, cy + 24); ctx.stroke(); }
    // haunch
    Ink.form(ctx, cc => { cc.ellipse(cx + 38, cy + 8, 18, 20, 0, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 2.5, rnd });
    // gaunt legs
    Ink.taper(ctx, cx - 32, cy + 22, cx - 36, cy + 72, 5, 3, { fill: c, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx - 12, cy + 24, cx - 10, cy + 72, 5, 3, { fill: c, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 34, cy + 24, cx + 38, cy + 72, 6, 3, { fill: c, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 14, cy + 26, cx + 14, cy + 72, 5, 3, { fill: c, stroke: dk, lw: 2 });
    // low head + long snout
    Ink.form(ctx, cc => { cc.ellipse(cx - 50, cy + 8, 20, 15, -0.2, 0, Math.PI * 2); }, { fill: c, stroke: dk, lw: 2.5, rnd });
    Ink.form(ctx, cc => { cc.moveTo(cx - 62, cy + 2); cc.lineTo(cx - 92, cy + 8); cc.lineTo(cx - 86, cy + 16); cc.lineTo(cx - 62, cy + 16); cc.closePath(); }, { fill: c, stroke: dk, lw: 2.5, rnd });
    // gaping fanged jaw
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.moveTo(cx - 78, cy + 14); ctx.lineTo(cx - 92, cy + 20); ctx.lineTo(cx - 72, cy + 22); ctx.closePath(); ctx.fill();
    Ink.fang(ctx, cx - 84, cy + 12, 6, 2, COL.bone); Ink.fang(ctx, cx - 74, cy + 14, 6, 2, COL.bone);
    // ear + glowing eye
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(cx - 44, cy - 4); ctx.lineTo(cx - 50, cy - 22); ctx.lineTo(cx - 36, cy - 8); ctx.closePath(); ctx.fill();
    Ink.eye(ctx, cx - 54, cy + 2, 3, COL.pink);
  }

  function drawSorcerer(ctx, cx, cy, rnd) {
    const robe = '#1b1426', dk = COL.black;
    Ink.form(ctx, c => {
      c.moveTo(cx, cy - 78);
      c.lineTo(cx + 20, cy - 70);
      c.lineTo(cx + 30, cy - 20);
      c.lineTo(cx + 54, cy + 86);
      c.quadraticCurveTo(cx, cy + 74, cx - 54, cy + 86);
      c.lineTo(cx - 30, cy - 20);
      c.lineTo(cx - 20, cy - 70);
      c.closePath();
    }, { fill: robe, stroke: dk, lw: 4, rnd, jitter: 2,
         box: { x: cx - 54, y: cy - 78, w: 108, h: 164 }, hatch: { color: 'rgba(0,0,0,0.45)', spacing: 8, angle: 1.5 } });
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 16, cy - 10); ctx.lineTo(cx + i * 24, cy + 82); ctx.stroke(); }
    // skeletal arm to the staff
    Ink.taper(ctx, cx + 28, cy + 10, cx + 50, cy - 30, 6, 4, { fill: robe, stroke: dk, lw: 2 });
    // death staff + green orb
    ctx.strokeStyle = '#2a1f38'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + 50, cy + 30); ctx.lineTo(cx + 62, cy - 92); ctx.stroke();
    Ink.eye(ctx, cx + 62, cy - 92, 9, COL.green);
    ctx.strokeStyle = COL.green; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) { const a = rnd() * 7; ctx.beginPath(); ctx.moveTo(cx + 62, cy - 92); ctx.lineTo(cx + 62 + Math.cos(a) * 30, cy - 92 + Math.sin(a) * 30); ctx.stroke(); }
    // cowl + real skull face on a torn plate
    ctx.fillStyle = '#0c0a12';
    ctx.beginPath(); ctx.moveTo(cx - 26, cy - 50); ctx.quadraticCurveTo(cx, cy - 94, cx + 26, cy - 50); ctx.quadraticCurveTo(cx, cy - 46, cx - 26, cy - 50); ctx.fill();
    drawSkull(ctx, cx, cy - 58, 70, { plate: true, rnd });
  }

  function drawTroll(ctx, cx, cy, rnd) {
    const stone = '#56544c', dark = '#34322c', dk = COL.black;
    // tall, jagged stone body — sharp shards, low jitter so facets stay crisp
    const body = (c) => {
      c.moveTo(cx - 34, cy - 44); c.lineTo(cx - 10, cy - 58); c.lineTo(cx + 6, cy - 46);
      c.lineTo(cx + 28, cy - 60); c.lineTo(cx + 46, cy - 34); c.lineTo(cx + 36, cy - 4);
      c.lineTo(cx + 54, cy + 78); c.lineTo(cx + 18, cy + 62); c.lineTo(cx + 2, cy + 80);
      c.lineTo(cx - 22, cy + 62); c.lineTo(cx - 50, cy + 78); c.lineTo(cx - 38, cy - 6); c.closePath();
    };
    Ink.form(ctx, body, { fill: stone, stroke: dk, lw: 5, rnd, jitter: 1.5,
      box: { x: cx - 50, y: cy - 60, w: 104, h: 140 }, shadeFrom: 'rgba(0,0,0,0.55)' });
    // bright catch-light facets (left planes)
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.moveTo(cx - 34, cy - 44); ctx.lineTo(cx - 10, cy - 58); ctx.lineTo(cx - 8, cy - 10); ctx.lineTo(cx - 30, cy + 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - 38, cy - 6); ctx.lineTo(cx - 18, cy + 10); ctx.lineTo(cx - 22, cy + 62); ctx.lineTo(cx - 50, cy + 78); ctx.closePath(); ctx.fill();
    // dark facets (right planes)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.moveTo(cx + 6, cy - 46); ctx.lineTo(cx + 28, cy - 60); ctx.lineTo(cx + 46, cy - 34); ctx.lineTo(cx + 36, cy - 4); ctx.lineTo(cx + 10, cy + 6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx + 36, cy - 4); ctx.lineTo(cx + 54, cy + 78); ctx.lineTo(cx + 18, cy + 62); ctx.lineTo(cx + 14, cy + 10); ctx.closePath(); ctx.fill();
    // cracks
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 46); ctx.lineTo(cx + 2, cy - 10); ctx.lineTo(cx - 10, cy + 40); ctx.stroke();
    // mossy black drips
    ctx.strokeStyle = '#10180a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const x = cx - 40 + rnd() * 80; ctx.beginPath(); ctx.moveTo(x, cy - 10 + rnd() * 40); ctx.lineTo(x, cy + 30 + rnd() * 34); ctx.stroke(); }
    // jagged crown head + deep glowing eyes
    Ink.form(ctx, c => { c.moveTo(cx - 20, cy - 44); c.lineTo(cx - 12, cy - 78); c.lineTo(cx - 2, cy - 58); c.lineTo(cx + 8, cy - 82); c.lineTo(cx + 18, cy - 56); c.lineTo(cx + 24, cy - 44); c.closePath(); },
      { fill: dark, stroke: dk, lw: 3, rnd });
    Ink.eye(ctx, cx - 7, cy - 52, 4, COL.yellow);
    Ink.eye(ctx, cx + 9, cy - 52, 4, COL.yellow);
    // massive arms ending in angular rock fists
    Ink.taper(ctx, cx - 40, cy - 20, cx - 76, cy + 44, 17, 13, { fill: stone, stroke: dk, lw: 4 });
    Ink.form(ctx, c => { c.moveTo(cx - 92, cy + 42); c.lineTo(cx - 78, cy + 34); c.lineTo(cx - 64, cy + 48); c.lineTo(cx - 72, cy + 64); c.lineTo(cx - 90, cy + 58); c.closePath(); }, { fill: stone, stroke: dk, lw: 3, rnd });
    Ink.taper(ctx, cx + 42, cy - 20, cx + 80, cy + 38, 17, 13, { fill: stone, stroke: dk, lw: 4 });
    Ink.form(ctx, c => { c.moveTo(cx + 92, cy + 36); c.lineTo(cx + 78, cy + 28); c.lineTo(cx + 64, cy + 42); c.lineTo(cx + 72, cy + 58); c.lineTo(cx + 92, cy + 52); c.closePath(); }, { fill: stone, stroke: dk, lw: 3, rnd });
  }

  function drawMedusa(ctx, cx, cy, rnd) {
    const skin = '#6f7a52', scale = '#566042', dk = COL.black;
    // coiled serpent lower body
    Ink.serpent(ctx, [[cx - 6, cy + 10], [cx - 30, cy + 34], [cx - 16, cy + 62], [cx + 24, cy + 70], [cx + 44, cy + 50], [cx + 30, cy + 30]],
      20, 6, { fill: scale, stroke: dk, lw: 3, rnd, box: { x: cx - 40, y: cy + 10, w: 90, h: 70 }, hatch: { color: HATCH, spacing: 5, angle: 0.7 } });
    // a striking lower serpent maw
    ctx.fillStyle = scale; ctx.strokeStyle = dk; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(cx - 30, cy + 74, 12, 8, 0.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.moveTo(cx - 40, cy + 72); ctx.lineTo(cx - 54, cy + 78); ctx.lineTo(cx - 40, cy + 82); ctx.closePath(); ctx.fill();
    Ink.fang(ctx, cx - 44, cy + 72, 5, 1.6, COL.bone);
    // muscular torso
    Ink.form(ctx, c => {
      c.moveTo(cx - 22, cy - 30);
      c.quadraticCurveTo(cx - 30, cy + 4, cx - 12, cy + 18);
      c.quadraticCurveTo(cx, cy + 24, cx + 12, cy + 18);
      c.quadraticCurveTo(cx + 30, cy + 4, cx + 22, cy - 30);
      c.quadraticCurveTo(cx, cy - 40, cx - 22, cy - 30);
    }, { fill: skin, stroke: dk, lw: 3, rnd, box: { x: cx - 30, y: cy - 40, w: 60, h: 64 }, hatch: { color: HATCH, spacing: 5, angle: 1.4 }, shadeFrom: 'rgba(0,0,0,0.4)' });
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(cx - 10, cy - 14 + i * 12); ctx.quadraticCurveTo(cx, cy - 10 + i * 12, cx + 10, cy - 14 + i * 12); ctx.stroke(); }
    // arms
    Ink.taper(ctx, cx - 18, cy - 18, cx - 48, cy - 2, 6, 3, { fill: skin, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 18, cy - 18, cx + 48, cy - 6, 6, 3, { fill: skin, stroke: dk, lw: 2 });
    // head
    Ink.form(ctx, c => { c.ellipse(cx, cy - 46, 16, 19, 0, 0, Math.PI * 2); },
      { fill: skin, stroke: dk, lw: 2.5, rnd, box: { x: cx - 16, y: cy - 64, w: 32, h: 38 }, hatch: { color: HATCH, spacing: 4, angle: 1.2 } });
    // writhing mass of snake hair
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI + (i / 10) * Math.PI;
      const bx = cx + Math.cos(a) * 14, by = cy - 50 + Math.sin(a) * 14;
      const ex = bx + Math.cos(a) * (30 + rnd() * 16) + (rnd() - 0.5) * 14;
      const ey = by + Math.sin(a) * (30 + rnd() * 16) - 6;
      const mx = (bx + ex) / 2 + (rnd() - 0.5) * 18, my = (by + ey) / 2 - 10;
      Ink.serpent(ctx, [[bx, by], [mx, my], [ex, ey]], 5, 2, { fill: COL.green, stroke: dk, lw: 1.5, rnd });
      ctx.fillStyle = COL.green; ctx.beginPath(); ctx.arc(ex, ey, 3, 0, 7); ctx.fill();
      ctx.fillStyle = COL.pink; ctx.fillRect(ex - 1, ey - 1, 2, 2);
    }
    Ink.eye(ctx, cx - 6, cy - 48, 3, COL.yellow);
    Ink.eye(ctx, cx + 6, cy - 48, 3, COL.yellow);
    ctx.strokeStyle = dk; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx - 7, cy - 38); ctx.lineTo(cx + 7, cy - 38); ctx.stroke();
  }

  function drawBasilisk(ctx, cx, cy, rnd) {
    const c = '#4a5a26', dk = COL.black;
    // serpentine body, thick toward the head
    Ink.serpent(ctx, [[cx - 86, cy + 72], [cx - 50, cy + 50], [cx - 14, cy + 54], [cx + 18, cy + 40], [cx + 44, cy + 8], [cx + 50, cy - 18]],
      8, 20, { fill: c, stroke: dk, lw: 3, rnd, box: { x: cx - 86, y: cy + 0, w: 140, h: 78 }, hatch: { color: HATCH, spacing: 5, angle: 0.5 }, shadeFrom: 'rgba(0,0,0,0.45)' });
    // clawed legs
    Ink.taper(ctx, cx - 40, cy + 58, cx - 46, cy + 82, 6, 4, { fill: c, stroke: dk, lw: 2 });
    Ink.taper(ctx, cx + 6, cy + 52, cx + 2, cy + 80, 6, 4, { fill: c, stroke: dk, lw: 2 });
    Ink.claw(ctx, cx - 46, cy + 82, 8, 0.3, 3, COL.bone);
    Ink.claw(ctx, cx + 2, cy + 80, 8, -0.1, 3, COL.bone);
    // back spines
    [[cx - 80, cy + 66], [cx - 46, cy + 46], [cx - 12, cy + 50], [cx + 20, cy + 36], [cx + 42, cy + 6]]
      .forEach((p, i) => Ink.spike(ctx, p[0], p[1] - 4, 16 + i * 2, 5, 0, COL.bone));
    // head
    Ink.form(ctx, cc => { cc.ellipse(cx + 52, cy - 30, 28, 22, -0.3, 0, Math.PI * 2); },
      { fill: c, stroke: dk, lw: 3, rnd, box: { x: cx + 24, y: cy - 52, w: 56, h: 44 }, hatch: { color: HATCH, spacing: 4, angle: 1 } });
    // gaping fanged maw
    ctx.fillStyle = COL.blood; ctx.beginPath(); ctx.moveTo(cx + 70, cy - 40); ctx.lineTo(cx + 102, cy - 46); ctx.lineTo(cx + 96, cy - 22); ctx.lineTo(cx + 74, cy - 26); ctx.closePath(); ctx.fill();
    Ink.fang(ctx, cx + 80, cy - 40, 8, 2.4, COL.bone); Ink.fang(ctx, cx + 90, cy - 40, 8, 2.4, COL.bone);
    // petrifying eye
    Ink.eye(ctx, cx + 44, cy - 36, 5, COL.yellow);
    ctx.fillStyle = dk; ctx.beginPath(); ctx.arc(cx + 44, cy - 36, 2.4, 0, 7); ctx.fill();
  }

  /* ── title splash (for the start screen) ──────────────── */
  function renderTitle(canvas) {
    lastDraw = () => renderTitle(canvas);
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const rnd = mulberry32(1337);
    ctx.fillStyle = COL.black; ctx.fillRect(0, 0, W, H);
    drawRockHatch(ctx, W, H, rnd);
    // the real Mörk Borg skull, big, on a yellow burst
    halo(ctx, W / 2, H / 2 - 20, 280, 'rgba(255,230,0,0.22)');
    splatter(ctx, W / 2 - 120, H / 2 + 150, rnd, COL.pinkD, 120);
    splatter(ctx, W / 2 + 140, H / 2 + 60, rnd, COL.pinkD, 90);
    drawSkull(ctx, W / 2, H / 2 - 30, 360, { plate: true, rnd });
    // splatter a little blood dripping off it
    splatter(ctx, W / 2, H / 2 + 150, rnd, COL.blood, 70);
    ctx.fillStyle = COL.yellow;
    ctx.font = "bold 30px Anton, sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('DESCEND, KARGUNT', W / 2, H - 56);
  }

  window.DarkFortArt = { render, renderTitle, COL, setSkull };
})();
