"""Fill the cache for every ticker before the demo. Run at kickoff and again just before presenting."""
import sys
import time

import data
import universe

if __name__ == "__main__":
    tickers = sys.argv[1:] or list(universe.ALL)
    start = time.time()
    snaps = data.snapshots(tickers, workers=4)  # 4 workers keeps Finnhub under 60 calls a minute in practice
    missing = sorted(set(tickers) - set(snaps))
    data.macro()
    print(f"cached {len(snaps)}/{len(tickers)} tickers in {time.time() - start:.0f}s" + (f", missing: {', '.join(missing)}" if missing else ""))
