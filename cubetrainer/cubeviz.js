/*! cubeviz.js 0.1.0 - Rubik's cube case/alg viewer for Anki. ES5, no dependencies, SVG only (no WebGL). */
(function (root) {
  'use strict';

  var VERSION = '0.1.0';
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------ */
  /* Geometry + move engine                                              */
  /* ------------------------------------------------------------------ */
  var LETTERS = ['U', 'D', 'F', 'B', 'R', 'L'];
  var NORMALS = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };

  function letterOf(v) {
    for (var i = 0; i < 6; i++) {
      var n = NORMALS[LETTERS[i]];
      if (n[0] === v[0] && n[1] === v[1] && n[2] === v[2]) { return LETTERS[i]; }
    }
    return null;
  }

  // k quarter turns, right-hand rule about +axis (0=x,1=y,2=z). Works on floats too (pure permutation).
  function rotVec(v, axis, k) {
    k = ((k % 4) + 4) % 4;
    var x = v[0], y = v[1], z = v[2], t;
    while (k--) {
      if (axis === 0) { t = y; y = -z; z = t; }
      else if (axis === 1) { t = x; x = z; z = -t; }
      else { t = x; x = -y; y = t; }
    }
    return [x, y, z];
  }

  function rotF(v, axis, th) {
    var c = Math.cos(th), s = Math.sin(th), x = v[0], y = v[1], z = v[2];
    if (axis === 0) { return [x, y * c - z * s, y * s + z * c]; }
    if (axis === 1) { return [x * c + z * s, y, -x * s + z * c]; }
    return [x * c - y * s, x * s + y * c, z];
  }

  // a = axis, l = layers (coordinate values along the axis), k = signed quarter turns (right-hand)
  var MOVE_DEFS = {
    R: { a: 0, l: [1], k: -1 }, L: { a: 0, l: [-1], k: 1 },
    U: { a: 1, l: [1], k: -1 }, D: { a: 1, l: [-1], k: 1 },
    F: { a: 2, l: [1], k: -1 }, B: { a: 2, l: [-1], k: 1 },
    M: { a: 0, l: [0], k: 1 }, E: { a: 1, l: [0], k: 1 }, S: { a: 2, l: [0], k: -1 },
    r: { a: 0, l: [0, 1], k: -1 }, l: { a: 0, l: [-1, 0], k: 1 },
    u: { a: 1, l: [0, 1], k: -1 }, d: { a: 1, l: [-1, 0], k: 1 },
    f: { a: 2, l: [0, 1], k: -1 }, b: { a: 2, l: [-1, 0], k: 1 },
    x: { a: 0, l: [-1, 0, 1], k: -1 }, y: { a: 1, l: [-1, 0, 1], k: -1 }, z: { a: 2, l: [-1, 0, 1], k: -1 }
  };

  function normK(k) {
    var r = ((k % 4) + 4) % 4;
    if (r === 3) { return -1; }
    if (r === 2) { return k < 0 ? -2 : 2; }
    return r;
  }

  function parseMove(tok) {
    var m = /^([UDFBRLudfbrlMESxyz])(w?)(\d*)(')?(\d*)$/.exec(tok);
    if (!m) { throw new Error('Unknown move: ' + tok); }
    var face = m[1];
    if (m[2]) {
      if ('UDFBRL'.indexOf(face) < 0) { throw new Error('Unknown move: ' + tok); }
      face = face.toLowerCase();
    }
    var n = parseInt(m[3] || m[5] || '1', 10);
    if (!n) { n = 1; }
    var def = MOVE_DEFS[face];
    return { name: tok, a: def.a, layers: def.l, k: normK(def.k * n * (m[4] ? -1 : 1)) };
  }

  function parseAlg(str) {
    str = String(str === null || str === undefined ? '' : str);
    str = str.replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&#x27;|&#39;|&apos;/g, "'")
      .replace(/[\u00a0\u2000-\u200b]/g, ' ')
      .replace(/[\u2018\u2019\u2032\u00b4`]/g, "'")
      .replace(/[()\u00b7]/g, ' ');
    var toks = str.split(/\s+/), out = [];
    for (var i = 0; i < toks.length; i++) {
      if (toks[i]) { out.push(parseMove(toks[i])); }
    }
    return out;
  }

  function invName(n) {
    if (/2/.test(n)) { return n.replace(/'/g, ''); }
    return n.indexOf("'") >= 0 ? n.replace(/'/g, '') : n + "'";
  }

  function invertMove(mv) { return { name: invName(mv.name), a: mv.a, layers: mv.layers, k: -mv.k }; }

  function invertAlg(moves) {
    var out = [];
    for (var i = moves.length - 1; i >= 0; i--) { out.push(invertMove(moves[i])); }
    return out;
  }

  function algToString(moves) {
    var s = [];
    for (var i = 0; i < moves.length; i++) { s.push(moves[i].name); }
    return s.join(' ');
  }

  // State: 26 cubies. m = world images of the cubie's local +x,+y,+z axes. sc[i] = sticker letter on local dir i.
  var LDIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

  function solved() {
    var cubies = [], x, y, z, i;
    for (x = -1; x <= 1; x++) {
      for (y = -1; y <= 1; y++) {
        for (z = -1; z <= 1; z++) {
          if (!x && !y && !z) { continue; }
          var cb = { home: [x, y, z], p: [x, y, z], m: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], sc: [] };
          for (i = 0; i < 6; i++) {
            var d = LDIRS[i], has = (d[0] && d[0] === x) || (d[1] && d[1] === y) || (d[2] && d[2] === z);
            cb.sc.push(has ? letterOf(d) : null);
          }
          cubies.push(cb);
        }
      }
    }
    return { cubies: cubies };
  }

  function cloneState(st) {
    var out = [];
    for (var i = 0; i < st.cubies.length; i++) {
      var c = st.cubies[i];
      out.push({ home: c.home, sc: c.sc, p: c.p.slice(), m: [c.m[0].slice(), c.m[1].slice(), c.m[2].slice()] });
    }
    return { cubies: out };
  }

  function inLayer(cb, mv) { return mv.layers.indexOf(cb.p[mv.a]) >= 0; }

  function applyMove(st, mv) {
    if (!mv.k) { return; }
    for (var i = 0; i < st.cubies.length; i++) {
      var cb = st.cubies[i];
      if (inLayer(cb, mv)) {
        cb.p = rotVec(cb.p, mv.a, mv.k);
        cb.m = [rotVec(cb.m[0], mv.a, mv.k), rotVec(cb.m[1], mv.a, mv.k), rotVec(cb.m[2], mv.a, mv.k)];
      }
    }
  }

  function applyMoves(st, moves) { for (var i = 0; i < moves.length; i++) { applyMove(st, moves[i]); } }

  // world normal of the sticker on local direction index i
  function stickerNormal(cb, i) {
    var a = i >> 1, sg = (i & 1) ? -1 : 1, v = cb.m[a];
    return [sg * v[0], sg * v[1], sg * v[2]];
  }

  // 24 whole-cube rotations as move sequences (BFS over x,y,z), keyed by where each face centre goes.
  var ROT_TABLE = null;
  function rotKey(seqMoves) {
    var key = [], i, j;
    for (i = 0; i < 6; i++) {
      var v = NORMALS[LETTERS[i]];
      for (j = 0; j < seqMoves.length; j++) { v = rotVec(v, seqMoves[j].a, seqMoves[j].k); }
      key.push(letterOf(v));
    }
    return key.join('');
  }
  function rotationTable() {
    if (ROT_TABLE) { return ROT_TABLE; }
    var gens = [parseMove('x'), parseMove('y'), parseMove('z')];
    var table = {}, queue = [[]], n = 0;
    table[rotKey([])] = [];
    while (queue.length) {
      var seq = queue.shift();
      for (var g = 0; g < 3; g++) {
        var nxt = seq.concat([gens[g]]), k = rotKey(nxt);
        if (!table.hasOwnProperty(k)) { table[k] = nxt; queue.push(nxt); n++; }
      }
    }
    ROT_TABLE = table;
    return table;
  }

  // Whole-cube rotation that the centres undergo when `moves` are applied to a solved cube.
  function centreRotation(moves) {
    var st = solved(), key = [], i, j;
    applyMoves(st, moves);
    for (i = 0; i < 6; i++) {
      var h = NORMALS[LETTERS[i]];
      for (j = 0; j < st.cubies.length; j++) {
        var c = st.cubies[j];
        if (c.home[0] === h[0] && c.home[1] === h[1] && c.home[2] === h[2]) { key.push(letterOf(c.p)); }
      }
    }
    var seq = rotationTable()[key.join('')];
    if (!seq) { throw new Error('Cannot normalise centres (unsupported slice-only alg?)'); }
    return seq;
  }

  // The cube as it looks right before `alg` is performed (or an explicit scramble from a solved cube).
  function caseState(algMoves, scrMoves) {
    var st = solved();
    if (scrMoves && scrMoves.length) { applyMoves(st, scrMoves); return st; }
    applyMoves(st, centreRotation(algMoves));
    applyMoves(st, invertAlg(algMoves));
    return st;
  }

  function isSolvedUpToRotation(st) {
    var faceCol = {}, i, j;
    for (i = 0; i < st.cubies.length; i++) {
      var cb = st.cubies[i];
      for (j = 0; j < 6; j++) {
        if (!cb.sc[j]) { continue; }
        var f = letterOf(stickerNormal(cb, j));
        if (faceCol[f] === undefined) { faceCol[f] = cb.sc[j]; }
        else if (faceCol[f] !== cb.sc[j]) { return false; }
      }
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Colours, schemes, stages                                            */
  /* ------------------------------------------------------------------ */
  var COLORS = { white: '#ffffff', yellow: '#ffd500', green: '#009b48', blue: '#0046ad', red: '#b71234', orange: '#ff5800' };
  var GREY = '#8a8a8a', BLACK = '#161616';
  var STD = { U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange' };
  // rotation that brings the named colour (standard cube: white-top, green-front) to the D face
  var CROSS_ROT = { white: 'z2', yellow: '', green: "x'", blue: 'x', red: 'z', orange: "z'" };

  function rotateVecBy(v, moves) {
    for (var i = 0; i < moves.length; i++) { v = rotVec(v, moves[i].a, moves[i].k); }
    return v;
  }

  // scheme: home-face letter -> hex. cross = colour name on D; front = colour name on F (optional).
  function makeScheme(cross, front, custom) {
    cross = (cross || 'white').toLowerCase();
    if (!CROSS_ROT.hasOwnProperty(cross)) { cross = 'white'; }
    var rot = parseAlg(CROSS_ROT[cross]), names = {}, i, h;
    for (i = 0; i < 6; i++) {
      h = LETTERS[i];
      names[letterOf(rotateVecBy(NORMALS[h], rot))] = STD[h];
    }
    front = (front || '').toLowerCase();
    if (front && COLORS.hasOwnProperty(front) && front !== cross) {
      for (var t = 0; t < 4 && names.F !== front; t++) {
        var nn = {};
        for (i = 0; i < 6; i++) {
          h = LETTERS[i];
          nn[letterOf(rotVec(NORMALS[h], 1, -1))] = names[h];
        }
        names = nn;
      }
    }
    var scheme = {};
    for (i = 0; i < 6; i++) {
      var nm = names[LETTERS[i]];
      scheme[LETTERS[i]] = (custom && custom[nm]) ? custom[nm] : COLORS[nm];
    }
    scheme._names = names;
    return scheme;
  }

  // Which colour letter does this sticker show for the stage? null = greyed out.
  function maskLetter(cb, c, stage) {
    var h = cb.home, nz = (h[0] !== 0 ? 1 : 0) + (h[1] !== 0 ? 1 : 0) + (h[2] !== 0 ? 1 : 0);
    if (nz === 1) { return c; }
    var ll = h[1] === 1;
    switch (stage) {
      case 'oll': return ll ? (c === 'U' ? c : null) : c;
      case 'coll': if (!ll || nz === 3) { return c; } return c === 'U' ? c : null;
      case 'cmll': if (!ll) { return c; } return nz === 3 ? c : null;
      case 'f2l': return ll ? null : c;
      case 'cross': return (h[1] === -1 && nz === 2) ? c : null;
      default: return c;
    }
  }

  function stickerFill(cb, i, stage, scheme) {
    var c = cb.sc[i];
    if (!c) { return BLACK; }
    var m = maskLetter(cb, c, stage);
    return m ? scheme[m] : GREY;
  }

  function makeOrient(str) {
    var seq = parseAlg(str || '');
    return function (v) { return rotateVecBy(v, seq); };
  }

  /* ------------------------------------------------------------------ */
  /* SVG helpers                                                         */
  /* ------------------------------------------------------------------ */
  function el(name, attrs, parent) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) { for (var k in attrs) { if (attrs.hasOwnProperty(k)) { e.setAttribute(k, attrs[k]); } } }
    if (parent) { parent.appendChild(e); }
    return e;
  }

  /* ------------------------------------------------------------------ */
  /* Flat (OLL-diagram style) renderer                                   */
  /* ------------------------------------------------------------------ */
  function Flat(svg, cfg) {
    this.cfg = cfg;
    var S = 38, G = 2, T = 11, RG = 3, M = 4;
    var x0 = M + T + RG, y0 = M + T + RG, span = 3 * S + 2 * G;
    var total = span + 2 * (T + RG + M);
    svg.setAttribute('viewBox', '0 0 ' + total + ' ' + total);
    this.cells = [];
    var i, j, r;
    var attrs = function (x, y, w, h) {
      return { x: x, y: y, width: w, height: h, rx: 3, ry: 3, fill: GREY, stroke: BLACK, 'stroke-width': 1.6 };
    };
    // main face: x=-1..1 (i), z=-1..1 (j)
    for (j = 0; j < 3; j++) {
      for (i = 0; i < 3; i++) {
        r = el('rect', attrs(x0 + i * (S + G), y0 + j * (S + G), S, S), svg);
        this.cells.push({ r: r, key: [i - 1, 1, j - 1, 0, 1, 0].join(',') });
      }
    }
    for (i = 0; i < 3; i++) {
      r = el('rect', attrs(x0 + i * (S + G), y0 + span + RG, S, T), svg);        // front ring
      this.cells.push({ r: r, key: [i - 1, 1, 1, 0, 0, 1].join(',') });
      r = el('rect', attrs(x0 + i * (S + G), y0 - RG - T, S, T), svg);            // back ring
      this.cells.push({ r: r, key: [i - 1, 1, -1, 0, 0, -1].join(',') });
      r = el('rect', attrs(x0 + span + RG, y0 + i * (S + G), T, S), svg);         // right ring
      this.cells.push({ r: r, key: [1, 1, i - 1, 1, 0, 0].join(',') });
      r = el('rect', attrs(x0 - RG - T, y0 + i * (S + G), T, S), svg);            // left ring
      this.cells.push({ r: r, key: [-1, 1, i - 1, -1, 0, 0].join(',') });
    }
  }

  Flat.prototype.update = function (state) {
    var cfg = this.cfg, map = {}, i, j;
    for (i = 0; i < state.cubies.length; i++) {
      var cb = state.cubies[i], dp = cfg.orient(cb.p);
      for (j = 0; j < 6; j++) {
        if (!cb.sc[j]) { continue; }
        var dn = cfg.orient(stickerNormal(cb, j));
        map[[dp[0] + 0, dp[1] + 0, dp[2] + 0, dn[0] + 0, dn[1] + 0, dn[2] + 0].join(',')] = stickerFill(cb, j, cfg.stage, cfg.scheme);
      }
    }
    for (i = 0; i < this.cells.length; i++) {
      var c = this.cells[i];
      c.r.setAttribute('fill', map[c.key] || GREY);
    }
  };

  /* ------------------------------------------------------------------ */
  /* 3D (orthographic, painter's algorithm) renderer                     */
  /* ------------------------------------------------------------------ */
  var CAMS = { above: { th: -35, ph: 30 }, below: { th: -35, ph: -30 } };

  function Scene3D(svg, cfg) {
    this.cfg = cfg;
    this.S = 46;
    svg.setAttribute('viewBox', '-150 -150 300 300');
    this.g = el('g', null, svg);
    var cam = CAMS[cfg.cam] || CAMS.above;
    this.th = cam.th * Math.PI / 180;
    this.ph = cam.ph * Math.PI / 180;
    this.faces = [];
    this.built = false;
  }

  Scene3D.prototype.build = function (state) {
    for (var i = 0; i < state.cubies.length; i++) {
      for (var f = 0; f < 6; f++) {
        var poly = el('polygon', {
          fill: stickerFill(state.cubies[i], f, this.cfg.stage, this.cfg.scheme),
          stroke: BLACK, 'stroke-width': 2.4, 'stroke-linejoin': 'round', display: 'none'
        }, this.g);
        this.faces.push({ ci: i, f: f, a: f >> 1, sg: (f & 1) ? -1 : 1, poly: poly });
      }
    }
    this.built = true;
  };

  Scene3D.prototype.proj = function (v) {
    var w = rotF(rotF(this.cfg.orient(v), 1, this.th), 0, this.ph);
    return w;
  };

  Scene3D.prototype.draw = function (state, anim) {
    if (!this.built) { this.build(state); }
    var vis = [], i, n, rec;
    for (i = 0; i < this.faces.length; i++) {
      rec = this.faces[i];
      var cb = state.cubies[rec.ci], a = rec.a, b = (a + 1) % 3, c = (a + 2) % 3, h = 0.5;
      var ma = cb.m[a], mb = cb.m[b], mc = cb.m[c], sg = rec.sg;
      var ctr = [cb.p[0] + 0.5 * sg * ma[0], cb.p[1] + 0.5 * sg * ma[1], cb.p[2] + 0.5 * sg * ma[2]];
      var nrm = [sg * ma[0], sg * ma[1], sg * ma[2]];
      var pts = [], sx = [-1, 1, 1, -1], sy = [-1, -1, 1, 1];
      for (n = 0; n < 4; n++) {
        pts.push([ctr[0] + sx[n] * h * mb[0] + sy[n] * h * mc[0],
                  ctr[1] + sx[n] * h * mb[1] + sy[n] * h * mc[1],
                  ctr[2] + sx[n] * h * mb[2] + sy[n] * h * mc[2]]);
      }
      if (anim && inLayer(cb, anim.mv)) {
        ctr = rotF(ctr, anim.mv.a, anim.theta);
        nrm = rotF(nrm, anim.mv.a, anim.theta);
        for (n = 0; n < 4; n++) { pts[n] = rotF(pts[n], anim.mv.a, anim.theta); }
      }
      var nz = this.proj(nrm), cz = this.proj(ctr);
      // proj() rotates a direction the same as a point (rotation only), so nz[2] is the facing test.
      if (nz[2] > 0.02) { vis.push({ rec: rec, pts: pts, z: cz[2] }); }
      else { rec.poly.setAttribute('display', 'none'); }
    }
    vis.sort(function (p, q) { return p.z - q.z; });
    for (i = 0; i < vis.length; i++) {
      var v = vis[i], s = [];
      for (n = 0; n < 4; n++) {
        var q = this.proj(v.pts[n]);
        s.push((q[0] * this.S).toFixed(1) + ',' + (-q[1] * this.S).toFixed(1));
      }
      v.rec.poly.setAttribute('points', s.join(' '));
      v.rec.poly.removeAttribute('display');
      this.g.appendChild(v.rec.poly);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Config + styles                                                     */
  /* ------------------------------------------------------------------ */
  var CSS = [
    '.cubeviz{display:block;text-align:center;margin:6px auto;max-width:560px;font-family:inherit}',
    '.cv-views{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px}',
    '.cv-views svg{width:210px;max-width:44vw;height:auto;display:block;overflow:visible}',
    '.cv-views svg.cv-solo{width:240px;max-width:70vw}',
    '.cv-controls{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px;margin:8px 0 4px}',
    '.cv-btn{font:inherit;font-size:18px;line-height:1;min-width:40px;padding:8px 10px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit;opacity:.85;cursor:pointer;-webkit-appearance:none}',
    '.cv-btn:active{opacity:.4}',
    '.cv-speed{font:inherit;font-size:15px;padding:6px 4px;border:1px solid currentColor;border-radius:8px;background:transparent;color:inherit}',
    '.cv-algtext{font-family:Menlo,Consolas,"DejaVu Sans Mono",monospace;font-size:22px;line-height:1.7;margin-top:4px}',
    '.cv-m{display:inline-block;padding:0 4px;margin:0 1px;border-radius:5px;cursor:pointer}',
    '.cv-cur{background:rgba(255,190,0,.45)}',
    '.cv-err{color:#c33;font-size:14px;padding:8px}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('cv-style')) { return; }
    var st = document.createElement('style');
    st.id = 'cv-style';
    st.appendChild(document.createTextNode(CSS));
    (document.head || document.documentElement).appendChild(st);
  }

  function opt(elm, name, def) {
    var v = elm.getAttribute('data-' + name);
    if (v !== null && String(v).replace(/\s+/g, '') !== '') { return String(v).replace(/^\s+|\s+$/g, ''); }
    var d = root.CUBEVIZ_DEFAULTS;
    if (d && d[name] !== undefined && d[name] !== null && String(d[name]) !== '') { return String(d[name]); }
    return def;
  }

  function truthy(s) { return !(s === '0' || s === 'false' || s === 'no' || s === '' || s === undefined); }

  function textOf(node) { return node ? (node.textContent || '') : ''; }

  var raf = root.requestAnimationFrame ? function (f) { root.requestAnimationFrame(f); } : function (f) { setTimeout(f, 16); };

  /* ------------------------------------------------------------------ */
  /* Player                                                              */
  /* ------------------------------------------------------------------ */
  function Player(host) {
    var self = this, D = root.CUBEVIZ_DEFAULTS || {};
    GREY = D.grey || '#8a8a8a';        // greyed-out pieces
    BLACK = D.body || '#161616';       // cube body / gaps
    this.moveMs = parseFloat(D.move_ms) || 420;
    this.host = host;
    this.speed = parseFloat(opt(host, 'speed', '1')) || 1;
    this.animate = truthy(opt(host, 'animate', '0'));
    this.loop = truthy(opt(host, 'loop', '0'));
    this.autoplay = truthy(opt(host, 'autoplay', '0'));
    this.showAlg = truthy(opt(host, 'showalg', '0')) || this.animate;
    var stage = opt(host, 'stage', 'full').toLowerCase();
    var view = opt(host, 'view', 'top').toLowerCase();
    var show = (host.getAttribute('data-show') || '').toLowerCase();
    if (show && (view === 'top' || view === 'bottom' || view === 'flip')) {
      var sfx = view === 'top' ? '' : '-' + view;
      if (show === 'flat') { view = view === 'top' ? 'top' : 'bottom'; }
      else if (show === '3d') { view = '3d' + sfx; }
      else if (show === 'both') { view = 'both' + sfx; }
    }
    var scheme = makeScheme(opt(host, 'cross', 'white').toLowerCase(), opt(host, 'front', '').toLowerCase(), root.CUBEVIZ_COLORS);
    var extra = opt(host, 'orient', '');

    this.algMoves = parseAlg(textOf(host.querySelector('.cv-alg')));
    var scrTxt = textOf(host.querySelector('.cv-scr'));
    var scrMoves = /\S/.test(scrTxt) ? parseAlg(scrTxt) : null;
    this.hasScramble = !!scrMoves;
    this.start = caseState(this.algMoves, scrMoves);
    this.state = cloneState(this.start);
    this.idx = 0; this.playing = false; this.busy = false; this.token = 0;

    var wantFlat = view === 'top' || view === 'bottom' || view.indexOf('both') === 0 || view === 'flat';
    var want3d = view.indexOf('3d') === 0 || view.indexOf('both') === 0;
    var flipped = view.indexOf('bottom') >= 0 || view.indexOf('flip') >= 0;
    var cam3 = view.indexOf('bottom') >= 0 ? 'below' : 'above';
    var flatOrient = makeOrient(extra + (flipped ? ' x2' : ''));
    var o3 = makeOrient(extra + (view.indexOf('flip') >= 0 ? ' x2' : ''));

    host.innerHTML = '';
    var frame = document.createElement('div');
    frame.className = 'cv-views';
    host.appendChild(frame);
    var solo = wantFlat !== want3d;
    if (wantFlat) {
      var s1 = el('svg', { 'class': 'cv-flat' + (solo ? ' cv-solo' : '') }); frame.appendChild(s1);
      this.flat = new Flat(s1, { stage: stage, scheme: scheme, orient: flatOrient });
    }
    if (want3d) {
      var s2 = el('svg', { 'class': 'cv-3d' + (solo ? ' cv-solo' : '') }); frame.appendChild(s2);
      this.scene = new Scene3D(s2, { stage: stage, scheme: scheme, orient: o3, cam: cam3 });
    }
    if (!this.flat && !this.scene) { throw new Error('Unknown view "' + view + '"'); }

    if (this.animate) { this.buildControls(); }
    if (this.showAlg && this.algMoves.length) { this.buildAlgText(); }
    this.render();
    if (this.animate && this.autoplay && this.algMoves.length) {
      setTimeout(function () { if (self.alive()) { self.play(); } }, 700);
    }
  }

  Player.prototype.alive = function () {
    var d = this.host.ownerDocument;
    return !!(d && d.body && d.body.contains(this.host));
  };

  Player.prototype.render = function () {
    if (this.flat) { this.flat.update(this.state); }
    if (this.scene) { this.scene.draw(this.state, null); }
    this.highlight();
  };

  Player.prototype.highlight = function () {
    if (!this.spans) { return; }
    for (var i = 0; i < this.spans.length; i++) {
      this.spans[i].className = 'cv-m' + (i === this.idx - 1 ? ' cv-cur' : '');
    }
    if (this.playBtn) { this.playBtn.textContent = this.playing ? '||' : '\u25B6'; }
  };

  Player.prototype.buildAlgText = function () {
    var self = this, box = document.createElement('div');
    box.className = 'cv-algtext';
    this.spans = [];
    this.algMoves.forEach(function (mv, i) {
      var sp = document.createElement('span');
      sp.className = 'cv-m';
      sp.textContent = mv.name;
      sp.onclick = function () { self.seek(i + 1); };
      box.appendChild(sp);
      box.appendChild(document.createTextNode(' '));
      self.spans.push(sp);
    });
    this.host.appendChild(box);
  };

  Player.prototype.buildControls = function () {
    var self = this, bar = document.createElement('div');
    bar.className = 'cv-controls';
    function btn(label, title, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'cv-btn'; b.textContent = label; b.title = title;
      b.onclick = function (e) { if (e && e.preventDefault) { e.preventDefault(); } fn(); };
      bar.appendChild(b);
      return b;
    }
    btn('\u00AB', 'Restart', function () { self.pause(); self.seek(0); });
    btn('\u2039', 'Step back', function () { self.stepBack(); });
    this.playBtn = btn('\u25B6', 'Play / pause', function () { if (self.playing) { self.pause(); } else { self.play(); } });
    btn('\u203A', 'Step forward', function () { self.stepFwd(); });
    btn('\u00BB', 'Jump to end', function () { self.pause(); self.seek(self.algMoves.length); });
    var sel = document.createElement('select');
    sel.className = 'cv-speed'; sel.title = 'Speed';
    var speeds = [0.5, 1, 1.5, 2, 3];
    for (var i = 0; i < speeds.length; i++) {
      var o = document.createElement('option');
      o.value = String(speeds[i]); o.textContent = speeds[i] + 'x';
      if (speeds[i] === this.speed) { o.selected = true; }
      sel.appendChild(o);
    }
    sel.onchange = function () { self.speed = parseFloat(sel.value) || 1; };
    bar.appendChild(sel);
    this.host.appendChild(bar);
  };

  Player.prototype.seek = function (n) {
    this.token++; this.busy = false; this.playing = false;
    this.state = cloneState(this.start);
    for (var i = 0; i < n && i < this.algMoves.length; i++) { applyMove(this.state, this.algMoves[i]); }
    this.idx = Math.min(n, this.algMoves.length);
    this.render();
  };

  Player.prototype.pause = function () { this.playing = false; this.highlight(); };

  Player.prototype.animateMove = function (mv, done) {
    var self = this, t0 = Date.now(), tok = this.token;
    var dur = this.moveMs * (Math.abs(mv.k) === 2 ? 1.5 : 1) / this.speed;
    function fin() {
      if (tok !== self.token) { return; }
      applyMove(self.state, mv);
      done();
    }
    if (!this.scene) { setTimeout(fin, dur * 0.5); return; }
    function frame() {
      if (tok !== self.token || !self.alive()) { return; }
      var t = (Date.now() - t0) / dur;
      if (t >= 1) { fin(); return; }
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      self.scene.draw(self.state, { mv: mv, theta: mv.k * Math.PI / 2 * e });
      raf(frame);
    }
    frame();
  };

  Player.prototype.play = function () {
    if (!this.algMoves.length) { return; }
    if (this.idx >= this.algMoves.length) { this.seek(0); }
    if (this.playing) { return; }
    this.playing = true; this.highlight();
    this.next();
  };

  Player.prototype.next = function () {
    var self = this;
    if (!this.playing || this.busy) { return; }
    if (this.idx >= this.algMoves.length) {
      this.playing = false; this.highlight();
      if (this.loop) {
        var tok = this.token;
        setTimeout(function () { if (self.alive() && tok === self.token) { self.seek(0); self.play(); } }, 1300);
      }
      return;
    }
    this.stepFwd(true);
  };

  Player.prototype.stepFwd = function (chain) {
    var self = this;
    if (this.busy || this.idx >= this.algMoves.length) { return; }
    if (!chain) { this.playing = false; }
    this.busy = true;
    var tok = this.token;
    this.animateMove(this.algMoves[this.idx], function () {
      if (tok !== self.token) { return; }
      self.idx++; self.busy = false; self.render();
      if (self.playing) { setTimeout(function () { if (tok === self.token) { self.next(); } }, 70); }
    });
  };

  Player.prototype.stepBack = function () {
    var self = this;
    if (this.busy || this.idx <= 0) { return; }
    this.playing = false; this.busy = true;
    var tok = this.token;
    this.animateMove(invertMove(this.algMoves[this.idx - 1]), function () {
      if (tok !== self.token) { return; }
      self.idx--; self.busy = false; self.render();
    });
  };

  /* ------------------------------------------------------------------ */
  /* Public API                                                          */
  /* ------------------------------------------------------------------ */
  function mount(host) {
    if (host.getAttribute('data-cv-done')) { return null; }
    host.setAttribute('data-cv-done', '1');
    injectStyle();
    try { var pl = new Player(host); host.cvPlayer = pl; return pl; }
    catch (e) {
      var d = document.createElement('div');
      d.className = 'cv-err';
      d.textContent = 'Cube viewer: ' + (e && e.message ? e.message : e);
      host.innerHTML = '';
      host.appendChild(d);
      return null;
    }
  }

  function mountAll(scope) {
    var list = (scope || document).querySelectorAll('.cubeviz'), out = [];
    for (var i = 0; i < list.length; i++) { var p = mount(list[i]); if (p) { out.push(p); } }
    return out;
  }

  var API = {
    version: VERSION, mount: mount, mountAll: mountAll,
    parseAlg: parseAlg, invertAlg: invertAlg, algToString: algToString, parseMove: parseMove,
    solved: solved, cloneState: cloneState, applyMove: applyMove, applyMoves: applyMoves,
    caseState: caseState, centreRotation: centreRotation, isSolvedUpToRotation: isSolvedUpToRotation,
    stickerNormal: stickerNormal, letterOf: letterOf, makeScheme: makeScheme, maskLetter: maskLetter,
    LETTERS: LETTERS, NORMALS: NORMALS, COLORS: COLORS
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }
  root.CubeViz = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
