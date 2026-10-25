"""Smoke-test the add-on glue (__init__.py) against real PyQt6 widgets + a real Anki collection, headless."""
import os, sys, types, tempfile
os.environ["QT_QPA_PLATFORM"] = "offscreen"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from PyQt6.QtWidgets import (QApplication, QMainWindow, QMenu, QCheckBox, QComboBox, QDialog, QHBoxLayout, QLabel,
                             QLineEdit, QPlainTextEdit, QPushButton, QVBoxLayout)
from PyQt6.QtGui import QAction
from anki.collection import Collection

app = QApplication([])
tmp = tempfile.mkdtemp()

class FakeAddonMgr:
    def __init__(self): self.cfg = {}
    def getConfig(self, name): return dict(self.cfg)
    def writeConfig(self, name, cfg): self.cfg = dict(cfg)

class FakeMW(QMainWindow):
    pass
mw = FakeMW()
mw.col = Collection(os.path.join(tmp, "c.anki2"))
mw.addonManager = FakeAddonMgr()
mw.form = types.SimpleNamespace(menuTools=QMenu("Tools"))
mw.reset = lambda: None
mw.deckBrowser = types.SimpleNamespace(refresh=lambda: None)

aqt = types.ModuleType("aqt"); aqt.mw = mw
qt = types.ModuleType("aqt.qt")
for n, o in dict(QAction=QAction, QCheckBox=QCheckBox, QComboBox=QComboBox, QDialog=QDialog, QHBoxLayout=QHBoxLayout,
                 QLabel=QLabel, QLineEdit=QLineEdit, QPlainTextEdit=QPlainTextEdit, QPushButton=QPushButton,
                 QVBoxLayout=QVBoxLayout).items(): setattr(qt, n, o)
msgs = []
utils = types.ModuleType("aqt.utils"); utils.showInfo = lambda m, *a, **k: msgs.append(m); utils.tooltip = lambda m, *a, **k: msgs.append(m)
sys.modules.update({"aqt": aqt, "aqt.qt": qt, "aqt.utils": utils})

import cubetrainer as addon   # runs _setup_menu()
acts = [a.text() for a in mw.form.menuTools.actions()[0].menu().actions()]
print("menu:", acts)
assert len(acts) == 4

# 1) bundled import (defaults: 2-look sets ticked)
addon._exec = lambda d: 1
addon.import_sets_dialog()
print(msgs[-1]); assert "Added 10 cards" in msgs[-1], msgs[-1]
# 2) custom import
def fill_custom(d):
    d.findChild(QPlainTextEdit).setPlainText("Sexy | R U R' U'\nBroken | R U Z9")
    return 1
addon._exec = fill_custom
addon.import_custom_dialog()
print(msgs[-1]); assert "Added 1 cards" in msgs[-1] and "Broken" in msgs[-1]
# 3) settings -> green cross, both on question, no autoplay
def fill_settings(d):
    combos = d.findChildren(QComboBox)
    combos[0].setCurrentIndex([combos[0].itemData(i) for i in range(combos[0].count())].index("green"))
    combos[2].setCurrentIndex([combos[2].itemData(i) for i in range(combos[2].count())].index("both"))
    for cb in d.findChildren(QCheckBox): cb.setChecked(False)
    return 1
addon._exec = fill_settings
addon.settings_dialog()
cfg = mw.addonManager.cfg
print("saved cfg:", {k: cfg[k] for k in ("cross_color", "front_show", "autoplay", "loop")})
assert cfg["cross_color"] == "green" and cfg["front_show"] == "both" and cfg["autoplay"] is False
m = mw.col.models.by_name("Cube Case")
assert '"cross": "green"' in m["tmpls"][0]["qfmt"] and 'data-show="both"' in m["tmpls"][0]["qfmt"]
assert '"autoplay": 0' in m["tmpls"][0]["qfmt"]
# 4) install action + dialogs cancelled do nothing
addon._exec = lambda d: 0
before = mw.col.note_count(); addon.import_sets_dialog(); assert mw.col.note_count() == before
addon.install_note_type()
print("GUI glue OK; notes:", mw.col.note_count())
mw.col.close()
