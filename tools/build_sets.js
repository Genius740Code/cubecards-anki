// Builds cubetrainer/algsets.json from tools/cfop_algs.txt (first algorithm per case) + the 2-look sets.
// Run from the repo root:  node tools/build_sets.js
const fs = require('fs');
const CV = require('../cubetrainer/cubeviz.js');

const nz = c => c.home.filter(v => v !== 0).length;
const isId = m => m[0].join() === '1,0,0' && m[1].join() === '0,1,0' && m[2].join() === '0,0,1';
const AUF = ['', ' U', ' U2', " U'"];
const AUF_TXT = ['', 'U', 'U2', "U'"];

function llMisplaced(st, cornersOnly) {
  return st.cubies.filter(c => c.home[1] === 1 && nz(c) >= (cornersOnly ? 3 : 2) && c.p.join() !== c.home.join()).length;
}
// Choose the U-turn (0..3) to add after the alg so the generated picture is in its most "standard" alignment.
function alignment(alg, cornersOnly) {
  let best = null;
  for (let k = 0; k < 4; k++) {
    const mv = CV.parseAlg(alg + AUF[k]);
    const m = llMisplaced(CV.caseState(mv, null), cornersOnly);
    if (best === null || m < best.m) best = { k, m, mv };
  }
  return best;
}
function scrambleFor(mv) {
  return CV.algToString(CV.centreRotation(mv).concat(CV.invertAlg(mv)));
}
function f2lInfo(alg) {
  const st = CV.caseState(CV.parseAlg(alg), null);
  const bad = st.cubies.filter(c => c.home[1] < 1 && nz(c) >= 2 && !(c.p.join() === c.home.join() && isId(c.m)));
  // Valid single-pair F2L case: cross intact, and every displaced F2L piece belongs to the same slot
  // (both pieces for pairs in the U layer; just one piece for "corner in slot" / "edge in slot" cases).
  const crossBroken = bad.filter(c => nz(c) === 2 && c.home[1] === -1).length;
  const sameSlot = bad.length > 0 && bad.length <= 2 && bad.every(c => c.home[0] === bad[0].home[0] && c.home[2] === bad[0].home[2]);
  if (crossBroken || !sameSlot) return { ok: false, bad: bad.map(c => c.home.join()) };
  const slot = [bad[0].home[0], -1, bad[0].home[2]];
  for (const rot of ['', 'y', 'y2', "y'"]) {
    const s = CV.solved(); CV.applyMoves(s, CV.parseAlg(rot));
    const cb = s.cubies.find(c => c.home.join() === slot.join());
    if (cb.p.join() === '1,-1,1') return { ok: true, orient: rot };
  }
  return { ok: false, bad: ['no orient'] };
}

const rows = fs.readFileSync('tools/cfop_algs.txt', 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('|'));
const META = {
  f2l: { name: 'F2L (41 cases)', deck: 'F2L', stage: 'f2l', set: 'F2L' },
  oll: { name: 'OLL (57 cases)', deck: 'OLL', stage: 'oll', set: 'OLL' },
  pll: { name: 'PLL (21 cases)', deck: 'PLL', stage: 'pll', set: 'PLL' },
  coll: { name: 'COLL (40 cases)', deck: 'COLL', stage: 'coll', set: 'COLL' },
};
const sets = [];
const problems = [];
for (const id of ['f2l', 'oll', 'pll', 'coll']) {
  const algs = [];
  for (const [sid, group, name, alg] of rows) {
    if (sid !== id) continue;
    const entry = { name, alg, group, notes: 'Group: ' + group };
    if (id === 'pll' || id === 'coll') {
      const a = alignment(alg, id === 'coll');
      if (a.k > 0) {
        entry.scramble = scrambleFor(a.mv);
        entry.notes += '<br>After the alg, finish with ' + AUF_TXT[a.k] + '.';
      }
    }
    if (id === 'f2l') {
      const info = f2lInfo(alg);
      if (!info.ok) problems.push(name + ' ' + alg + ' -> ' + info.bad.join(' '));
      else { entry.view = '3d'; if (info.orient) entry.orient = info.orient; }
    }
    algs.push(entry);
  }
  sets.push(Object.assign({ id }, META[id], { algs }));
}
// 2-look sets (these algorithms are this project's own, standard 2-look choices)
const eo = [['Dot (no edges)', "F R U R' U' F' f R U R' U' f'"], ['Line (bar)', "F R U R' U' F'"], ['L-shape (angle)', "f R U R' U' f'"]];
const co = [['Sune', "R U R' U R U2 R'"], ['Anti-Sune', "R U2 R' U' R U' R'"], ['H', "F R U R' U' R U R' U' R U R' U' F'"], ['Pi', "R U2 R2 U' R2 U' R2 U2 R"], ['U', "R2 D R' U2 R D' R' U2 R'"], ['T', "r U R' U' r' F R F'"], ['L', "F R' F' r U R U' r'"]];
sets.push({ id: '2look-eo', name: '2-Look OLL: Edges', deck: '2-Look OLL', stage: 'oll', set: '2-Look OLL', algs: eo.map(([name, alg]) => ({ name, alg })) });
sets.push({ id: '2look-co', name: '2-Look OLL: Corners', deck: '2-Look OLL', stage: 'oll', set: '2-Look OLL', algs: co.map(([name, alg]) => ({ name, alg })) });
fs.writeFileSync('cubetrainer/algsets.json', JSON.stringify({ version: 2, sets }, null, 1));
console.log(sets.map(s => s.id + ':' + s.algs.length).join('  '));
if (problems.length) { console.log('F2L PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('F2L pair check passed for all cases');
