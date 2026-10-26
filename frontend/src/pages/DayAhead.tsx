import { useState } from 'react';
import { api } from '../api';
import DayChart from '../components/DayChart';
import { Card, Kpi } from '../components/Kpi';
import RevisionsTable from '../components/RevisionsTable';
import { addDays, dateLong, dateTime, gwh, hourLabel, mw, signed } from '../format';
import type { Meta } from '../types';
import { useFetch } from '../useFetch';

type Props = {
  meta: Meta;
  date: string;
  cutoff: string;
  onDateChange: (date: string) => void;
};

export default function DayAhead({ meta, date, cutoff, onDateChange }: Props) {
  const view = useFetch(() => api.day(date, cutoff), [date, cutoff]);
  const [overlays, setOverlays] = useState<string[]>([]);

  const toggleOverlay = (publishTime: string) =>
    setOverlays((current) =>
      current.includes(publishTime) ? current.filter((p) => p !== publishTime) : [...current, publishTime],
    );

  const prev = addDays(date, -1);
  const next = addDays(date, 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Delivery day {dateLong(date)}</h1>
          <p className="sub">
            Bids for this day are placed on {dateLong(addDays(date, -1))} by {cutoff}. The view shows what the desk knew
            at that moment and what the wind actually did.
          </p>
        </div>
        <div className="controls">
          <button className="btn" disabled={prev < meta.deliveryFrom} onClick={() => onDateChange(prev)}>
            ← Previous
          </button>
          <input
            type="date"
            value={date}
            min={meta.deliveryFrom}
            max={meta.deliveryTo}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
          <button className="btn" disabled={next > meta.deliveryTo} onClick={() => onDateChange(next)}>
            Next →
          </button>
        </div>
      </div>

      {view.error && <p className="error">{view.error}</p>}
      {!view.data && !view.error && <p className="muted">Loading…</p>}

      {view.data && (
        <>
          <div className="kpis">
            <Kpi
              label="Forecast wind"
              value={gwh(view.data.summary.totalForecastMwh)}
              hint={`${view.data.forecastLabel}, published ${dateTime(view.data.forecastPublishedAt)}`}
              tone="accent"
            />
            <Kpi
              label="Actual wind"
              value={gwh(view.data.summary.totalActualMwh)}
              hint={
                view.data.summary.hours < 24
                  ? `${view.data.summary.hours} of 24 hours metered so far, totals compare those hours only`
                  : 'Elexon FUELHH, metered'
              }
              tone="actual"
            />
            <Kpi
              label="Forecast minus actual"
              value={signed(view.data.summary.bias, ' MW')}
              hint={
                (view.data.summary.bias ?? 0) > 0
                  ? 'average per hour, wind came in below forecast'
                  : 'average per hour, wind came in above forecast'
              }
              tone={(view.data.summary.bias ?? 0) > 0 ? 'danger' : 'good'}
            />
            <Kpi label="Mean absolute error" value={mw(view.data.summary.mae)} hint="per hour, this day" />
            <Kpi
              label="Largest shortfall"
              value={mw(view.data.summary.maxShortfall)}
              hint={view.data.summary.worstHour != null ? `at ${hourLabel(view.data.summary.worstHour)}` : undefined}
              tone="danger"
            />
          </div>

          <div className="grid-main">
            <Card
              title="Forecast at cutoff vs actual generation"
              subtitle="Hourly MW. The shaded band is where the actual landed in 80% of hours in this period, given the forecast."
            >
              <DayChart
                points={view.data.points}
                guidance={view.data.guidance}
                overlays={view.data.revisions.filter((r) => overlays.includes(r.publishTime))}
              />
              <p className="legend-note">Tick a publication in the table below to overlay how the forecast changed.</p>
            </Card>

            <Card title="What to buy against" subtitle="Using this period's error statistics for the chosen cutoff">
              <div className="guidance">
                <div className="row">
                  <span className="k">Forecast for the day</span>
                  <span className="v">{gwh(view.data.summary.totalForecastMwh)}</span>
                </div>
                <div className="row">
                  <span className="k">Average forecast bias in this period</span>
                  <span className="v">{signed(view.data.guidance.monthBias)} / h</span>
                </div>
                <div className="row">
                  <span className="k">Shortfall not exceeded in 90% of hours</span>
                  <span className="v">{mw(view.data.guidance.shortfallP90)}</span>
                </div>
                <div className="row">
                  <span className="k">Wind to plan on (forecast − P90 shortfall)</span>
                  <span className="v">{gwh(view.data.guidance.plannedWindMwh)}</span>
                </div>
                <div className="row">
                  <span className="k">Extra to procure vs taking the forecast as is</span>
                  <span className="v">{gwh(view.data.guidance.marginMwh)}</span>
                </div>
                <div className="row">
                  <span className="k">Actual outcome</span>
                  <span className="v">{gwh(view.data.summary.totalActualMwh)}</span>
                </div>
              </div>
              <p
                className={`callout${
                  (view.data.summary.totalActualMwh ?? 0) < view.data.guidance.plannedWindMwh ? ' danger' : ''
                }`}
                style={{ marginTop: 14 }}
              >
                {(view.data.summary.totalActualMwh ?? 0) >= view.data.guidance.plannedWindMwh
                  ? 'Planning on the P90 floor would have covered this day: actual wind came in above the floor.'
                  : 'Even the P90 floor was too optimistic on this day. Days like this are why the desk should also watch the intraday revisions.'}
              </p>
            </Card>
          </div>

          <Card
            title="How the forecast for this day evolved"
            subtitle="Every WINDFOR publication that covered this day, from two days ahead to the delivery day itself"
          >
            <RevisionsTable
              revisions={view.data.revisions}
              usedPublishTime={view.data.forecastPublishedAt}
              overlays={overlays}
              onToggle={toggleOverlay}
            />
          </Card>
        </>
      )}
    </>
  );
}
