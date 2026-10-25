import os, sys, json, tempfile, shutil, subprocess
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from anki.collection import Collection
import importlib.util as _u
def _load_core(root):
    spec = _u.spec_from_file_location("cubecore", os.path.join(root, "cubetrainer", "core.py"))
    m = _u.module_from_spec(spec); spec.loader.exec_module(m); return m
core = _load_core(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

tmp = tempfile.mkdtemp()
col = Collection(os.path.join(tmp, "c.anki2"))
cfg = core.merged_config({"reverse_cards": True, "cross_color": "green"})
res = core.import_sets(col, {"f2l", "oll", "pll", "coll", "2look-eo", "2look-co"}, cfg)
print("import:", res)
assert res["added"] == 169 and not res["errors"], res
# idempotent
res2 = core.import_sets(col, {"2look-co", "pll"}, cfg)
assert res2["added"] == 0 and res2["skipped"] == 28, res2
# custom import incl. bad alg
r = core.import_custom(col, "My Sune | R U R' U R U2 R'\nBad | R U Q\nJust alg: F R U R' U' F'", "Custom", "oll", cfg)
print("custom:", r)
assert r["added"] == 2 and len(r["errors"]) == 1, r
# update path (model exists): change config and make sure templates update, fields intact
m = core.ensure_model(col, None, core.merged_config({"cross_color": "red", "autoplay": False}))
assert '"cross": "red"' in m["tmpls"][0]["qfmt"], "template not updated"
assert [f["name"] for f in m["flds"]] == core.FIELDS
core.ensure_model(col, None, cfg)

out = os.path.join(tmp, "cards"); os.makedirs(out)
ids = col.find_notes('"note:Cube Case"')
print("notes:", len(ids), "cards:", col.card_count())
n = 0
for nid in ids:
    note = col.get_note(nid)
    for card in note.cards():
        q, a = card.question(), card.answer()
        for bad in ("{{", "}}", "[[unknown", "Card template has a problem"):
            assert bad not in q and bad not in a or bad in ("{{","}}") and False, (note["Name"], bad)
        with open(os.path.join(out, "%s_%d_q.html" % (nid, card.ord)), "w") as f: f.write(q)
        with open(os.path.join(out, "%s_%d_a.html" % (nid, card.ord)), "w") as f: f.write(a)
        meta = {"alg": note["Alg"], "ord": card.ord}
        with open(os.path.join(out, "%s_%d.json" % (nid, card.ord)), "w") as f: json.dump(meta, f)
        n += 1
print("rendered cards:", n)
col.close()
print("OUTDIR", out)
open("/tmp/cards_dir.txt", "w").write(out)
