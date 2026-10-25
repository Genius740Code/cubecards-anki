// The baked-in config defaults must actually change what the cards look like.
const fs = require('fs'); const { JSDOM } = require('jsdom');
const js = fs.readFileSync('cubetrainer/cubeviz.js', 'utf8');
let bad = 0; const fail = m => { bad++; console.log('FAIL:', m); };
function mount(defaults, attrs, alg) {
  const dom = new JSDOM('<body><div class="cubeviz" ' + (attrs || '') + '><div class="cv-alg">' + alg + '</div></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.CUBEVIZ_DEFAULTS = defaults; if (defaults.colors) dom.window.CUBEVIZ_COLORS = defaults.colors;
  dom.window.eval(js); dom.window.CubeViz.mountAll();
  return dom.window.document.querySelector('.cubeviz');
}
const fills = h => Array.from(h.querySelectorAll('rect, polygon')).map(e => e.getAttribute('fill'));
// 1) grey + body colour
let h = mount({ grey: '#123456', body: '#654321' }, 'data-stage="oll" data-show="both"', "R U R' U R U2 R'");
if (!fills(h).includes('#123456')) fail('grey_color not applied');
if (!fills(h).includes('#654321')) fail('body_color not applied (3D gaps)');
if (!Array.from(h.querySelectorAll('rect')).some(e => e.getAttribute('stroke') === '#654321')) fail('body_color not applied to outlines');
// 2) custom colour + cross colour via defaults
h = mount({ cross: 'blue', colors: { red: '#d11b79' } }, 'data-show="flat"', "R U R' U' R' F R F'");
const f = fills(h);
if (!f.includes('#d11b79')) fail('custom red not applied');
if (!f.includes('#009b48')) fail('blue cross should put green on top');
// 3) default view + stage from config
h = mount({ view: 'bottom', stage: 'cross' }, '', "R U R' U'");
if (h.querySelectorAll('svg').length !== 1) fail('default view not applied');
if (!fills(h).includes('#8a8a8a')) fail('default stage "cross" should grey out pieces');
// 4) animation length from config: three moves at 40 ms each must finish well under a second
(async () => {
  h = mount({ move_ms: 40, speed: 1 }, 'data-animate="1" data-show="3d"', "R U R'");
  const pl = h.cvPlayer; pl.play(); const t0 = Date.now();
  while (pl.idx < 3 && Date.now() - t0 < 3000) await new Promise(r => setTimeout(r, 20));
  if (pl.idx !== 3 || Date.now() - t0 > 1500) fail('move_ms not applied (idx ' + pl.idx + ', ' + (Date.now() - t0) + ' ms)');
  console.log(bad ? bad + ' config problem(s)' : 'config defaults all take effect');
  process.exit(bad ? 1 : 0);
})();
