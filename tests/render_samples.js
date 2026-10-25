const fs = require('fs'); const { JSDOM } = require('jsdom');
const js = fs.readFileSync('cubetrainer/cubeviz.js', 'utf8');
function page(attrs, alg, scr) {
  const dom = new JSDOM('<body><div class="cubeviz" ' + attrs + '><div class="cv-alg">' + alg + '</div><div class="cv-scr">' + (scr||'') + '</div></div></body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.eval(js); dom.window.CubeViz.mountAll(); return dom;
}
function out(name, svg) { fs.writeFileSync('/tmp/svgs/' + name + '.svg', svg.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" ')); }
fs.mkdirSync('/tmp/svgs', { recursive: true });
const SUNE = "R U R' U R U2 R'";
let d = page('data-stage="oll" data-show="both" data-animate="1"', SUNE);
out('sune_flat', d.window.document.querySelector('svg.cv-flat')); out('sune_3d', d.window.document.querySelector('svg.cv-3d'));
d = page('data-stage="oll" data-cross="green" data-show="both"', SUNE);
out('sune_green_flat', d.window.document.querySelector('svg.cv-flat')); out('sune_green_3d', d.window.document.querySelector('svg.cv-3d'));
d = page('data-stage="full" data-show="both" data-view="bottom"', "R U R' U R U2 R'");
out('sune_bottom_flat', d.window.document.querySelector('svg.cv-flat')); out('sune_bottom_3d', d.window.document.querySelector('svg.cv-3d'));
d = page('data-stage="pll" data-show="both"', "R U R' U' R' F R2 U' R' U' R U R' F'");
out('tperm_flat', d.window.document.querySelector('svg.cv-flat')); out('tperm_3d', d.window.document.querySelector('svg.cv-3d'));
d = page('data-stage="cross" data-show="both" data-view="bottom"', "F R U R' U' F'", "R U F' L D2");
out('cross_bottom_flat', d.window.document.querySelector('svg.cv-flat'));
// mid-animation frame
d = page('data-stage="full" data-show="3d" data-animate="1"', "R U R'");
const p = d.window.document.querySelector('.cubeviz').cvPlayer;
p.scene.draw(p.state, { mv: p.algMoves[0], theta: p.algMoves[0].k * Math.PI / 4 });
out('mid_R', d.window.document.querySelector('svg.cv-3d'));
console.log('done');
