from datetime import date, datetime, timedelta

import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"


def _get(path: str, params: dict) -> list[dict]:
    response = httpx.get(f"{BASE_URL}/{path}/stream", params=params, timeout=60)
    response.raise_for_status()
    return response.json()


def fetch_wind_actuals(start: date, end: date) -> list[dict]:
    rows: list[dict] = []
    day = start
    while day <= end:
        rows.extend(
            _get(
                "FUELHH",
                {"settlementDateFrom": day.isoformat(), "settlementDateTo": day.isoformat(), "fuelType": "WIND"},
            )
        )
        day += timedelta(days=1)
    return rows


def fetch_wind_forecasts(start: datetime, end: datetime) -> list[dict]:
    rows: list[dict] = []
    at = start
    while at < end:
        nxt = min(at + timedelta(days=1), end)
        rows.extend(
            _get(
                "WINDFOR",
                {
                    "publishDateTimeFrom": at.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "publishDateTimeTo": nxt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                },
            )
        )
        at = nxt
    return rows
