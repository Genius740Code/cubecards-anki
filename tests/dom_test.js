const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const dir = process.argv[2];
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
const svgOut = '/tmp/svgs'; fs.mkdirSync(svgOut, { recursive: true });
let fails = 0, checked = 0, played = 0;
function fail(msg) { fails++; console.log('FAIL:', msg); }
// COLL leaves edges permuted, and cards with an explicit scramble (AUF alignment) need a final U turn: covered by test_sets.js
const needsSolved = host => host.getAttribute('data-stage') !== 'coll' && !host.cvPlayer.hasScramble;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function load(html) {
  const errs = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message || e))); vc.on('error', e => errs.push(String(e)));
  const dom = new JSDOM('<!doctype html><html><body class="card">' + html + '</body></html>', { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
  return { dom, errs };
}
function dump(name, svg) {
  if (!svg) return;
  let s = svg.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" ');
  fs.writeFileSync(path.join(svgOut, name + '.svg'), s);
}
(async () => {
  let sample = 0;
  for (const f of files) {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, f.replace(/_[qa]\.html$/, '.json'))));
    const isQ = /_q\.html$/.test(f), ord = meta.ord;
    const { dom, errs } = load(fs.readFileSync(path.join(dir, f), 'utf8'));
    const w = dom.window, d = w.document;
    checked++;
    if (errs.length) { fail(f + ' script errors: ' + errs.slice(0, 2).join(' | ')); continue; }
    if (isQ && ord === 1) { if (d.querySelector('.cubeviz')) fail(f + ' reverse front should not contain a cube'); continue; }
    const host = d.querySelector('.cubeviz');
    if (!host) { fail(f + ' no .cubeviz'); continue; }
    if (d.querySelector('.cv-err')) { fail(f + ' ' + d.querySelector('.cv-err').textContent); continue; }
    if (w.CUBEVIZ_DEFAULTS.cross !== (process.argv[3] || 'green')) fail(f + ' defaults not applied');
    const nSvg = host.querySelectorAll('svg').length;
    const only3d = host.getAttribute('data-view') === '3d';
    const expectSvg = (!isQ && ord === 0 && !only3d) ? 2 : 1;
    if (nSvg !== expectSvg) { fail(f + ' expected ' + expectSvg + ' svgs, got ' + nSvg); continue; }
    const pl = host.cvPlayer, moves = pl.algMoves.length;
    if (!isQ && ord === 0) {
      if (!d.querySelector('.cv-controls') || d.querySelectorAll('.cv-m').length !== moves) fail(f + ' controls / alg spans missing');
      pl.seek(moves);
      if (needsSolved(host) && !w.CubeViz.isSolvedUpToRotation(pl.state)) fail(f + ' not solved after playing alg');   // COLL leaves edges permuted + needs AUF: covered by test_coll.js
      if (pl.idx !== moves) fail(f + ' idx');
      pl.seek(0);
      if (w.CubeViz.isSolvedUpToRotation(pl.state)) fail(f + ' start state already solved');
      // exercise a 3D frame mid-move (no exception)
      pl.scene.draw(pl.state, { mv: pl.algMoves[0], theta: pl.algMoves[0].k * Math.PI / 4 });
      if (sample < 6 && meta.alg.split(/\s+/).length < 14) {   // real timed animation on a sample
        sample++; pl.speed = 4; pl.autoplay = false;
        pl.play();
        const t0 = Date.now();
        while (pl.idx < moves && Date.now() - t0 < 12000) await sleep(40);
        if (pl.idx !== moves) fail(f + ' animation did not finish (' + pl.idx + '/' + moves + ')');
        else if (needsSolved(host) && !w.CubeViz.isSolvedUpToRotation(pl.state)) fail(f + ' animated end state not solved');
        else played++;
      }
    }
    w.close();
  }
  console.log('checked', checked, 'files; animated-to-completion', played, '; failures', fails);
  process.exit(fails ? 1 : 0);
})();
