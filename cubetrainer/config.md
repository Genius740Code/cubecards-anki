Most options are in **Tools > Cube Trainer > Settings**. Everything else is here. After editing, open
**Tools > Cube Trainer > Install / update note type** (or press Save in Settings), then sync, so your cards pick up the change.

- `cross_color`: colour on the face-down (D) side: white, yellow, green, blue, red, orange
- `front_color`: colour on the front face, or `""` for automatic
- `colors`: the hex value for each colour name. Change one to match your cube, for example `"red": "#d11b79"`
- `grey_color`: colour of pieces greyed out by a stage (OLL, COLL, F2L, cross)
- `body_color`: colour of the cube body and the gaps between stickers
- `view`: default picture orientation: `top`, `bottom` or `flip`
- `stage`: default stage for notes with an empty Stage field (`""` = full cube)
- `orient`: extra whole-cube rotation applied to every picture, for example `y` or `x2`
- `front_show` / `back_show`: what the question / answer side shows: `flat`, `3d` or `both`
- `speed`: animation speed multiplier
- `move_ms`: length of one quarter turn in milliseconds at speed 1 (lower = faster)
- `autoplay`, `loop`: animation behaviour on the answer side
- `reverse_cards`: also create "Alg to Case" cards when importing
- `deck_root`: parent deck used by the import dialogs
- `default_sets`: sets that are pre-ticked in the import dialog: `f2l`, `oll`, `pll`, `coll`, `2look-eo`, `2look-co`
