# WindAhead – day-ahead wind desk

Web app for a GB energy supplier's day-ahead buying desk. It shows the latest national wind generation
forecast that was available when the day-ahead bids had to be in, compares it with what the wind actually
produced, and quantifies the forecast error so the desk can size the extra power it needs to buy.

Scope: purchase decisions made in January 2026 (delivery days 2 Jan – 1 Feb 2026), national wind only,
data from Elexon BMRS (`FUELHH` actuals, `WINDFOR` forecasts).

**Live app:** https://windahead.vercel.app

## What it does

- **Day-ahead view** – pick a delivery day and a decision cutoff on D-1 (default 09:00, the GB day-ahead
  auction closes at 09:20). The app selects the last WINDFOR publication before that moment, plots it
  against the metered actuals, shows the likely range from this month's error distribution, and turns it
  into a planning figure (forecast minus the 90th percentile shortfall). A table shows every publication
  that covered that day, so you can see how the forecast evolved and overlay revisions on the chart.
- **Forecast accuracy** – MAE, RMSE, bias, error quantiles, error by day, by hour of day, by forecast
  level, by publication slot (how much a later publication would have helped), distribution histogram and
  a forecast-vs-actual scatter, all for the chosen cutoff.
- **Method & data** – definitions, the cutoff rule, aggregation and limitations.

Headline for January 2026 at a 09:00 cutoff: MAE 2.0 GW (18% of mean output), bias +1.7 GW (the forecast
ran high), 90% of hours were less than 4.1 GW short.

## Files and directories

```
backend/
  app/
    main.py        FastAPI app: /api/meta, /api/day/{date}, /api/accuracy, serves frontend/dist if present
    analysis.py    forecast selection at a cutoff, error metrics, quantiles, breakdowns
    store.py       loads the JSON snapshot, averages the half-hourly actuals to hours
    elexon.py      Elexon BMRS client (FUELHH and WINDFOR stream endpoints)
    config.py      date window, default cutoff, data and static directories, CORS
  scripts/fetch_data.py   downloads the January window from Elexon into data/
  tests/           pytest: analysis on synthetic data, API against the snapshot
  Dockerfile, requirements.txt, requirements-dev.txt
frontend/
  src/
    App.tsx                  shell: tabs and the cutoff selector
    pages/DayAhead.tsx       delivery-day view
    pages/Accuracy.tsx       month-wide accuracy
    pages/Method.tsx         method and limitations
    components/              charts (Recharts), tables, KPI cards
    api.ts, types.ts, format.ts, useFetch.ts
  Dockerfile, nginx.conf, vite.config.ts
data/
  actuals.json     FUELHH WIND, half-hourly, 1 Jan – 1 Feb 2026
  forecasts.json   WINDFOR publications 31 Dec 2025 – 1 Feb 2026
  meta.json        when the snapshot was taken and what it contains
api/index.py       Vercel entry point (imports the FastAPI app)
docker-compose.yml, vercel.json, requirements.txt (used by Vercel), .python-version
```

## How to run

### Prerequisites

- Docker Desktop (for the Docker route), or
- Python 3.12 or newer and Node.js 22 (for the manual route)
- Git

No API keys or accounts are needed. The data is a committed snapshot in `data/`, so nothing is downloaded
at runtime.

### Option 1 – Docker (recommended)

```bash
git clone https://github.com/Tarunmeena656/windahead.git
cd windahead
docker compose up --build
```

Then open http://localhost:3000. The API is on http://localhost:8000 (try
http://localhost:8000/api/meta). Stop with `Ctrl+C` or `docker compose down`.

The compose file starts two containers: `api` (uvicorn on 8000) and `web` (nginx on 3000, which serves the
built frontend and proxies `/api/*` to the api container).

### Option 2 – run the backend and frontend yourself

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows PowerShell / cmd
# source .venv/bin/activate       # macOS / Linux
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Check it with http://localhost:8000/api/health → `{"status":"ok"}`.

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to port 8000, so no configuration is needed.
If the backend runs on another host or port, set `VITE_API_URL` (for example
`VITE_API_URL=http://localhost:8000 npm run dev`).

Production-style build without Docker:

```bash
cd frontend && npm run build        # writes frontend/dist
cd ../backend && uvicorn app.main:app --port 8000
```

With `frontend/dist` present, the backend serves the app itself at http://localhost:8000.

### Tests and checks

