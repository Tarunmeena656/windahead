# error = forecast - actual everywhere. positive means the wind came in below forecast.

import math
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache

from . import config
from .store import Store, day_start, format_time, hours_of, load_store


def parse_cutoff(value: str) -> time:
    try:
        hour, minute = value.split(":")
        return time(int(hour), int(minute))
    except ValueError as err:
        raise ValueError("cutoff must look like HH:MM") from err


def decision_time(day: date, cutoff: time) -> datetime:
    return datetime.combine(day - timedelta(days=1), cutoff, timezone.utc)


def delivery_days() -> list[date]:
    days = []
    day = config.DELIVERY_FROM
    while day <= config.DELIVERY_TO:
        days.append(day)
        day += timedelta(days=1)
    return days


def mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def quantile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    position = (len(ordered) - 1) * q
    low = math.floor(position)
    high = math.ceil(position)
    if low == high:
        return ordered[low]
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def rmse(errors: list[float]) -> float | None:
    return math.sqrt(sum(e * e for e in errors) / len(errors)) if errors else None


def pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 2:
        return None
    mx, my = mean(xs), mean(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    var_x = sum((x - mx) ** 2 for x in xs)
    var_y = sum((y - my) ** 2 for y in ys)
    if var_x == 0 or var_y == 0:
        return None
    return cov / math.sqrt(var_x * var_y)


def r1(value: float | None) -> float | None:
    return None if value is None else round(value, 1)


# a publication on day P covers P-1 21:00 .. P+2 21:00, so only D-1 publications cover all of D
MIN_COVERED_HOURS = 18


def covered_hours(store: Store, publish: datetime, hours: list[datetime]) -> int:
    series = store.forecasts[publish]
    return sum(1 for h in hours if h in series)


def forecast_for_day(store: Store, day: date, cutoff: time) -> tuple[datetime, dict[datetime, float]] | None:
    hours = hours_of(day)
    candidates = store.publications_before(decision_time(day, cutoff))
    for publish in candidates:
        if store.covers(publish, hours):
            return publish, store.forecasts[publish]
    for publish in candidates:
        if covered_hours(store, publish, hours) >= MIN_COVERED_HOURS:
            return publish, store.forecasts[publish]
    return None


def hour_points(store: Store, day: date, series: dict[datetime, float]) -> list[dict]:
    points = []
    for hour in hours_of(day):
        forecast = series.get(hour)
        actual = store.actual(hour)
        error = forecast - actual if forecast is not None and actual is not None else None
        points.append(
            {
                "time": format_time(hour),
                "hour": hour.hour,
                "forecast": r1(forecast),
                "actual": r1(actual),
                "error": r1(error),
            }
        )
    return points


def summarise(points: list[dict]) -> dict:
    # only hours that have both values, so a day still in progress compares like for like
    paired = [p for p in points if p["error"] is not None]
    errors = [p["error"] for p in paired]
    forecasts = [p["forecast"] for p in paired]
    actuals = [p["actual"] for p in paired]
    worst = max(paired, key=lambda p: p["error"], default=None)
    return {
        "hours": len(errors),
        "meanForecast": r1(mean(forecasts)),
        "meanActual": r1(mean(actuals)),
        "totalForecastMwh": r1(sum(forecasts)),
        "totalActualMwh": r1(sum(actuals)),
        "mae": r1(mean([abs(e) for e in errors])),
        "rmse": r1(rmse(errors)),
        "bias": r1(mean(errors)),
        "maxShortfall": r1(max(errors)) if errors else None,
        "maxSurplus": r1(-min(errors)) if errors else None,
        "worstHour": worst["hour"] if worst else None,
    }


def revisions_for_day(store: Store, day: date, cutoff: time) -> list[dict]:
    hours = hours_of(day)
    decided_at = decision_time(day, cutoff)
    window_from = day_start(day - timedelta(days=2))
    window_to = day_start(day + timedelta(days=1))
    rows = []
    for publish in store.publish_times:
        if not window_from <= publish < window_to:
            continue
        series = store.forecasts[publish]
        covered = [h for h in hours if h in series]
        if not covered:
            continue
        errors = [series[h] - store.actual(h) for h in covered if store.actual(h) is not None]
        rows.append(
            {
                "publishTime": format_time(publish),
                "label": slot_label(day, publish),
                "leadHours": round((day_start(day) - publish).total_seconds() / 3600, 1),
                "availableAtCutoff": publish <= decided_at,
                "coveredHours": len(covered),
                "meanForecast": r1(mean([series[h] for h in covered])),
                "mae": r1(mean([abs(e) for e in errors])),
                "bias": r1(mean(errors)),
                "series": {str(h.hour): r1(series[h]) for h in covered},
            }
        )
    return rows


def slot_label(day: date, publish: datetime) -> str:
    offset = (day - publish.date()).days
    prefix = "D" if offset == 0 else f"D-{offset}"
    return f"{prefix} {publish:%H:%M}"


def day_view(store: Store, day: date, cutoff: time) -> dict:
    found = forecast_for_day(store, day, cutoff)
    if found is None:
        raise LookupError(f"No forecast covering {day} was published before the cutoff")
    publish, series = found
    points = hour_points(store, day, series)
    overall = accuracy(store, cutoff)
    shortfall_p90 = overall["errorQuantiles"]["p90"]
    bias = overall["metrics"]["bias"]
    paired = [p for p in points if p["error"] is not None]
    planned = sum(max(p["forecast"] - shortfall_p90, 0) for p in paired)
    return {
        "date": day.isoformat(),
        "cutoff": cutoff.strftime("%H:%M"),
        "decisionTime": format_time(decision_time(day, cutoff)),
        "forecastPublishedAt": format_time(publish),
        "forecastLabel": slot_label(day, publish),
        "points": points,
        "summary": summarise(points),
        "revisions": revisions_for_day(store, day, cutoff),
        "guidance": {
            "monthBias": bias,
            "errorP10": overall["errorQuantiles"]["p10"],
            "shortfallP90": shortfall_p90,
            "shortfallP95": overall["errorQuantiles"]["p95"],
            "plannedWindMwh": r1(planned),
            "marginMwh": r1(sum(p["forecast"] for p in paired) - planned),
        },
    }


def accuracy(store: Store, cutoff: time, days: list[date] | None = None) -> dict:
    days = days or delivery_days()
    all_points: list[dict] = []
    daily = []
    slot_errors: dict[str, dict] = {}

    for day in days:
        found = forecast_for_day(store, day, cutoff)
        if found is None:
            continue
        publish, series = found
        points = hour_points(store, day, series)
        all_points.extend(points)
        daily.append(
            {
                "date": day.isoformat(),
                "forecastPublishedAt": format_time(publish),
                "forecastLabel": slot_label(day, publish),
                **summarise(points),
            }
        )
        collect_slot_errors(store, day, slot_errors)

    errors = [p["error"] for p in all_points if p["error"] is not None]
    forecasts = [p["forecast"] for p in all_points if p["error"] is not None]
    actuals = [p["actual"] for p in all_points if p["error"] is not None]
    mae = mean([abs(e) for e in errors])
    mean_actual = mean(actuals)
    peak_actual = max(actuals) if actuals else None

    return {
        "cutoff": cutoff.strftime("%H:%M"),
        "days": len(daily),
        "metrics": {
            "hours": len(errors),
            "mae": r1(mae),
            "rmse": r1(rmse(errors)),
            "bias": r1(mean(errors)),
            "maePctOfMean": r1(mae / mean_actual * 100) if mae is not None and mean_actual else None,
            "maePctOfPeak": r1(mae / peak_actual * 100) if mae is not None and peak_actual else None,
            "meanActual": r1(mean_actual),
            "peakActual": r1(peak_actual),
            "correlation": None if pearson(forecasts, actuals) is None else round(pearson(forecasts, actuals), 3),
        },
        "errorQuantiles": {f"p{int(q * 100)}": r1(quantile(errors, q)) for q in (0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95)},
        "absErrorQuantiles": {f"p{int(q * 100)}": r1(quantile([abs(e) for e in errors], q)) for q in (0.5, 0.9, 0.95)},
        "daily": daily,
        "byHour": by_hour(all_points),
        "byLevel": by_level(all_points),
        # ignore one-off publication times
        "bySlot": sorted(
            (
                {
                    "label": label,
                    "leadHours": data["leadHours"],
                    "days": data["days"],
                    "hoursPerDay": round(data["hours"] / data["days"], 1),
                    "mae": r1(mean([abs(e) for e in data["errors"]])),
                    "bias": r1(mean(data["errors"])),
                }
                for label, data in slot_errors.items()
                if data["days"] * 2 >= len(daily)
            ),
            key=lambda row: -row["leadHours"],
        ),
        "histogram": histogram(errors),
        "scatter": [[p["forecast"], p["actual"]] for p in all_points if p["error"] is not None],
    }


def collect_slot_errors(store: Store, day: date, slot_errors: dict[str, dict]) -> None:
    hours = hours_of(day)
    for publish in store.publish_times:
        if not day_start(day - timedelta(days=2)) <= publish < day_start(day):
            continue
        series = store.forecasts[publish]
        covered = [h for h in hours if h in series and store.actual(h) is not None]
        if len(covered) < MIN_COVERED_HOURS:
            continue
        label = slot_label(day, publish)
        entry = slot_errors.setdefault(
            label,
            {"errors": [], "days": 0, "hours": 0, "leadHours": round((day_start(day) - publish).total_seconds() / 3600, 1)},
        )
        entry["days"] += 1
        entry["hours"] += len(covered)
        entry["errors"].extend(series[h] - store.actual(h) for h in covered)


def by_hour(points: list[dict]) -> list[dict]:
    rows = []
    for hour in range(24):
        errors = [p["error"] for p in points if p["hour"] == hour and p["error"] is not None]
        rows.append({"hour": hour, "mae": r1(mean([abs(e) for e in errors])), "bias": r1(mean(errors)), "n": len(errors)})
    return rows


def by_level(points: list[dict], width: float = 4000) -> list[dict]:
    groups: dict[int, list[float]] = {}
    for p in points:
        if p["error"] is None:
            continue
        groups.setdefault(int(p["forecast"] // width), []).append(p["error"])
    rows = []
    for index in sorted(groups):
        errors = groups[index]
        rows.append(
            {
                "from": index * width,
                "to": (index + 1) * width,
                "n": len(errors),
                "mae": r1(mean([abs(e) for e in errors])),
                "bias": r1(mean(errors)),
            }
        )
    return rows


def histogram(errors: list[float], width: float = 500) -> list[dict]:
    if not errors:
        return []
    low = math.floor(min(errors) / width) * width
    high = math.floor(max(errors) / width) * width + width
    bins = []
    edge = low
    while edge < high:
        count = sum(1 for e in errors if edge <= e < edge + width)
        bins.append({"from": edge, "to": edge + width, "count": count})
        edge += width
    return bins


@lru_cache(maxsize=32)
def cached_accuracy(cutoff: str) -> dict:
    return accuracy(load_store(), parse_cutoff(cutoff))
