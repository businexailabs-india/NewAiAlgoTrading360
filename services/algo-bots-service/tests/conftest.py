import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIB_SRC = ROOT.parents[1] / "libs" / "tradex-bots" / "src"
for p in (ROOT, LIB_SRC):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))
