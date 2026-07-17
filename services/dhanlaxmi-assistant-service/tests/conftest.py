import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]

for key in list(sys.modules):
    if key == "app" or key.startswith("app."):
        del sys.modules[key]

for p in [
    ROOT,
    REPO / "libs" / "advisory-core" / "src",
    REPO / "libs" / "language-core" / "src",
    REPO / "libs" / "voice-core" / "src",
    REPO / "libs" / "intent-core" / "src",
    REPO / "libs" / "trade-command-parser" / "src",
    REPO / "libs" / "safety-guardrails" / "src",
    REPO / "libs" / "localized-response-templates" / "src",
]:
    sp = str(p)
    if sp in sys.path:
        sys.path.remove(sp)
    sys.path.insert(0, sp)
