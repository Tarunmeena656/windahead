from collections import Counter
from datetime import date, time

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import analysis, config
from .store import load_store

app = FastAPI(title="Day-ahead wind desk", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["GET"], allow_headers=["*"])


def cutoff_param(cutoff: str = Query(config.DEFAULT_CUTOFF, pattern=r"^([01]\d|2[0-3]):[0-5]\d$")) -> time:
    return analysis.parse_cutoff(cutoff)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta() -> dict:
    store = load_store()
    counts = Counter(p.strftime("%H:%M") for p in store.publish_times)
    days = len({p.date() for p in store.publish_times})
    slots = sorted(slot for slot, n in counts.items() if n * 2 >= days)
    return {
        "deliveryFrom": config.DELIVERY_FROM.isoformat(),
        "deliveryTo": config.DELIVERY_TO.isoformat(),
        "decisionFrom": config.DECISION_FROM.isoformat(),
        "decisionTo": config.DECISION_TO.isoformat(),
        "defaultCutoff": config.DEFAULT_CUTOFF,
        "publishSlots": slots,
        "data": store.meta,
    }


@app.get("/api/accuracy")
def accuracy(cutoff: time = Depends(cutoff_param)) -> dict:
    return analysis.cached_accuracy(cutoff.strftime("%H:%M"))


@app.get("/api/day/{day}")
def day(day: date, cutoff: time = Depends(cutoff_param)) -> dict:
    if not config.DELIVERY_FROM <= day <= config.DELIVERY_TO:
        raise HTTPException(404, f"Delivery day must be between {config.DELIVERY_FROM} and {config.DELIVERY_TO}")
    try:
        return analysis.day_view(load_store(), day, cutoff)
    except LookupError as err:
        raise HTTPException(404, str(err)) from err


# serve the built frontend as well when it exists (vercel runs it this way)
if config.STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=config.STATIC_DIR, html=True), name="frontend")
