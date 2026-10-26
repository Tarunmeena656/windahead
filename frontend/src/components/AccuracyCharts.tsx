import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dateShort, hourLabel } from '../format';
import type { Accuracy, SlotRow } from '../types';

const gwTick = (v: number) => `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)} GW`;
const mwLabel = (v: unknown) => `${Number(v).toLocaleString('en-GB', { maximumFractionDigits: 0 })} MW`;

export function DailyChart({ daily }: { daily: Accuracy['daily'] }) {
  const data = daily.map((d) => ({ date: dateShort(d.date), mae: d.mae, bias: d.bias }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#edf0f5" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={2} />
          <YAxis tick={{ fontSize: 12 }} width={56} tickFormatter={gwTick} />
          <Tooltip formatter={(v, name) => [mwLabel(v), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          <ReferenceLine y={0} stroke="#999" />
          <Bar dataKey="mae" name="MAE" fill="var(--forecast)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="bias" name="Bias (forecast − actual)" fill="#c9cdf7" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Histogram({ bins }: { bins: Accuracy['histogram'] }) {
  const data = bins.map((b) => ({ label: `${(b.from / 1000).toFixed(1)}`, count: b.count, from: b.from }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 18 }}>
          <CartesianGrid stroke="#edf0f5" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            label={{ value: 'forecast − actual, GW', position: 'insideBottom', offset: -14, fontSize: 12, fill: '#5b6577' }}
          />
          <YAxis tick={{ fontSize: 12 }} width={40} allowDecimals={false} />
          <Tooltip
            formatter={(v) => [`${v} hours`, 'Count']}
            labelFormatter={(label) => `${label} to ${(Number(label) + 0.5).toFixed(1)} GW`}
          />
          <Bar dataKey="count" name="Hours" isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.from} fill={d.from >= 0 ? 'var(--danger)' : 'var(--good)'} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HourOfDayChart({ rows }: { rows: Accuracy['byHour'] }) {
  const data = rows.map((r) => ({ hour: hourLabel(r.hour), mae: r.mae, bias: r.bias }));
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#edf0f5" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} interval={2} />
          <YAxis tick={{ fontSize: 12 }} width={56} tickFormatter={gwTick} />
          <Tooltip formatter={(v, name) => [mwLabel(v), String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          <Bar dataKey="mae" name="MAE" fill="var(--forecast)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="bias" name="Bias" fill="#c9cdf7" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SlotChart({ rows, usedLabel }: { rows: SlotRow[]; usedLabel: string }) {
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#edf0f5" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10.5 }} interval={0} angle={-35} textAnchor="end" height={54} />
          <YAxis tick={{ fontSize: 12 }} width={56} tickFormatter={gwTick} domain={[0, 'auto']} />
          <Tooltip
            formatter={(v) => [mwLabel(v), 'MAE']}
            labelFormatter={(label) => {
              const row = rows.find((r) => r.label === label);
              return row ? `${label} · ${row.leadHours} h before the day · ${row.days} days` : String(label);
            }}
          />
          <Bar dataKey="mae" name="MAE" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.label} fill={r.label === usedLabel ? 'var(--forecast)' : '#c9cdf7'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ScatterPlot({ points, peak }: { points: [number, number][]; peak: number }) {
  const data = points.map(([forecast, actual]) => ({ forecast, actual }));
  const top = Math.ceil(Math.max(peak, ...points.map((p) => p[0])) / 5000) * 5000;
  return (
    <div className="chart">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#edf0f5" />
          <XAxis
            dataKey="forecast"
            type="number"
            domain={[0, top]}
            tick={{ fontSize: 12 }}
            tickFormatter={gwTick}
            name="Forecast"
            label={{ value: 'forecast', position: 'insideBottom', offset: -4, fontSize: 12 }}
          />
          <YAxis dataKey="actual" type="number" domain={[0, top]} tick={{ fontSize: 12 }} width={56} tickFormatter={gwTick} name="Actual" />
          <Tooltip formatter={(v, name) => [mwLabel(v), String(name)]} cursor={{ strokeDasharray: '3 3' }} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: top, y: top }]} stroke="#999" strokeDasharray="4 4" />
          <Scatter data={data} fill="var(--forecast)" fillOpacity={0.35} isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
