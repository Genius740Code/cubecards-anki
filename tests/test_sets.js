// Verifies every bundled algorithm against the independent cube engine.
const CV = require('../cubetrainer/cubeviz.js');
const sets = require('../cubetrainer/algsets.json').sets;
let bad = 0; const fail = m => { bad++; console.log('FAIL:', m); };
const nz = c => c.home.filter(v => v !== 0).length;
const isId = m => m[0].join() === '1,0,0' && m[1].join() === '0,1,0' && m[2].join() === '0,0,1';
const up = c => { for (let i = 0; i < 6; i++) if (c.sc[i] === 'U') return CV.stickerNormal(c, i).join(); return null; };
const f2lIntact = st => st.cubies.filter(c => c.home[1] < 1).every(c => c.p.join() === c.home.join() && (nz(c) === 1 || isId(c.m)));
const ll = (st, n) => st.cubies.filter(c => c.home[1] === 1 && nz(c) === n);
const oriented = c => up(c).split(',')[1] === '1';
const AUF = ['', ' U', ' U2', " U'"];
// after performing an alg that contains cube rotations the whole cube is re-oriented; undo that before comparing positions
const unrotate = (e, alg) => { CV.applyMoves(e, CV.invertAlg(CV.centreRotation(CV.parseAlg(alg)))); return e; };
const stateOf = a => CV.caseState(CV.parseAlg(a.alg), a.scramble ? CV.parseAlg(a.scramble) : null);
const EXPECT = { f2l: { 'Free Pairs': 4, 'Disconnected Pairs': 10, 'Connected Pairs': 10, 'Corner In Slot': 6, 'Edge In Slot': 6, 'Pieces In Slot': 5 },
  oll: { 'Dot Case': 8, 'Square Shapes': 2, 'Lightning Shapes': 6, 'Fish Shapes': 4, 'Knight Move Shapes': 4, 'OCLL': 7, 'All Corners Oriented': 2, 'Awkward Shapes': 4, 'P Shapes': 4, 'T Shapes': 2, 'C Shapes': 2, 'W Shapes': 2, 'L Shapes': 6, 'Line Shapes': 4 },
  pll: { 'Adjacent Swap': 12, 'Opposite Swap': 5, 'EPLL': 4 },
  coll: { 'Sune': 6, 'Anti-Sune': 6, 'H': 4, 'L': 6, 'Pi': 6, 'T': 6, 'U': 6 } };
