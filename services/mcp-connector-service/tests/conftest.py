import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]

os.environ.setdefault("SERVICE_HMAC_SECRET", "dev-service-hmac-secret-change-me")
os.environ.setdefault("LIVE_TRADING_ENABLED", "false")
os.environ.setdefault("PAPER_TRADING_ENABLED", "true")
os.environ.setdefault("MCP_PROVIDERS_CONFIG_DIR", str(REPO / "config" / "mcp-providers"))
os.environ.setdefault("SECRET_MANAGER_PROVIDER", "local_encrypted")
os.environ.setdefault("LOCAL_SECRET_KEY", "test-local-secret-key")
os.environ["KAFKA_BOOTSTRAP_SERVERS"] = "memory://"

for key in list(sys.modules):
    if key == "app" or key.startswith("app."):
        del sys.modules[key]

for p in [
    ROOT,
    REPO / "libs" / "advisory-core" / "src",
    REPO / "libs" / "mcp-connectors" / "src",
]:
    sp = str(p)
    if sp in sys.path:
        sys.path.remove(sp)
    sys.path.insert(0, sp)
