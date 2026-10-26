from datetime import date, datetime, time, timedelta, timezone

import pytest

from app import analysis
from app.store import Store, hours_of

UTC = timezone.utc
JAN2 = date(2026, 1, 2)
JAN3 = date(2026, 1, 3)


def at(day: date, hh: int, mm: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hh, mm, tzinfo=UTC)


def actual_for(hour: datetime) -> float:
    return 10000 + 100 * hour.hour


def publication(publish: datetime, offset: float, first: datetime, hours: int = 73) -> tuple[datetime, dict]:
    return publish, {first + timedelta(hours=i): actual_for(first + timedelta(hours=i)) + offset for i in range(hours)}


@pytest.fixture
def store() -> Store:
    actuals = {}
    for day in (date(2026, 1, 1), JAN2, JAN3, date(2026, 1, 4)):
        for hour in hours_of(day):
            actuals[hour] = actual_for(hour)
            actuals[hour + timedelta(minutes=30)] = actual_for(hour)
    actuals[at(JAN2, 5)] = 10000
    actuals[at(JAN2, 5, 30)] = 11000

    forecasts = dict(
        [
            publication(at(date(2025, 12, 31), 22, 30), 1000, at(date(2025, 12, 31), 21)),
            publication(at(date(2026, 1, 1), 7, 30), 500, at(date(2026, 1, 1), 21)),
            publication(at(date(2026, 1, 1), 9, 30), 100, at(date(2026, 1, 1), 21)),
            publication(at(JAN2, 7, 30), 300, at(JAN2, 21)),
            # only covers the first 11 hours of 3 Jan
            publication(at(JAN2, 23, 0), -900, at(JAN3, 0), hours=11),
        ]
    )
    for publish in (at(date(2026, 1, 1), 7, 30), at(date(2026, 1, 1), 9, 30)):
        for hour in hours_of(JAN3):
            forecasts[publish][hour] = actual_for(hour) - 200
    return Store(actuals, forecasts, meta={})


def test_hourly_actuals_are_the_mean_of_the_two_half_hours(store):
    assert store.actual(at(JAN2, 5)) == 10500
    assert store.actual(at(JAN2, 6)) == 10600


def test_picks_the_latest_publication_before_the_cutoff(store):
    publish, _ = analysis.forecast_for_day(store, JAN2, time(9, 0))
    assert publish == at(date(2026, 1, 1), 7, 30)

    publish, _ = analysis.forecast_for_day(store, JAN2, time(10, 0))
    assert publish == at(date(2026, 1, 1), 9, 30)

    publish, _ = analysis.forecast_for_day(store, JAN2, time(1, 0))
    assert publish == at(date(2025, 12, 31), 22, 30)


def test_skips_publications_that_do_not_cover_the_whole_day(store):
    publish, _ = analysis.forecast_for_day(store, JAN3, time(23, 59))
    assert publish == at(JAN2, 7, 30)


def test_returns_none_when_nothing_was_published_in_time(store):
    assert analysis.forecast_for_day(store, date(2026, 1, 1), time(9, 0)) is None


def test_day_view_errors_and_summary(store):
    view = analysis.day_view(store, JAN2, time(9, 0))
    assert view["forecastPublishedAt"] == "2026-01-01T07:30:00Z"
    assert view["forecastLabel"] == "D-1 07:30"
    assert len(view["points"]) == 24
    errors = {p["hour"]: p["error"] for p in view["points"]}
    assert errors[0] == 500
    assert errors[5] == 500  # compared against the 10500 hourly mean, not either half hour
    summary = view["summary"]
    assert summary["hours"] == 24
    assert summary["bias"] == 500
    assert summary["mae"] == 500
    assert summary["maxShortfall"] == 500
    assert summary["totalForecastMwh"] == summary["totalActualMwh"] + 24 * 500
    labels = [r["label"] for r in view["revisions"]]
    assert labels == ["D-2 22:30", "D-1 07:30", "D-1 09:30", "D 07:30"]
    available = {r["label"]: r["availableAtCutoff"] for r in view["revisions"]}
    assert available["D-1 07:30"] is True
    assert available["D-1 09:30"] is False


def test_month_accuracy(store):
    result = analysis.accuracy(store, time(9, 0), days=[JAN2, JAN3])
    assert result["days"] == 2
    assert result["metrics"]["hours"] == 48
    assert result["metrics"]["bias"] == 400
    assert result["metrics"]["mae"] == 400
    assert result["errorQuantiles"]["p95"] == 500
    assert result["errorQuantiles"]["p50"] == 400
    assert result["errorQuantiles"]["p5"] == 300
    assert [d["forecastLabel"] for d in result["daily"]] == ["D-1 07:30", "D-1 07:30"]
    assert all(row["n"] == 2 for row in result["byHour"])
    assert sum(b["count"] for b in result["histogram"]) == 48

    slots = {row["label"]: row for row in result["bySlot"]}
    assert slots["D-1 07:30"]["days"] == 2
    assert slots["D-1 07:30"]["bias"] == 400
    assert slots["D-2 09:30"]["bias"] == -200
    assert "D-1 23:00" not in slots
    assert result["bySlot"][0]["leadHours"] > result["bySlot"][-1]["leadHours"]


def test_quantile_and_cutoff_parsing():
    assert analysis.quantile([1, 2, 3, 4], 0.5) == 2.5
    assert analysis.quantile([5], 0.9) == 5
    assert analysis.quantile([], 0.9) is None
    assert analysis.parse_cutoff("09:20") == time(9, 20)
    with pytest.raises(ValueError):
        analysis.parse_cutoff("nine")
