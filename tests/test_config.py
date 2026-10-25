import os, json, importlib.util
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
spec = importlib.util.spec_from_file_location("cubecore", os.path.join(root, "cubetrainer", "core.py"))
core = importlib.util.module_from_spec(spec); spec.loader.exec_module(core)
shipped = json.load(open(os.path.join(root, "cubetrainer", "config.json")))
assert shipped == core.DEFAULT_CONFIG, "config.json is out of sync with DEFAULT_CONFIG (run python3 build.py)"
# a partial user config (what Anki stores after the user edits one key) must still produce a complete config + valid templates
cfg = core.merged_config({"cross_color": "blue", "colors": {"red": "#d11b79"}})
assert cfg["grey_color"] == "#8a8a8a" and cfg["deck_root"] == "Cube Trainer"
t = core.build_templates(core.load_js(), cfg)[0]["qfmt"]
for needle in ('"cross": "blue"', '"grey": "#8a8a8a"', '"move_ms": 420', '"view": "top"', '#d11b79'):
    assert needle in t, needle
assert "{{" not in core.sanitize_js(core._prelude(cfg)) 
print("config.py OK:", len(shipped), "options")
