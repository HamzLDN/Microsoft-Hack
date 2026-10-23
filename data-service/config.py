"""Settings, read from the repo root .env. Every key is optional: a missing key switches that source off."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY", "").strip()
FRED_API_KEY = os.getenv("FRED_API_KEY", "").strip()
SEC_USER_AGENT = os.getenv("SEC_USER_AGENT", "").strip().strip('"')
CACHE_DIR = os.getenv("DATA_CACHE_DIR", str(Path(__file__).resolve().parent / "cache"))
PORT = int(os.getenv("DATA_SERVICE_PORT", "5001"))
DEFAULT_AMOUNT = 100_000