function ollPattern(st) {   // U-sticker-up booleans of every LL slot, canonical over y rotations
  let best = null;
  for (let r = 0; r < 4; r++) {
    const s = CV.cloneState(st); CV.applyMoves(s, CV.parseAlg(Array(r).fill('y').join(' ')));
    const parts = [];
    for (const c of s.cubies) for (let i = 0; i < 6; i++) if (c.sc[i] && c.p[1] === 1) parts.push(c.p.join() + '|' + CV.stickerNormal(c, i).join() + (c.sc[i] === 'U' ? '1' : '0'));
    const key = parts.sort().join(';'); if (best === null || key < best) best = key;
  }
  return best;
}
const misplaced = (st, cornersOnly) => st.cubies.filter(c => c.home[1] === 1 && nz(c) >= (cornersOnly ? 3 : 2) && c.p.join() !== c.home.join()).length;
const seen = {};
for (const set of sets) {
  const counts = {};
  for (const a of set.algs) {
    const L = set.id + ' / ' + a.name + ' (' + a.alg + ')';
    counts[a.group || ''] = (counts[a.group || ''] || 0) + 1;
    let st; try { st = stateOf(a); } catch (e) { fail(L + ' ' + e.message); continue; }
    if (set.stage === 'f2l') {
      const bad2 = st.cubies.filter(c => c.home[1] < 1 && nz(c) >= 2 && !(c.p.join() === c.home.join() && isId(c.m)));
      if (!bad2.length || bad2.length > 2 || !bad2.every(c => c.home[0] === bad2[0].home[0] && c.home[2] === bad2[0].home[2]) || bad2.some(c => nz(c) === 2 && c.home[1] === -1)) fail(L + ' is not a single-slot F2L case');
      if (a.view !== '3d') fail(L + ' F2L cards must use the 3D view');
      continue;
    }
    if (!f2lIntact(st)) fail(L + ' F2L disturbed in case state');
    if (set.stage === 'oll') {
      const allO = ll(st, 2).concat(ll(st, 3)).every(oriented);
      if (allO) fail(L + ' case already oriented');
      if (set.id === 'oll') { const k = ollPattern(st); if (seen[k]) fail(L + ' duplicate OLL pattern of ' + seen[k]); seen[k] = a.name; }
    }
    if (set.stage === 'pll') {
      if (!ll(st, 2).concat(ll(st, 3)).every(oriented)) fail(L + ' PLL case has misoriented pieces');
      let min = 99; for (let k = 0; k < 4; k++) min = Math.min(min, misplaced(CV.caseState(CV.parseAlg(a.alg + AUF[k]), null), false));
      if (misplaced(st, false) !== min) fail(L + ' picture is not in standard alignment');
    }
    if (set.stage === 'coll') {
      if (!ll(st, 2).every(oriented)) fail(L + ' COLL case must have oriented edges');
      let ok = false;
      for (let k = 0; k < 4 && !ok; k++) {
        const e = CV.cloneState(st); CV.applyMoves(e, CV.parseAlg(a.alg + AUF[k])); unrotate(e, a.alg + AUF[k]);
        ok = ll(e, 3).every(c => c.p.join() === c.home.join() && up(c) === '0,1,0') && ll(e, 2).every(oriented) && f2lIntact(e);
      }
      if (!ok) fail(L + ' alg does not solve the corners (up to AUF) with edges oriented');
      const sig = ll(st, 3).map(c => c.p.join() + '<' + c.home.join() + ':' + up(c)).sort().join('|');
      if (seen['coll' + sig]) fail(L + ' same corner picture as ' + seen['coll' + sig]); seen['coll' + sig] = a.name;
    }
    if (a.scramble) {   // picture must be consistent with the alg: alg + AUF solves it exactly
      let ok = false;
      for (let k = 1; k < 4 && !ok; k++) { const e = CV.cloneState(st); CV.applyMoves(e, CV.parseAlg(a.alg + AUF[k])); unrotate(e, a.alg + AUF[k]); ok = CV.isSolvedUpToRotation(e) && e.cubies.filter(c => c.home[1] < 1 || c.home[1] === 1).every(c => c.p.join() === c.home.join()); }
      if (!ok) fail(L + ' scramble inconsistent with alg');
    }
  }
  if (EXPECT[set.id]) { for (const g in EXPECT[set.id]) if (counts[g] !== EXPECT[set.id][g]) fail(set.id + ' group "' + g + '" has ' + counts[g] + ', expected ' + EXPECT[set.id][g]);
    for (const g in counts) if (!(g in EXPECT[set.id])) fail(set.id + ' unexpected group ' + g); }
}
// PLL cases must be 21 distinct permutations (up to AUF before/after and cube rotation)
{
  const key = st => st.cubies.filter(c => c.home[1] === 1 && nz(c) > 1).map(c => c.home.join() + '>' + c.p.join()).sort().join('|');
  const pk = {}; 
  for (const a of sets.find(s => s.id === 'pll').algs) {
    let best = null;
    for (const pre of AUF) for (const post of AUF) for (const [r, ri] of [['', ''], ['y', "y'"], ['y2', 'y2'], ["y'", 'y']]) {
      const k = key(CV.caseState(CV.parseAlg([r, pre, a.alg, post, ri].join(' ')), null)); if (best === null || k < best) best = k; }
    if (pk[best]) fail('PLL ' + a.name + ' is the same case as ' + pk[best]); pk[best] = a.name;
  }
}
const total = sets.reduce((n, s) => n + s.algs.length, 0);
console.log(bad ? bad + ' problem(s)' : 'all ' + total + ' bundled algorithms verified (' + sets.map(s => s.id + ':' + s.algs.length).join(', ') + ')');
process.exit(bad ? 1 : 0);
