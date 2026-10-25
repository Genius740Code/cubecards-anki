# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] - 2026-10-25

First public release.

### Added
- **"Cube Case" note type** with two card types: Case to Alg and Alg to Case (the second is made only for notes whose Reverse field is filled).
- **Generated cube pictures** drawn from the algorithm itself: top-down (OLL-sheet style), bottom (face-down) and 3D views. No screenshots, and the picture always matches the alg.
- **Animated player** on the answer side: play/pause, step back and forward, jump to the end, speed control, autoplay, loop, and tap any move to jump to it.
- **Stages** that grey out pieces not part of the step you are learning: `full`, `oll`, `coll`, `cmll`, `f2l` and `cross`.
- **Colour schemes:** choose the cross colour (for example blue, which puts green on top), the front colour, and a hex value for each of the six colours.
- **Bundled CFOP sets**, one card and one algorithm per case, sorted into sub-decks by group:
  - F2L (41): Free Pairs, Disconnected Pairs, Connected Pairs, Corner In Slot, Edge In Slot, Pieces In Slot
  - OLL (57): Dot Case, Square Shapes, Lightning Shapes, Fish Shapes, Knight Move Shapes, OCLL, All Corners Oriented, Awkward Shapes, P Shapes, T Shapes, C Shapes, W Shapes, L Shapes, Line Shapes
  - PLL (21): Adjacent Swap, Opposite Swap, EPLL
  - COLL (40): Sune, Anti-Sune, H, L, Pi, T, U
  - 2-look OLL (10): edges and corners
- **Import your own algorithms** from pasted `Name | alg` lines.
- **Tools > Cube Trainer menu:** import algorithm sets, import your own algorithms, settings, and install/update the note type.
- **Config options:** `cross_color`, `front_color`, `colors`, `grey_color`, `body_color`, `view`, `stage`, `orient`, `front_show`, `back_show`, `speed`, `move_ms`, `autoplay`, `loop`, `reverse_cards`, `deck_root`, `default_sets`.
- **Notation support:** face turns, wide moves (`r` or `Rw`), slices (`M E S`), rotations (`x y z`), primes, double turns and parentheses.
- PLL and COLL pictures are aligned to the standard position, and the card Notes say when to finish with an AUF.
- F2L cards use the 3D view with the pair shown in the front-right slot.
- Works offline. The drawing code lives inside the card templates, so synced cards are designed to work on desktop, AnkiDroid and AnkiMobile.
- Starter deck (`Cube_Trainer_starter.apkg`) for people who only use a phone.

### Notes
- Requires Anki 2.1.50 or newer. The add-on runs on desktop only; the cards it creates sync to mobile.
- Algorithm choices follow the lists on SpeedCubeDB. See the README for credit.

[0.1.0]: https://github.com/YOUR-USERNAME/YOUR-REPO/releases/tag/v0.1.0