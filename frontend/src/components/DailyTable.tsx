import { dateLong, gw, hourLabel, mw, signed } from '../format';
import type { DailyRow } from '../types';

type Props = {
  rows: DailyRow[];
  onOpenDay: (date: string) => void;
};

export default function DailyTable({ rows, onOpenDay }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Delivery day</th>
            <th>Forecast used</th>
            <th className="num">Mean forecast</th>
            <th className="num">Mean actual</th>
            <th className="num">MAE</th>
            <th className="num">Bias</th>
            <th className="num">Largest shortfall</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date} className="clickable" onClick={() => onOpenDay(row.date)}>
              <td>{dateLong(row.date)}</td>
              <td>{row.forecastLabel}</td>
              <td className="num">{gw(row.meanForecast)}</td>
              <td className="num">{gw(row.meanActual)}</td>
              <td className="num">{mw(row.mae)}</td>
              <td className={`num ${(row.bias ?? 0) > 0 ? 'pos' : 'neg'}`}>{signed(row.bias)}</td>
              <td className="num">
                {mw(row.maxShortfall)}
                {row.worstHour != null && <span className="muted"> at {hourLabel(row.worstHour)}</span>}
              </td>
              <td>
                <button className="btn small" onClick={() => onOpenDay(row.date)}>
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
