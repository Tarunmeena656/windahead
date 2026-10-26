from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json() == {"status": "ok"}


def test_meta_describes_the_window_and_publication_slots():
    body = client.get("/api/meta").json()
    assert body["deliveryFrom"] == "2026-01-02"
    assert body["deliveryTo"] == "2026-02-01"
    assert body["defaultCutoff"] == "09:00"
    assert body["publishSlots"] == ["02:30", "04:30", "07:30", "09:30", "11:30", "15:30", "18:30", "22:30"]
    assert body["data"]["actuals"]["rows"] == 1536


def test_day_uses_the_last_publication_before_the_cutoff():
    body = client.get("/api/day/2026-01-02?cutoff=09:00").json()
    assert body["forecastPublishedAt"] == "2026-01-01T07:30:00Z"
    assert body["forecastLabel"] == "D-1 07:30"
    assert body["decisionTime"] == "2026-01-01T09:00:00Z"
    assert len(body["points"]) == 24
    assert all(p["forecast"] is not None and p["actual"] is not None for p in body["points"])
    assert body["summary"]["hours"] == 24
    assert body["guidance"]["shortfallP90"] is not None

    labels = [r["label"] for r in body["revisions"]]
    assert labels[:3] == ["D-2 02:30", "D-2 04:30", "D-2 07:30"]
    available = [r["label"] for r in body["revisions"] if r["availableAtCutoff"]]
    assert available[-1] == "D-1 07:30"

    later = client.get("/api/day/2026-01-02?cutoff=10:00").json()
    assert later["forecastPublishedAt"] == "2026-01-01T09:30:00Z"


def test_day_rejects_dates_outside_the_window_and_bad_cutoffs():
    assert client.get("/api/day/2026-03-01").status_code == 404
    assert client.get("/api/day/2026-01-01").status_code == 404
    assert client.get("/api/day/2026-01-02?cutoff=25:00").status_code == 422
    assert client.get("/api/day/not-a-date").status_code == 422


def test_accuracy_covers_every_delivery_day():
    body = client.get("/api/accuracy").json()
    assert body["cutoff"] == "09:00"
    assert body["days"] == 31
    assert body["metrics"]["hours"] == 744
    assert body["metrics"]["mae"] > 0
    assert len(body["daily"]) == 31
    assert len(body["byHour"]) == 24
    assert len(body["bySlot"]) == 16
    assert body["bySlot"][0]["label"] == "D-2 02:30"
    assert body["bySlot"][-1]["label"] == "D-1 22:30"
    assert sum(b["count"] for b in body["histogram"]) == 744
    assert len(body["scatter"]) == 744
