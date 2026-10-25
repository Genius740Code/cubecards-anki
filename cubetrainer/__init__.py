"""Cube Trainer - flashcards with generated cube pictures and animated algorithms (desktop Anki add-on).

The add-on only creates / updates the 'Cube Case' note type and notes. Rendering is done by JavaScript stored
inside the card templates, so reviewing works on every platform (desktop, AnkiDroid, AnkiMobile) once synced.
"""
from aqt import mw
from aqt.qt import (QAction, QCheckBox, QComboBox, QDialog, QHBoxLayout, QLabel, QLineEdit,
                    QPlainTextEdit, QPushButton, QVBoxLayout)
from aqt.utils import showInfo, tooltip

from . import core

_ADDON = __name__.split(".")[0]


# ------------------------------------------------------------------ config helpers
def get_cfg():
    try:
        user = mw.addonManager.getConfig(_ADDON) or {}
    except Exception:
        user = {}
    return core.merged_config(user)


def save_cfg(cfg):
    mw.addonManager.writeConfig(_ADDON, cfg)


def _refresh():
    for name in ("reset",):
        fn = getattr(mw, name, None)
        if callable(fn):
            try:
                fn()
            except Exception:
                pass
    try:
        mw.deckBrowser.refresh()
    except Exception:
        pass


def _exec(dlg):
    fn = getattr(dlg, "exec", None) or getattr(dlg, "exec_")
    return fn()


def _buttons(dlg, ok_text="OK"):
    row = QHBoxLayout()
    row.addStretch(1)
    cancel = QPushButton("Cancel")
    ok = QPushButton(ok_text)
    cancel.clicked.connect(dlg.reject)
    ok.clicked.connect(dlg.accept)
    row.addWidget(cancel)
    row.addWidget(ok)
    return row


def _combo(options, current):
    box = QComboBox()
    for label, value in options:
        box.addItem(label, value)
    for i in range(box.count()):
        if box.itemData(i) == current:
            box.setCurrentIndex(i)
    return box


# ------------------------------------------------------------------ actions
def install_note_type():
    if not mw.col:
        return
    core.ensure_model(mw.col, None, get_cfg())
    tooltip("Cube Case note type is installed / up to date")


def import_sets_dialog():
    if not mw.col:
        return
    cfg = get_cfg()
    sets = core.load_algsets()
    dlg = QDialog(mw)
    dlg.setWindowTitle("Cube Trainer - import algorithm sets")
    lay = QVBoxLayout(dlg)
    lay.addWidget(QLabel("Choose what to add. Existing cards are never duplicated or overwritten."))
    boxes = []
    for s in sets:
        cb = QCheckBox("%s  (%d)" % (s["name"], len(s["algs"])))
        cb.setChecked(s["id"] in cfg.get("default_sets", []))
        lay.addWidget(cb)
        boxes.append((s["id"], cb))
    rev = QCheckBox("Also make 'Alg to Case' cards")
    rev.setChecked(bool(cfg.get("reverse_cards")))
    lay.addWidget(rev)
    lay.addWidget(QLabel("Deck:"))
    deck = QLineEdit(cfg.get("deck_root", "Cube Trainer"))
    lay.addWidget(deck)
    lay.addLayout(_buttons(dlg, "Import"))
    if not _exec(dlg):
        return
    chosen = set(i for i, cb in boxes if cb.isChecked())
    if not chosen:
        return
    cfg["reverse_cards"] = rev.isChecked()
    res = core.import_sets(mw.col, chosen, cfg, deck.text().strip() or cfg.get("deck_root", "Cube Trainer"))
    _refresh()
    msg = "Added %d cards, skipped %d existing." % (res["added"], res["skipped"])
    if res["errors"]:
        msg += "\n\nProblems:\n" + "\n".join(res["errors"][:10])
    showInfo(msg)


