import json
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache

from . import config

TIME_FORMAT = "%Y-%m-%dT%H:%M:%SZ"


def parse_time(value: str) -> datetime:
    return datetime.strptime(value, TIME_FORMAT).replace(tzinfo=timezone.utc)


def format_time(value: datetime) -> str:
    return value.strftime(TIME_FORMAT)


def day_start(day: date) -> datetime:
    return datetime.combine(day, datetime.min.time(), timezone.utc)


def hours_of(day: date) -> list[datetime]:
    start = day_start(day)
    return [start + timedelta(hours=h) for h in range(24)]


@dataclass
class Store:
    # half-hourly MW by period start
    actuals: dict[datetime, float]
    # publish time -> hour -> MW
    forecasts: dict[datetime, dict[datetime, float]]
    meta: dict

    def __post_init__(self) -> None:
        self.publish_times = sorted(self.forecasts)
        self.hourly_actuals = self._hourly_means()

    def _hourly_means(self) -> dict[datetime, float]:
        # forecasts are hourly, so the two half hours are averaged
        buckets: dict[datetime, list[float]] = {}
        for start, mw in self.actuals.items():
            buckets.setdefault(start.replace(minute=0), []).append(mw)
        return {hour: sum(values) / len(values) for hour, values in buckets.items()}

    def actual(self, hour: datetime) -> float | None:
        return self.hourly_actuals.get(hour)

    def publications_before(self, moment: datetime) -> list[datetime]:
        return [p for p in reversed(self.publish_times) if p <= moment]

    def covers(self, publish: datetime, hours: list[datetime]) -> bool:
        series = self.forecasts[publish]
        return all(h in series for h in hours)


def load_store_from(data_dir) -> Store:
    actual_rows = json.loads((data_dir / "actuals.json").read_text())
    forecast_rows = json.loads((data_dir / "forecasts.json").read_text())
    meta = json.loads((data_dir / "meta.json").read_text())

    actuals = {parse_time(r["startTime"]): float(r["generation"]) for r in actual_rows}
    forecasts: dict[datetime, dict[datetime, float]] = {}
    for r in forecast_rows:
        forecasts.setdefault(parse_time(r["publishTime"]), {})[parse_time(r["startTime"])] = float(r["generation"])
    return Store(actuals, forecasts, meta)


@lru_cache(maxsize=1)
def load_store() -> Store:
    return load_store_from(config.DATA_DIR)
