"""Cube Trainer core: note type, templates, bulk import. No GUI (aqt) imports, so it can be tested headless.

Design notes (Anki limitations this is built around):
  * Add-ons only run on desktop, but cards sync everywhere. So ALL rendering lives in the card template
    itself (inline <script>, SVG only - no WebGL, no external files, no media folder, no network).
    That is why the same note type works in Anki desktop, AnkiDroid and AnkiMobile.
  * Templates can't read add-on settings, so settings are baked into the template when you press Save.
  * Anki treats "{{" and "}}" in templates as field tags, so the JS is sanitised before inlining.
"""
import json
import os
import re

MODEL_NAME = "Cube Case"
FIELDS = ["Name", "Set", "Alg", "Scramble", "Stage", "View", "Cross", "Orient", "Notes", "Reverse"]

DEFAULT_CONFIG = {
    "cross_color": "white",   # colour on the D face: white / yellow / green / blue / red / orange
    "front_color": "",        # colour on the F face; "" = automatic
    "colors": {               # the hex value used for each colour name (change one to match your cube)
        "white": "#ffffff", "yellow": "#ffd500", "green": "#009b48",
        "blue": "#0046ad", "red": "#b71234", "orange": "#ff5800",
    },
    "grey_color": "#8a8a8a",  # pieces greyed out by a stage (OLL, COLL, F2L...)
    "body_color": "#161616",  # cube body / gaps between stickers
    "view": "top",            # default picture orientation: top | bottom | flip
    "stage": "",              # default stage for notes with an empty Stage field ("" = full)
    "orient": "",             # extra whole-cube rotation for the picture, e.g. "y" or "x2"
    "front_show": "flat",     # question side: flat | 3d | both
    "back_show": "both",      # answer side:   flat | 3d | both
    "speed": 1,               # animation speed multiplier
    "move_ms": 420,           # length of one quarter turn in milliseconds (at speed 1)
    "autoplay": True,
    "loop": False,
    "reverse_cards": False,   # also make Alg -> Case cards when importing
    "deck_root": "Cube Trainer",   # parent deck used by the import dialogs
    "default_sets": ["2look-eo", "2look-co"],   # sets pre-ticked in the import dialog
}

COLOR_NAMES = ["white", "yellow", "green", "blue", "red", "orange"]

CARD_CSS = """
.card { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; font-size: 20px;
        text-align: center; color: #1c1c1c; background: #ffffff; }
.nightMode.card, .nightMode .card, .night_mode .card { color: #e8e8e8; background: #1e1e1e; }
.cv-set { font-size: 14px; opacity: .65; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; }
.cv-name { font-size: 28px; font-weight: 700; margin: 2px 0 4px; }
.cv-algbig { font-family: Menlo, Consolas, "DejaVu Sans Mono", monospace; font-size: 26px; line-height: 1.6; margin: 12px 0; }
.cv-notes { font-size: 16px; opacity: .8; margin-top: 8px; }
hr#answer { margin: 14px 0; }
"""

_FRONT_1 = """<div class="cv-card">
<div class="cv-set">{{Set}}</div>
<div class="cubeviz" data-show="@@FRONT_SHOW@@" data-view="{{text:View}}" data-stage="{{text:Stage}}" data-cross="{{text:Cross}}" data-orient="{{text:Orient}}" data-animate="0">
<div class="cv-alg" style="display:none">{{Alg}}</div>
<div class="cv-scr" style="display:none">{{Scramble}}</div>
</div>
</div>
<script>@@PRELUDE@@</script>
<script>@@JS@@</script>
<script>try{CubeViz.mountAll();}catch(e){}</script>"""

