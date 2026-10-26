import { api } from '../api';
import { DailyChart, Histogram, HourOfDayChart, ScatterPlot, SlotChart } from '../components/AccuracyCharts';
import DailyTable from '../components/DailyTable';
import { Card, Kpi } from '../components/Kpi';
import { dateShort, gw, mw, pct, signed } from '../format';
import { useFetch } from '../useFetch';

type Props = {
  cutoff: string;
  onOpenDay: (date: string) => void;
};

export default function Accuracy({ cutoff, onOpenDay }: Props) {
  const acc = useFetch(() => api.accuracy(cutoff), [cutoff]);

  if (acc.error) return <p className="error">{acc.error}</p>;
  if (!acc.data) return <p className="muted">Loading…</p>;

  const a = acc.data;
  const m = a.metrics;
  const q = a.errorQuantiles;
  const usedLabel = a.daily[0]?.forecastLabel ?? '';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>How good was the day-ahead wind forecast?</h1>
          <p className="sub">
            {a.days} delivery days
            {a.daily.length > 0 && ` from ${dateShort(a.daily[0].date)} to ${dateShort(a.daily[a.daily.length - 1].date)}`},{' '}
            {m.hours} hours. Each day uses the forecast the desk would have had at {cutoff} on D-1 ({usedLabel}). Error is
            forecast minus actual, so positive means wind came in below forecast.
          </p>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Mean absolute error" value={mw(m.mae)} hint={`${pct(m.maePctOfMean)} of mean actual (${gw(m.meanActual)})`} />
        <Kpi label="RMSE" value={mw(m.rmse)} hint="penalises the big misses" />
        <Kpi
          label="Bias"
          value={signed(m.bias)}
          hint={m.bias > 0 ? 'forecast ran high on average' : 'forecast ran low on average'}
          tone={m.bias > 0 ? 'danger' : 'good'}
        />
        <Kpi label="Shortfall, 90th percentile" value={mw(q.p90)} hint="9 in 10 hours were better than this" tone="danger" />
        <Kpi label="Correlation" value={m.correlation == null ? '–' : m.correlation.toFixed(3)} hint="forecast vs actual, hourly" />
      </div>

      <Card title="Error quantiles" subtitle="Forecast minus actual, MW. Negative values are hours where wind beat the forecast.">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {Object.keys(q).map((k) => (
                  <th key={k} className="num">
                    {k.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {Object.values(q).map((v, i) => (
                  <td key={i} className={`num ${v > 0 ? 'pos' : 'neg'}`}>
                    {signed(v, '')}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="callout" style={{ marginTop: 12 }}>
          Reading it for procurement: if the desk takes the forecast at face value, in half of the hours it ends up at
          least {mw(q.p50)} short of wind. Planning for the forecast minus {mw(q.p90)} covers 90% of hours.
        </p>
      </Card>

      <div className="grid-2">
        <Card title="Error by day" subtitle="Daily MAE and bias of the forecast used at the cutoff">
          <DailyChart daily={a.daily} />
        </Card>
        <Card title="Error distribution" subtitle="Hours per 500 MW error bucket. Red: forecast too high, green: too low.">
          <Histogram bins={a.histogram} />
        </Card>
        <Card title="Accuracy by publication time" subtitle="MAE of each WINDFOR publication slot in the two days before delivery. Highlighted: the slot the cutoff selects.">
          <SlotChart rows={a.bySlot} usedLabel={usedLabel} />
          <p className="legend-note">D-2 publications stop at 21:00 of the delivery day, so their MAE covers 22 hours instead of 24.</p>
        </Card>
        <Card title="Error by hour of day" subtitle="MAE and bias per delivery hour across the month">
          <HourOfDayChart rows={a.byHour} />
        </Card>
        <Card title="Forecast vs actual" subtitle="One point per hour. Points below the line are hours where wind came in below forecast.">
          <ScatterPlot points={a.scatter} peak={m.peakActual} />
        </Card>
        <Card title="Error by forecast level" subtitle="The miss grows with the forecast itself, so a margin in MW should scale with the forecast">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Forecast level</th>
                  <th className="num">Hours</th>
                  <th className="num">MAE</th>
                  <th className="num">Bias</th>
                  <th className="num">MAE / level</th>
                </tr>
              </thead>
              <tbody>
                {a.byLevel.map((row) => (
                  <tr key={row.from}>
                    <td>
                      {gw(row.from)} – {gw(row.to)}
                    </td>
                    <td className="num">{row.n}</td>
                    <td className="num">{mw(row.mae)}</td>
                    <td className={`num ${row.bias > 0 ? 'pos' : 'neg'}`}>{signed(row.bias)}</td>
                    <td className="num">{pct((row.mae / ((row.from + row.to) / 2)) * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Day by day" subtitle="Click a row to open it in the day-ahead view">
        <DailyTable rows={a.daily} onOpenDay={onOpenDay} />
      </Card>
    </>
  );
}
