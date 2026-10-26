import os
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
STATIC_DIR = Path(os.environ.get("STATIC_DIR", ROOT / "frontend" / "dist"))


def env_date(name: str, fallback: date) -> date:
    value = os.environ.get(name)
    return date.fromisoformat(value) if value else fallback


# decisions made in January 2026, one day ahead -> delivery days 2 Jan .. 1 Feb.
# DELIVERY_FROM / DELIVERY_TO switch the window, e.g. to the last few weeks for a live check
DELIVERY_FROM = env_date("DELIVERY_FROM", date(2026, 1, 2))
DELIVERY_TO = env_date("DELIVERY_TO", date(2026, 2, 1))
DECISION_FROM = DELIVERY_FROM - timedelta(days=1)
DECISION_TO = DELIVERY_TO - timedelta(days=1)

# day-ahead auction gate closes 09:20 UK time
DEFAULT_CUTOFF = "09:00"

CORS_ORIGINS = [o for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
