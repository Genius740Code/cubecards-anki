#!/bin/bash
# Run the whole suite from the repo root:  bash tests/run_all.sh
# Needs: pip install -r requirements-dev.txt   and   npm install
set -e
node tests/test_engine.js
node tools/build_sets.js
node tests/test_sets.js
node tests/test_config.js
python3 tests/test_config.py
python3 tests/test_anki.py
node tests/dom_test.js "$(cat /tmp/cards_dir.txt)"
python3 tests/test_gui.py
echo "ALL TESTS PASSED"