```bash
cd backend && pytest                # 12 tests, about 5 seconds
cd frontend && npm run build        # tsc typecheck + Vite build
```

### Refreshing the data

```bash
cd backend
python scripts/fetch_data.py
```

This re-downloads the January 2026 window from Elexon (about 70 small requests) and rewrites the three
files in `data/`. The window is defined in `backend/app/config.py`.

### Other date windows (for example up to today)

The brief fixes the window to January 2026 and that is the default. To test with recent days, download
another window into its own folder and point the backend at it:

```bash
cd backend
python scripts/fetch_data.py --from 2026-09-27 --to 2026-10-26 --out ../data-latest
DATA_DIR=../data-latest DELIVERY_FROM=2026-09-27 DELIVERY_TO=2026-10-26 uvicorn app.main:app --port 8000
```

PowerShell: `$env:DATA_DIR='../data-latest'; $env:DELIVERY_FROM='2026-09-27'; $env:DELIVERY_TO='2026-10-26'; uvicorn app.main:app --port 8000`.

The frontend picks the window up from `/api/meta`. Today's delivery day works too: the forecast is the
one published yesterday, and the actuals fill in as Elexon publishes them (about 30 minutes after each
half hour), so totals and errors cover the metered hours only until the day is complete. `data-*`
folders are ignored by git.

### Environment variables

| Variable       | Default                          | Used for                               |
| -------------- | -------------------------------- | -------------------------------------- |
| `PORT`         | 8000 (uvicorn flag)              | backend port                           |
| `DATA_DIR`     | `<repo>/data`                    | where the snapshot is read from        |
| `DELIVERY_FROM` | `2026-01-02`                    | first delivery day of the window       |
| `DELIVERY_TO`  | `2026-02-01`                     | last delivery day of the window        |
| `STATIC_DIR`   | `<repo>/frontend/dist`           | built frontend served by the backend   |
| `CORS_ORIGINS` | `http://localhost:5173`          | comma separated list of allowed origins |
| `VITE_API_URL` | empty (same origin)              | frontend: API base URL                 |

### Deploying to Vercel

```bash
npm i -g vercel
vercel deploy --prod
```

`vercel.json` installs the Python requirements and the frontend packages, builds the frontend, and runs
the FastAPI app from `api/index.py`. The app serves `/api/*` and the built frontend; Vercel pushes the
static files to its CDN. Python version is pinned in `.python-version`.

### Troubleshooting

- **Port already in use** – change the port: `uvicorn ... --port 8001` and `VITE_API_URL=http://localhost:8001`,
  or edit the `ports` in `docker-compose.yml`.
- **`docker compose` cannot connect** – Docker Desktop is not running. Start it and retry.
- **Frontend shows "Could not reach the API"** – the backend is not up on port 8000, or the browser is
  pointed at a different origin than the one in `CORS_ORIGINS`.
- **Empty charts** – the delivery day must be between 2 Jan and 1 Feb 2026; other dates return 404.

## API

| Endpoint                           | Returns                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/meta`                    | date window, default cutoff, publication slots, snapshot info           |
| `GET /api/day/{date}?cutoff=09:00` | hourly forecast vs actual, summary, guidance, all publications for the day |
| `GET /api/accuracy?cutoff=09:00`   | month-wide metrics, quantiles, daily rows, breakdowns, histogram, scatter |

`cutoff` is `HH:MM` on D-1. Dates are `YYYY-MM-DD`.

## Design notes

- **Cutoff rule.** The decision moment is D-1 at the chosen time. The forecast used is the latest WINDFOR
  publication at or before that moment that covers all 24 hours of D. A publication made on day P covers
  P-1 21:00 to P+2 21:00, so D-2 publications only reach 21:00 of D; they are a fallback and are shown
  separately in the slot comparison.
- **Alignment.** Actuals are half-hourly, forecasts hourly; the two half hours are averaged to one hourly
  MW value. Error is forecast − actual, positive when the wind came in below forecast.
- **Snapshot instead of live calls.** January 2026 is fixed history, so the app serves from `data/`.
  `fetch_data.py` rebuilds it. This keeps the numbers reproducible and the Vercel function self-contained.
- **Plain Python for the statistics.** 744 hourly points do not need pandas; the function stays small
  and cold starts fast.
- **One deployable.** FastAPI serves the API and, when `frontend/dist` exists, the frontend. Locally with
  Docker, nginx does the static serving instead.

## AI tools

AI tools (Claude) were used during development to help write and review code, tests and this README.
