import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]

# Drop any previously imported shared "app" package from another service.
for key in list(sys.modules):
    if key == "app" or key.startswith("app."):
        del sys.modules[key]

for p in [
    ROOT,
    REPO / "libs" / "advisory-core" / "src",
    REPO / "libs" / "mcp-connectors" / "src",
    REPO / "libs" / "strategy-normalizer" / "src",
    REPO / "libs" / "risk-explainability" / "src",
    REPO / "libs" / "market-regime-detector" / "src",
]:
    sp = str(p)
    if sp in sys.path:
        sys.path.remove(sp)
    sys.path.insert(0, sp)