def import_custom_dialog():
    if not mw.col:
        return
    cfg = get_cfg()
    dlg = QDialog(mw)
    dlg.setWindowTitle("Cube Trainer - import your own algorithms")
    lay = QVBoxLayout(dlg)
    lay.addWidget(QLabel("One per line:  Name | algorithm      (e.g.  Sune | R U R' U R U2 R')"))
    text = QPlainTextEdit()
    lay.addWidget(text)
    row = QHBoxLayout()
    row.addWidget(QLabel("Set label:"))
    set_label = QLineEdit("Custom")
    row.addWidget(set_label)
    row.addWidget(QLabel("Stage:"))
    stage = _combo([("full", "full"), ("OLL", "oll"), ("PLL", "pll"), ("COLL", "coll"), ("CMLL", "cmll"),
                    ("F2L (hide last layer)", "f2l"), ("cross", "cross")], "full")
    row.addWidget(stage)
    lay.addLayout(row)
    lay.addWidget(QLabel("Deck:"))
    deck = QLineEdit("%s::Custom" % cfg.get("deck_root", "Cube Trainer"))
    lay.addWidget(deck)
    lay.addLayout(_buttons(dlg, "Import"))
    if not _exec(dlg):
        return
    res = core.import_custom(mw.col, text.toPlainText(), set_label.text().strip() or "Custom",
                             stage.currentData(), cfg, deck.text().strip() or None)
    _refresh()
    msg = "Added %d cards, skipped %d existing." % (res["added"], res["skipped"])
    if res["errors"]:
        msg += "\n\nProblems:\n" + "\n".join(res["errors"][:10])
    showInfo(msg)


def settings_dialog():
    if not mw.col:
        return
    cfg = get_cfg()
    dlg = QDialog(mw)
    dlg.setWindowTitle("Cube Trainer - settings")
    lay = QVBoxLayout(dlg)
    colours = [(c.capitalize(), c) for c in core.COLOR_NAMES]

    def row(label, widget):
        r = QHBoxLayout()
        r.addWidget(QLabel(label))
        r.addWidget(widget)
        lay.addLayout(r)
        return widget

    cross = row("Cross colour (face down / D):", _combo(colours, cfg["cross_color"]))
    front = row("Front colour:", _combo([("Automatic", "")] + colours, cfg["front_color"]))
    shows = [("Flat (top-down diagram)", "flat"), ("3D cube", "3d"), ("Both", "both")]
    fs = row("Question side shows:", _combo(shows, cfg["front_show"]))
    bs = row("Answer side shows:", _combo(shows, cfg["back_show"]))
    speed = row("Animation speed:", _combo([("0.5x", 0.5), ("1x", 1), ("1.5x", 1.5), ("2x", 2), ("3x", 3)],
                                           cfg["speed"]))
    orient = row("Extra view rotation (e.g. y, x2):", QLineEdit(cfg["orient"]))
    auto = QCheckBox("Start playing automatically on the answer side")
    auto.setChecked(bool(cfg["autoplay"]))
    lay.addWidget(auto)
    loop = QCheckBox("Loop the animation")
    loop.setChecked(bool(cfg["loop"]))
    lay.addWidget(loop)
    lay.addWidget(QLabel("Saving updates the card templates. Sync afterwards so your phone gets them."))
    lay.addLayout(_buttons(dlg, "Save"))
    if not _exec(dlg):
        return
    cfg.update({
        "cross_color": cross.currentData(), "front_color": front.currentData(),
        "front_show": fs.currentData(), "back_show": bs.currentData(), "speed": speed.currentData(),
        "orient": orient.text().strip(), "autoplay": auto.isChecked(), "loop": loop.isChecked(),
    })
    save_cfg(cfg)
    core.ensure_model(mw.col, None, cfg)
    tooltip("Saved. Card templates updated.")


# ------------------------------------------------------------------ menu
def _setup_menu():
    menu = mw.form.menuTools.addMenu("Cube Trainer")
    for label, fn in (
        ("Import algorithm sets...", import_sets_dialog),
        ("Import my own algorithms...", import_custom_dialog),
        ("Settings (colours, views, animation)...", settings_dialog),
        ("Install / update note type", install_note_type),
    ):
        act = QAction(label, mw)
        act.triggered.connect(lambda checked=False, f=fn: f())
        menu.addAction(act)


_setup_menu()