_BACK_1 = """<div class="cv-card">
<div class="cv-name">{{Name}}</div>
<div class="cubeviz" data-show="@@BACK_SHOW@@" data-view="{{text:View}}" data-stage="{{text:Stage}}" data-cross="{{text:Cross}}" data-orient="{{text:Orient}}" data-animate="1">
<div class="cv-alg" style="display:none">{{Alg}}</div>
<div class="cv-scr" style="display:none">{{Scramble}}</div>
</div>
{{#Notes}}<div class="cv-notes">{{Notes}}</div>{{/Notes}}
</div>
<script>@@PRELUDE@@</script>
<script>@@JS@@</script>
<script>try{CubeViz.mountAll();}catch(e){}</script>"""

_FRONT_2 = """{{#Reverse}}<div class="cv-card">
<div class="cv-set">{{Set}} &middot; which case does this solve?</div>
<div class="cv-algbig">{{Alg}}</div>
</div>{{/Reverse}}"""

_BACK_2 = """{{FrontSide}}
<hr id="answer">
<div class="cv-card">
<div class="cv-name">{{Name}}</div>
<div class="cubeviz" data-show="@@FRONT_SHOW@@" data-view="{{text:View}}" data-stage="{{text:Stage}}" data-cross="{{text:Cross}}" data-orient="{{text:Orient}}" data-animate="0">
<div class="cv-alg" style="display:none">{{Alg}}</div>
<div class="cv-scr" style="display:none">{{Scramble}}</div>
</div>
</div>
<script>@@PRELUDE@@</script>
<script>@@JS@@</script>
<script>try{CubeViz.mountAll();}catch(e){}</script>"""


def addon_dir():
    return os.path.dirname(os.path.abspath(__file__))


def load_js(path=None):
    with open(path or os.path.join(addon_dir(), "cubeviz.js"), "r", encoding="utf-8") as f:
        return f.read()


def load_algsets(path=None):
    with open(path or os.path.join(addon_dir(), "algsets.json"), "r", encoding="utf-8") as f:
        return json.load(f)["sets"]


def merged_config(user_cfg=None):
    cfg = dict(DEFAULT_CONFIG)
    cfg.update(user_cfg or {})
    return cfg


def sanitize_js(js):
    """Anki would parse '{{' / '}}' as template tags. A space in between is always harmless in JS code."""
    return js.replace("{{", "{ {").replace("}}", "} }")


def _prelude(cfg):
    d = {
        "cross": str(cfg.get("cross_color") or "white"),
        "front": str(cfg.get("front_color") or ""),
        "orient": str(cfg.get("orient") or ""),
        "speed": cfg.get("speed", 1),
        "grey": str(cfg.get("grey_color") or ""),
        "body": str(cfg.get("body_color") or ""),
        "move_ms": cfg.get("move_ms", 420),
        "view": str(cfg.get("view") or ""),
        "stage": str(cfg.get("stage") or ""),
        "autoplay": 1 if cfg.get("autoplay") else 0,
        "loop": 1 if cfg.get("loop") else 0,
    }
    s = "window.CUBEVIZ_DEFAULTS=" + json.dumps(d) + ";"
    if cfg.get("colors"):
        s += "window.CUBEVIZ_COLORS=" + json.dumps(cfg["colors"]) + ";"
    return sanitize_js(s)


def build_templates(js_src, cfg=None):
    cfg = merged_config(cfg)
    prelude, js = _prelude(cfg), sanitize_js(js_src)

    def fill(t):
        return (t.replace("@@PRELUDE@@", prelude)
                 .replace("@@FRONT_SHOW@@", cfg["front_show"])
                 .replace("@@BACK_SHOW@@", cfg["back_show"])
                 .replace("@@JS@@", js))

    return [
        {"name": "Case to Alg", "qfmt": fill(_FRONT_1), "afmt": fill(_BACK_1)},
        {"name": "Alg to Case", "qfmt": fill(_FRONT_2), "afmt": fill(_BACK_2)},
    ]


# ---------------------------------------------------------------- Anki API compatibility helpers
def _call(obj, new_name, old_name, *a, **k):
    fn = getattr(obj, new_name, None) or getattr(obj, old_name)
    return fn(*a, **k)


