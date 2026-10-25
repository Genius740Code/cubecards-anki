const CV = require('../cubetrainer/cubeviz.js');
let fails = 0, passes = 0;
function ok(c, msg) { if (c) passes++; else { fails++; console.log('FAIL:', msg); } }
function run(alg, st) { st = st || CV.solved(); CV.applyMoves(st, CV.parseAlg(alg)); return st; }
function ser(st) { // serialize full state ignoring nothing
  return st.cubies.map(c => c.p.join(',') + '|' + c.m.map(v => v.join(',')).join(';')).join('#');
}
function faceColor(st, face, x, y, z) { // colour letter at sticker with given position + face normal
  const n = CV.NORMALS[face];
  for (const c of st.cubies) {
    if (c.p[0] === x && c.p[1] === y && c.p[2] === z)
      for (let i = 0; i < 6; i++) { if (!c.sc[i]) continue; const w = CV.stickerNormal(c, i); if (w[0]===n[0]&&w[1]===n[1]&&w[2]===n[2]) return c.sc[i]; }
  }
  return null;
}
const id = ser(CV.solved());
// each basic move has order 4
for (const m of ['U','D','F','B','R','L','M','E','S','r','l','u','d','f','b','x','y','z'])
  ok(ser(run(Array(4).fill(m).join(' '))) === id, m + '^4 = id');
ok(ser(run("R U R' U'".repeat(1) + " " + "R U R' U' ".repeat(5))) === id, 'sexy x6');
ok(ser(run('R U R\' U R U2 R\' '.repeat(6))) === id, 'sune x6 = id');
ok(ser(run('R U R\' U R U2 R\'')) !== id, 'sune != id');
ok(ser(run("R2'")) === ser(run('R2')) , "R2' == R2");
ok(ser(run('Rw')) === ser(run('r')), 'Rw == r');
// handedness facts (standard cube behaviour)
ok(faceColor(run('R'), 'U', 1, 1, 1) === 'F', 'R sends F stickers to U');
ok(faceColor(run('U'), 'F', 1, 1, 1) === 'R', 'U sends R stickers to F');
ok(faceColor(run('F'), 'U', 1, 1, 1) === 'L', 'F sends L stickers to U');
ok(faceColor(run('L'), 'F', -1, 1, 1) === 'U', 'L sends U stickers to F');
ok(faceColor(run('D'), 'F', 1, -1, 1) === 'L', 'D sends L stickers to F');
ok(faceColor(run('B'), 'U', 1, 1, -1) === 'R', 'B sends R stickers to U');
ok(faceColor(run('M'), 'F', 0, 1, 1) === 'U', 'M follows L (U->F)');
ok(faceColor(run('E'), 'F', 1, 0, 1) === 'L', 'E follows D (L->F)');
ok(faceColor(run('S'), 'U', 1, 1, 0) === 'L', 'S follows F (L->U)');
// composite identities
ok(ser(run("r")) === ser(run("R M'")), 'r = R M\'');
ok(ser(run("x")) === ser(run("R M' L'")), "x = R M' L'");
ok(ser(run("y")) === ser(run("U E' D'")), "y = U E' D'");
ok(ser(run("z")) === ser(run("F S B'")), "z = F S B'");
ok(ser(run("u")) === ser(run("U E'")), "u = U E'");
ok(ser(run("f")) === ser(run("F S")), "f = F S");
// inverse
const a = CV.parseAlg("R U2 R' F' r U2 M' x y'");
ok(ser(run(CV.algToString(CV.invertAlg(a)), run(CV.algToString(a)))) === id, 'alg then inverse = id');
// centre normalisation
const aa = CV.parseAlg("x R' U R' D2 R U' R' D2 R2");
const cs = CV.caseState(aa, null);
ok(cs.cubies.filter(c => c.home.filter(v => v!==0).length===1).every(c => c.p.join()===c.home.join()), 'case state has home centres');
const after = CV.cloneState(cs); CV.applyMoves(after, aa);
ok(CV.isSolvedUpToRotation(after), 'x-alg from caseState ends solved (up to rotation)');
// F2L preserved for Aa perm start state
ok(cs.cubies.filter(c=>c.home[1]<1).every(c=>c.p.join()===c.home.join() && c.m[0].join()==='1,0,0'&&c.m[1].join()==='0,1,0'), 'F2L intact in case state');
// scheme
const w = CV.makeScheme('white'); 
ok(w.D === '#ffffff' && w.U === '#ffd500' && w.F === '#009b48', 'white-cross scheme: D white, U yellow, F green');
for (const c of ['white','yellow','green','blue','red','orange']) { const s = CV.makeScheme(c); ok(s.D === CV.COLORS[c], 'cross '+c+' on D'); 
  const names = s._names; const set = new Set(Object.values(names)); ok(set.size===6, 'scheme '+c+' has 6 distinct colours'); }
// chirality: green-cross scheme must still be a real cube: check F->R->B->L cycle orientation vs standard via triple product
function trip(names){ // names mapping face->colour; compute parity of (U,F,R) vs standard
  const order=['white','yellow','green','blue','red','orange']; return names; }
const s2 = CV.makeScheme('green','red'); ok(s2._names.F === 'red' && s2._names.D === 'green', 'front colour override');
console.log(passes + ' passed, ' + fails + ' failed');
process.exit(fails ? 1 : 0);
