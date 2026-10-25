# Developer tools

Run from the repo root.

- `cfop_algs.txt` is the source list: `SET|GROUP|NAME|ALG`, one algorithm per case.
- `build_sets.js` turns it into `cubetrainer/algsets.json` (`node tools/build_sets.js`). It also:
  - aligns PLL and COLL pictures to the standard position and records the AUF in the card notes,
  - checks every F2L case is a single-slot case and picks the view rotation that puts the slot front-right.

To change an algorithm, edit `cfop_algs.txt`, run the build, then `bash tests/run_all.sh`.
