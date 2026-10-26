import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config  # noqa: E402
from app.elexon import fetch_wind_actuals, fetch_wind_forecasts  # noqa: E402


def main() -> None:
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("fetching actuals (FUELHH, WIND)...")
    raw_actuals = fetch_wind_actuals(config.DELIVERY_FROM - timedelta(days=1), config.DELIVERY_TO)
    actuals = {}
    for row in raw_actuals:
        actuals[row["startTime"]] = {"startTime": row["startTime"], "generation": row["generation"]}
    actual_rows = sorted(actuals.values(), key=lambda r: r["startTime"])

    # from two days before the first delivery day, so the revision history is there too
    publish_from = datetime.combine(config.DELIVERY_FROM - timedelta(days=2), datetime.min.time(), timezone.utc)
    publish_to = datetime.combine(config.DELIVERY_TO + timedelta(days=1), datetime.min.time(), timezone.utc)
    print(f"fetching forecasts (WINDFOR) published {publish_from:%Y-%m-%d} .. {publish_to:%Y-%m-%d}...")
    raw_forecasts = fetch_wind_forecasts(publish_from, publish_to)
    forecasts = {}
    for row in raw_forecasts:
        key = (row["publishTime"], row["startTime"])
        forecasts[key] = {"publishTime": row["publishTime"], "startTime": row["startTime"], "generation": row["generation"]}
    forecast_rows = sorted(forecasts.values(), key=lambda r: (r["publishTime"], r["startTime"]))

    (config.DATA_DIR / "actuals.json").write_text(json.dumps(actual_rows))
    (config.DATA_DIR / "forecasts.json").write_text(json.dumps(forecast_rows))
    meta = {
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "actuals": {"rows": len(actual_rows), "from": actual_rows[0]["startTime"], "to": actual_rows[-1]["startTime"]},
        "forecasts": {
            "rows": len(forecast_rows),
            "publishedFrom": forecast_rows[0]["publishTime"],
            "publishedTo": forecast_rows[-1]["publishTime"],
        },
        "source": "Elexon BMRS Insights API, datasets FUELHH (fuelType WIND) and WINDFOR",
    }
    (config.DATA_DIR / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