def _save_model(mm, model):
    fn = getattr(mm, "update_dict", None) or getattr(mm, "save")
    fn(model)


def ensure_model(col, js_src=None, cfg=None):
    """Create the 'Cube Case' note type, or update its templates/CSS/fields in place. Returns the model dict."""
    js_src = js_src if js_src is not None else load_js()
    mm = col.models
    specs = build_templates(js_src, cfg)
    model = mm.by_name(MODEL_NAME)
    if model is None:
        model = mm.new(MODEL_NAME)
        for f in FIELDS:
            _call(mm, "add_field", "addField", model, _call(mm, "new_field", "newField", f))
        for s in specs:
            t = _call(mm, "new_template", "newTemplate", s["name"])
            t["qfmt"], t["afmt"] = s["qfmt"], s["afmt"]
            _call(mm, "add_template", "addTemplate", model, t)
        model["css"] = CARD_CSS
        mm.add(model)
        return mm.by_name(MODEL_NAME)
    # update existing
    have = [f["name"] for f in model["flds"]]
    for f in FIELDS:
        if f not in have:
            _call(mm, "add_field", "addField", model, _call(mm, "new_field", "newField", f))
    by_name = dict((t["name"], t) for t in model["tmpls"])
    for s in specs:
        if s["name"] in by_name:
            by_name[s["name"]]["qfmt"], by_name[s["name"]]["afmt"] = s["qfmt"], s["afmt"]
        else:
            t = _call(mm, "new_template", "newTemplate", s["name"])
            t["qfmt"], t["afmt"] = s["qfmt"], s["afmt"]
            _call(mm, "add_template", "addTemplate", model, t)
    model["css"] = CARD_CSS
    _save_model(mm, model)
    return mm.by_name(MODEL_NAME)


# ---------------------------------------------------------------- alg validation + notes
_MOVE_RE = re.compile(r"^([UDFBRLudfbrlMESxyz])(w?)(\d*)(')?(\d*)$")


def clean_alg(s):
    s = re.sub(r"<[^>]*>", " ", s or "")
    s = s.replace("&nbsp;", " ").replace("&#x27;", "'").replace("&#39;", "'")
    s = re.sub("[\u2018\u2019\u2032\u00b4`]", "'", s)
    s = re.sub(r"[()\u00b7\u00a0]", " ", s)
    return " ".join(s.split())


def validate_alg(s):
    """Return None if every move parses, else an error string."""
    toks = clean_alg(s).split()
    if not toks:
        return "empty algorithm"
    for t in toks:
        m = _MOVE_RE.match(t)
        if not m or (m.group(2) and m.group(1) not in "UDFBRL"):
            return "unknown move '%s'" % t
    return None


def _existing_keys(col):
    keys = set()
    for nid in col.find_notes('"note:%s"' % MODEL_NAME):
        n = col.get_note(nid)
        keys.add((n["Set"], n["Name"]))
    return keys


def add_algs(col, model, deck_name, set_label, stage, algs, reverse=False, tags=None, skip_existing=True):
    """algs: list of {"name":..., "alg":...}. Returns (added, skipped, errors)."""
    did = _call(col.decks, "id", "id", deck_name)
    existing = _existing_keys(col) if skip_existing else set()
    added = skipped = 0
    errors = []
    for a in algs:
        name, alg = a["name"], clean_alg(a["alg"])
        err = validate_alg(alg)
        if err:
            errors.append("%s: %s" % (name, err))
            continue
        if (set_label, name) in existing:
            skipped += 1
            continue
        note = _call(col, "new_note", "newNote", model)
        note["Name"], note["Set"], note["Alg"] = name, set_label, alg
        note["Stage"] = a.get("stage", stage or "")
        note["Reverse"] = "y" if reverse else ""
        for k in ("Scramble", "View", "Cross", "Orient", "Notes"):
            if a.get(k.lower()):
                note[k] = a[k.lower()]
        if tags:
            note.tags = list(tags)
        _call(col, "add_note", "addNote", note, did)
        added += 1
    return added, skipped, errors


