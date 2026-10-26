import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { hourLabel } from '../format';
import type { Guidance, HourPoint, Revision } from '../types';

type Props = {
  points: HourPoint[];
  guidance: Guidance;
  overlays: Revision[];
};

const OVERLAY_COLOURS = ['#9aa3b2', '#c98a12', '#b24fd6', '#5a8f3c', '#d64545', '#2a7f9e'];

export default function DayChart({ points, guidance, overlays }: Props) {
  const data = points.map((p) => {
    const row: Record<string, unknown> = {
      hour: hourLabel(p.hour),
      forecast: p.forecast,
      actual: p.actual,
    };
    if (p.forecast != null) {
      // p10..p90 of this month's errors around the forecast
      row.band = [Math.max(p.forecast - guidance.shortfallP90, 0), p.forecast - guidance.errorP10];
    }
    for (const rev of overlays) {
      row[rev.publishTime] = rev.series[String(p.hour)] ?? null;
    }
    return row;
  });

  return (
    <div className="chart tall">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#edf0f5" vertical={false} />
          <XAxis dataKey="hour" tick={{ fontSize: 12 }} interval={2} />
          <YAxis
            tick={{ fontSize: 12 }}
            width={56}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)} GW`}
            domain={[0, 'auto']}
          />
          <Tooltip
            formatter={(value, name) => {
              if (Array.isArray(value)) {
                return [`${(value[0] / 1000).toFixed(1)} – ${(value[1] / 1000).toFixed(1)} GW`, 'Likely range (P10–P90)'];
              }
              return [`${(Number(value) / 1000).toFixed(2)} GW`, String(name)];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12.5 }} />
          <Area
            dataKey="band"
            name="Likely range (P10–P90)"
            stroke="none"
            fill="var(--band)"
            type="monotone"
            isAnimationActive={false}
            legendType="square"
          />
          {overlays.map((rev, i) => (
            <Line
              key={rev.publishTime}
              dataKey={rev.publishTime}
              name={`Forecast ${rev.label}`}
              stroke={OVERLAY_COLOURS[i % OVERLAY_COLOURS.length]}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              type="monotone"
              isAnimationActive={false}
            />
          ))}
          <Line
            dataKey="forecast"
            name="Forecast at cutoff"
            stroke="var(--forecast)"
            strokeWidth={2.5}
            dot={false}
            type="monotone"
            isAnimationActive={false}
          />
          <Line
            dataKey="actual"
            name="Actual generation"
            stroke="var(--actual)"
            strokeWidth={2.5}
            dot={false}
            type="monotone"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
