import os
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("DATA_DIR", ROOT / "data"))
STATIC_DIR = Path(os.environ.get("STATIC_DIR", ROOT / "frontend" / "dist"))

# decisions made in January 2026, one day ahead -> delivery days 2 Jan .. 1 Feb
DECISION_FROM = date(2026, 1, 1)
DECISION_TO = date(2026, 1, 31)
DELIVERY_FROM = date(2026, 1, 2)
DELIVERY_TO = date(2026, 2, 1)

# day-ahead auction gate closes 09:20 UK time
DEFAULT_CUTOFF = "09:00"

CORS_ORIGINS = [o for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o]