def _slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def import_sets(col, set_ids, cfg=None, deck_root=None, js_src=None):
    """Import bundled alg sets by id. Cases with a 'group' go into a sub-deck named after it
    (for example Cube Trainer::OLL::Dot Case). Returns {"added":n, "skipped":n, "errors":[...]}"""
    cfg = merged_config(cfg)
    deck_root = deck_root if deck_root is not None else cfg.get("deck_root", "Cube Trainer")
    model = ensure_model(col, js_src, cfg)
    total = {"added": 0, "skipped": 0, "errors": []}
    for s in load_algsets():
        if s["id"] not in set_ids:
            continue
        base = "%s::%s" % (deck_root, s["deck"]) if deck_root else s["deck"]
        groups = []
        for a in s["algs"]:
            g = a.get("group", "")
            if g not in [x[0] for x in groups]:
                groups.append((g, []))
            dict(groups)[g].append(a)
        for g, algs in groups:
            tags = ["cube", "cube::" + s["id"]] + (["cube::%s::%s" % (s["id"], _slug(g))] if g else [])
            a_, k_, e_ = add_algs(col, model, "%s::%s" % (base, g) if g else base, s["set"], s["stage"], algs,
                                  reverse=bool(cfg.get("reverse_cards")), tags=tags)
            total["added"] += a_
            total["skipped"] += k_
            total["errors"] += e_
    return total


def parse_custom(text):
    """Lines of 'Name | alg' (also 'Name: alg' or 'Name<TAB>alg'). A bare alg line gets an auto name."""
    out, n = [], 0
    for line in (text or "").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = None
        for sep in ("|", "\t", ":"):
            if sep in line:
                parts = line.split(sep, 1)
                break
        n += 1
        if parts:
            out.append({"name": parts[0].strip() or "Case %d" % n, "alg": parts[1].strip()})
        else:
            out.append({"name": "Case %d" % n, "alg": line})
    return out


def import_custom(col, text, set_label, stage, cfg=None, deck=None, js_src=None):
    cfg = merged_config(cfg)
    deck = deck or "%s::Custom" % cfg.get("deck_root", "Cube Trainer")
    model = ensure_model(col, js_src, cfg)
    a, k, e = add_algs(col, model, deck, set_label, stage, parse_custom(text),
                       reverse=bool(cfg.get("reverse_cards")), tags=["cube", "cube::custom"])
    return {"added": a, "skipped": k, "errors": e}


def export_apkg(out_path, set_ids=None, cfg=None, deck_root=None, work_dir=None):
    """Build a ready-made .apkg (note type + decks) so mobile-only users need no add-on. Uses a temp collection."""
    import tempfile
    from anki.collection import Collection, ExportAnkiPackageOptions, DeckIdLimit
    work_dir = work_dir or tempfile.mkdtemp(prefix="cubeviz_")
    col = Collection(os.path.join(work_dir, "collection.anki2"))
    try:
        deck_root = deck_root if deck_root is not None else merged_config(cfg).get("deck_root", "Cube Trainer")
        ids = set(set_ids or [s["id"] for s in load_algsets()])
        res = import_sets(col, ids, cfg, deck_root)
        did = col.decks.id(deck_root)
        opts = ExportAnkiPackageOptions(with_scheduling=False, with_deck_configs=False, with_media=False, legacy=True)
        tmp_out = os.path.join(work_dir, "export.apkg")   # Anki fsyncs the target dir; some mounts refuse that
        col.export_anki_package(out_path=tmp_out, options=opts, limit=DeckIdLimit(did))
        import shutil
        shutil.copyfile(tmp_out, out_path)
        return res
    finally:
        col.close()
