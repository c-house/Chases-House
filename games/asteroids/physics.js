/* ═══════════════════════════════════════════════════════════════
   Asteroids — physics.js
   Pure math. No entity knowledge. No game state.
   Exposes window.AsteroidsPhysics.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function vec(x, y) { return { x: x, y: y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul(v, s) { return { x: v.x * s, y: v.y * s }; }
  function len(v)    { return Math.sqrt(v.x * v.x + v.y * v.y); }
  function normalize(v) {
    const L = len(v);
    return L > 1e-6 ? { x: v.x / L, y: v.y / L } : { x: 0, y: 0 };
  }

  // Toroidal screen wrap — used by every entity each tick.
  function wrap(v, max) {
    if (v < 0) return v + max;
    if (v >= max) return v - max;
    return v;
  }

  function wrapEntity(e, W, H) {
    e.x = wrap(e.x, W);
    e.y = wrap(e.y, H);
  }

  // Circle-vs-circle broadphase. Cheap, used for every collision check.
  function circleHit(ax, ay, bx, by, ra, rb) {
    const dx = ax - bx, dy = ay - by;
    const r = ra + rb;
    return dx * dx + dy * dy <= r * r;
  }

  // Point-in-polygon via ray casting. Used for ship-vs-asteroid:
  // ship center as point, asteroid vertices as polygon. Vertices must be
  // absolute world coords (caller resolves rotation+breathe before calling).
  function pointInPolygon(px, py, verts) {
    let inside = false;
    for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
      const xi = verts[i].x, yi = verts[i].y;
      const xj = verts[j].x, yj = verts[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Inclusive of min, exclusive of max — same convention as Math.random().
  function randRange(min, max) { return min + Math.random() * (max - min); }

  window.AsteroidsPhysics = {
    vec: vec, add: add, sub: sub, mul: mul, len: len, normalize: normalize,
    wrap: wrap, wrapEntity: wrapEntity,
    circleHit: circleHit, pointInPolygon: pointInPolygon,
    randRange: randRange
  };
})();
