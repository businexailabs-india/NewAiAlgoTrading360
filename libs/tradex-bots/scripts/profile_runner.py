"""Dev utility: profile the paper replay loop."""
import cProfile
import pstats
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "src"))
sys.path.insert(0, str(root / "tests"))

from harness import Env  # noqa: E402
from test_runner_paper import SYMS, build, candles_for  # noqa: E402
from tradex_bots.bots import BOT_REGISTRY  # noqa: E402
from tradex_bots.runner import replay_candles  # noqa: E402

env = Env(latency_ms=0)
r = build(env, list(BOT_REGISTRY))
data = {s: candles_for(s, 3, 40 + i, 300.0 + 150 * i) for i, s in enumerate(SYMS)}
env.clock.t = min(c.start for cs in data.values() for c in cs)
cProfile.run("replay_candles(r, env.clock, data)", "prof.out")
pstats.Stats("prof.out").sort_stats("cumulative").print_stats(22)
