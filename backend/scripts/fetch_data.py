import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import config  # noqa: E402
from app.elexon import fetch_wind_actuals, fetch_wind_forecasts  # noqa: E402


def main(delivery_from: date, delivery_to: date, data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)

    print(f"fetching actuals (FUELHH, WIND) {delivery_from} .. {delivery_to}...")
    raw_actuals = fetch_wind_actuals(delivery_from - timedelta(days=1), delivery_to)
    actuals = {}
    for row in raw_actuals:
        actuals[row["startTime"]] = {"startTime": row["startTime"], "generation": row["generation"]}
    actual_rows = sorted(actuals.values(), key=lambda r: r["startTime"])

    # from two days before the first delivery day, so the revision history is there too
    publish_from = datetime.combine(delivery_from - timedelta(days=2), datetime.min.time(), timezone.utc)
    publish_to = datetime.combine(delivery_to + timedelta(days=1), datetime.min.time(), timezone.utc)
    print(f"fetching forecasts (WINDFOR) published {publish_from:%Y-%m-%d} .. {publish_to:%Y-%m-%d}...")
    raw_forecasts = fetch_wind_forecasts(publish_from, publish_to)
    forecasts = {}
    for row in raw_forecasts:
        key = (row["publishTime"], row["startTime"])
        forecasts[key] = {"publishTime": row["publishTime"], "startTime": row["startTime"], "generation": row["generation"]}
    forecast_rows = sorted(forecasts.values(), key=lambda r: (r["publishTime"], r["startTime"]))

    (data_dir / "actuals.json").write_text(json.dumps(actual_rows))
    (data_dir / "forecasts.json").write_text(json.dumps(forecast_rows))
    meta = {
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "deliveryFrom": delivery_from.isoformat(),
        "deliveryTo": delivery_to.isoformat(),
        "actuals": {"rows": len(actual_rows), "from": actual_rows[0]["startTime"], "to": actual_rows[-1]["startTime"]},
        "forecasts": {
            "rows": len(forecast_rows),
            "publishedFrom": forecast_rows[0]["publishTime"],
            "publishedTo": forecast_rows[-1]["publishTime"],
        },
        "source": "Elexon BMRS Insights API, datasets FUELHH (fuelType WIND) and WINDFOR",
    }
    (data_dir / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="download wind actuals and forecasts from Elexon")
    parser.add_argument("--from", dest="delivery_from", type=date.fromisoformat, default=config.DELIVERY_FROM)
    parser.add_argument("--to", dest="delivery_to", type=date.fromisoformat, default=config.DELIVERY_TO)
    parser.add_argument("--out", type=Path, default=Path(os.environ.get("DATA_DIR", config.DATA_DIR)))
    args = parser.parse_args()
    main(args.delivery_from, args.delivery_to, args.out)
