"""Dev utility: time feature computation per bot on a 600-bar window."""
import cProfile
import pstats
import sys
import time as tm
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from tradex_bots.bots import BOT_REGISTRY, create_bot  # noqa: E402
from tradex_bots.indicators_ext import compute_base_features  # noqa: E402
from tradex_bots.synthetic import synth_candles  # noqa: E402

df = synth_candles("X", 9, seed=1).iloc[:600].reset_index(drop=True)
for bid in BOT_REGISTRY:
    b = create_bot(bid)
    t = tm.time()
    for _ in range(3):
        b.features(df)
    print(bid, round((tm.time() - t) / 3 * 1000), "ms")
t = tm.time()
for _ in range(3):
    compute_base_features(df, **create_bot("BOT_01_VWAP_EMA_VOLUME").base_feature_args())
print("base only", round((tm.time() - t) / 3 * 1000), "ms")
bot = create_bot("BOT_01_VWAP_EMA_VOLUME")
cProfile.run("bot.features(df)", "p.out")
pstats.Stats("p.out").sort_stats("tottime").print_stats(8)
