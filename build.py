"""Build dist/cubetrainer.ankiaddon (+ starter deck). Run from the repo root: python3 build.py  (--no-deck to skip the deck)"""
import os
import sys
import zipfile
import importlib.util

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "cubetrainer")
DIST = os.path.join(ROOT, "dist")
FILES = ["__init__.py", "core.py", "cubeviz.js", "algsets.json", "config.json", "config.md", "manifest.json", "LICENSE"]


def load_core():
    spec = importlib.util.spec_from_file_location("cubecore", os.path.join(SRC, "core.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    os.makedirs(DIST, exist_ok=True)
    import json
    with open(os.path.join(SRC, "config.json"), "w") as f:      # keep config.json in sync with the code defaults
        json.dump(load_core().DEFAULT_CONFIG, f, indent=2)
        f.write("\n")
    with open(os.path.join(ROOT, "LICENSE"), "rb") as f, open(os.path.join(SRC, "LICENSE"), "wb") as g:
        g.write(f.read())                       # ship the licence inside the add-on too
    addon = os.path.join(DIST, "cubetrainer.ankiaddon")
    with zipfile.ZipFile(addon, "w", zipfile.ZIP_DEFLATED) as z:   # files at the archive root, as Anki requires
        for name in FILES:
            z.write(os.path.join(SRC, name), name)
    print("built", addon, os.path.getsize(addon), "bytes")
    if "--no-deck" not in sys.argv:
        apkg = os.path.join(DIST, "Cube_Trainer_starter.apkg")
        res = load_core().export_apkg(apkg)
        print("built", apkg, os.path.getsize(apkg), "bytes", res)


if __name__ == "__main__":
    main()
