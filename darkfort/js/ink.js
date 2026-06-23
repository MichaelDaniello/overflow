/* ============================================================
   INK — a small toolkit for drawing creatures as filled,
   shaded, rough-edged ink silhouettes (a cheap lithograph /
   Mörk Borg look) on a 2D canvas. Shared by art.js (Dark Fort)
   and forest-art.js (Dark Forest) so both games read the same.

   The headline call is Ink.form(): you pass a `trace` function
   that lays down a path; it fills the mass, hatches/darkens one
   side inside that mass for volume, then re-traces a rough
   double outline on top. Everything is deterministic given the
   seeded rnd the caller threads through.
   ============================================================ */

(function () {
  'use strict';

  // trace a polyline/loop with a per-point hand-drawn wobble
  function wobble(ctx, pts, rnd, jit, close) {
    for (let i = 0; i < pts.length; i++) {
      const jx = jit ? (rnd() - 0.5) * jit : 0;
      const jy = jit ? (rnd() - 0.5) * jit : 0;
      const x = pts[i][0] + jx, y = pts[i][1] + jy;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    if (close !== false) ctx.closePath();
  }

  // parallel hatch lines clipped to whatever path is current
  function hatchBox(ctx, x, y, w, h, opt) {
    const a = opt.angle != null ? opt.angle : Math.PI / 3;
    const sp = opt.spacing || 6;
    const rnd = opt.rnd || Math.random;
    ctx.save();
    ctx.strokeStyle = opt.color || 'rgba(0,0,0,0.35)';
    ctx.lineWidth = opt.lw || 1;
    ctx.lineCap = 'round';
    const diag = Math.hypot(w, h);
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy, py = dx; // perpendicular step
    const steps = Math.ceil((diag * 2) / sp);
    const cxp = x + w / 2, cyp = y + h / 2;
    for (let i = -steps; i <= steps; i++) {
      const ox = cxp + px * i * sp, oy = cyp + py * i * sp;
      ctx.beginPath();
      ctx.moveTo(ox - dx * diag, oy - dy * diag + (rnd() - 0.5) * 1.5);
      ctx.lineTo(ox + dx * diag, oy + dy * diag + (rnd() - 0.5) * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // the workhorse: fill a form, shade/hatch it, rough-outline it
  function form(ctx, trace, opt) {
    opt = opt || {};
    const rnd = opt.rnd || Math.random;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. base fill
    ctx.beginPath(); trace(ctx);
    if (opt.fill) { ctx.fillStyle = opt.fill; ctx.fill(); }

    // 2. shade + hatch inside the mass (clip to it)
    if (opt.box && (opt.hatch || opt.shadeFrom)) {
      ctx.save();
      ctx.beginPath(); trace(ctx); ctx.clip();
      const b = opt.box;
      if (opt.shadeFrom) {
        const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, opt.shadeFrom);
        ctx.fillStyle = g;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      if (opt.hatch) {
        hatchBox(ctx, b.x, b.y, b.w, b.h, Object.assign({ rnd }, opt.hatch));
      }
      ctx.restore();
    }

    // 3. rough double outline
    if (opt.stroke !== null) {
      const sc = opt.stroke || '#0a0a08';
      ctx.strokeStyle = sc;
      ctx.lineWidth = opt.lw || 4;
      ctx.beginPath(); wobbleTrace(ctx, trace, rnd, opt.jitter != null ? opt.jitter : 2.5); ctx.stroke();
      ctx.lineWidth = (opt.lw || 4) * 0.4;
      ctx.beginPath(); wobbleTrace(ctx, trace, rnd, (opt.jitter != null ? opt.jitter : 2.5) * 1.8); ctx.stroke();
    }
    ctx.restore();
  }

  // re-run a trace but jitter the resulting subpath points is hard;
  // instead we just stroke the exact path twice with slightly
  // different line widths — the rough look comes from the traces
  // themselves using `pts` wobble. This keeps `trace` simple.
  function wobbleTrace(ctx, trace, rnd, jit) { trace(ctx); }

  // tapered limb/neck/tail as a filled quad capped by circles
  function taper(ctx, ax, ay, bx, by, wa, wb, opt) {
    opt = opt || {};
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const trace = (c) => {
      c.moveTo(ax + nx * wa, ay + ny * wa);
      c.lineTo(bx + nx * wb, by + ny * wb);
      c.lineTo(bx - nx * wb, by - ny * wb);
      c.lineTo(ax - nx * wa, ay - ny * wa);
      c.closePath();
    };
    ctx.save();
    ctx.beginPath(); trace(ctx);
    if (opt.fill) { ctx.fillStyle = opt.fill; ctx.fill(); }
    // round the joints
    if (opt.fill) {
      ctx.beginPath(); ctx.arc(ax, ay, wa, 0, 7); ctx.arc(bx, by, wb, 0, 7); ctx.fillStyle = opt.fill; ctx.fill();
    }
    if (opt.stroke !== null) {
      ctx.strokeStyle = opt.stroke || '#0a0a08';
      ctx.lineWidth = opt.lw || 3;
      ctx.beginPath();
      ctx.moveTo(ax + nx * wa, ay + ny * wa); ctx.lineTo(bx + nx * wb, by + ny * wb);
      ctx.moveTo(ax - nx * wa, ay - ny * wa); ctx.lineTo(bx - nx * wb, by - ny * wb);
      ctx.stroke();
    }
    ctx.restore();
  }

  // a curved tapering body (spine/serpent) through control points
  function serpent(ctx, pts, w0, w1, opt) {
    opt = opt || {};
    const n = pts.length;
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w = w0 + (w1 - w0) * (i / (n - 1));
      left.push([p[0] + nx * w, p[1] + ny * w]);
      right.push([p[0] - nx * w, p[1] - ny * w]);
    }
    const trace = (c) => {
      c.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < n; i++) c.lineTo(left[i][0], left[i][1]);
      for (let i = n - 1; i >= 0; i--) c.lineTo(right[i][0], right[i][1]);
      c.closePath();
    };
    form(ctx, trace, opt);
  }

  function claw(ctx, x, y, len, angle, w, color) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 0.3, len * 0.6, 0, len);
    ctx.quadraticCurveTo(w * 0.3, len * 0.6, w, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function fang(ctx, x, y, len, w, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - w, y); ctx.lineTo(x, y + len); ctx.lineTo(x + w, y);
    ctx.closePath(); ctx.fill();
  }

  function spike(ctx, x, y, len, w, angle, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(0, -len); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function stipple(ctx, x, y, w, h, n, color, rnd) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const r = rnd() * 1.4;
      ctx.fillRect(x + rnd() * w, y + rnd() * h, r, r);
    }
  }

  // glowing eye(s)
  function eye(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 7); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }

  function ellipseTrace(cx, cy, rx, ry, rot) {
    return (c) => { c.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2); };
  }

  /* ── drop-in creature illustrations ───────────────────────
     Place a PNG (ideally transparent background) at
     assets/creatures/<key>.png and it replaces the procedural
     drawing for that encounter. Until it loads (or if it's
     absent) the procedural art stands in. Headless renderers
     have no Image, so they always use the procedural path.    */
  let ASSET_BASE = 'assets/creatures/';
  try {
    const s = (typeof document !== 'undefined') && document.currentScript && document.currentScript.src;
    if (s) ASSET_BASE = s.replace(/js\/ink\.js.*$/, 'assets/creatures/');
  } catch (e) {}

  let redraw = null;
  function setRedraw(fn) { redraw = fn; }

  const _imgs = {};
  function creatureImage(key) {
    if (_imgs[key] !== undefined) return _imgs[key];   // cached (incl. preloaded)
    if (typeof Image === 'undefined') return null;      // headless
    const rec = { ready: false, img: new Image() };
    rec.img.onload = () => { rec.ready = true; if (redraw) redraw(); };
    rec.img.onerror = () => { rec.ready = false; };     // missing → procedural
    rec.img.src = ASSET_BASE + key + '.png';
    _imgs[key] = rec;
    return rec;
  }
  // offline renderers (node-canvas) inject decoded images directly
  function preload(key, img) { _imgs[key] = { ready: true, img: img }; }

  // draw a supplied illustration as a matted "bestiary plate" centred
  // on (cx,cy), fit to maxH. A parchment mat sits behind it so the dark
  // ink art (and any knocked-out background) reads on the dark scene.
  function drawCreatureImage(ctx, rec, cx, cy, maxH) {
    const img = rec && rec.img;
    if (!img || !img.width) return false;
    const ar = img.width / img.height;
    let h = maxH, w = h * ar;
    const maxW = maxH * 1.05;
    if (w > maxW) { w = maxW; h = w / ar; }
    const x = cx - w / 2, y = cy - h / 2;
    const b = Math.max(6, Math.round(h * 0.024));   // mat width
    ctx.save();
    // drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - b + 8, y - b + 10, w + 2 * b, h + 2 * b);
    // parchment mat (shows through knocked-out areas)
    ctx.fillStyle = '#cdc5ab';
    ctx.fillRect(x - b, y - b, w + 2 * b, h + 2 * b);
    // the illustration
    ctx.drawImage(img, x, y, w, h);
    // ink border
    const lw = Math.max(2, Math.round(b * 0.55));
    ctx.lineWidth = lw; ctx.strokeStyle = '#0c0b08';
    ctx.strokeRect(x - b + lw / 2, y - b + lw / 2, w + 2 * b - lw, h + 2 * b - lw);
    ctx.restore();
    return true;
  }

  window.Ink = {
    form, taper, serpent, hatchBox, wobble,
    claw, fang, spike, stipple, eye, ellipseTrace,
    creatureImage, drawCreatureImage, preload, setRedraw,
  };
})();
