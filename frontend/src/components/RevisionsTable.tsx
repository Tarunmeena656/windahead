import { dateTime, gw, mw, signed } from '../format';
import type { Revision } from '../types';

type Props = {
  revisions: Revision[];
  usedPublishTime: string;
  overlays: string[];
  onToggle: (publishTime: string) => void;
};

export default function RevisionsTable({ revisions, usedPublishTime, overlays, onToggle }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Show</th>
            <th>Publication</th>
            <th>Published</th>
            <th className="num">Lead (h)</th>
            <th className="num">Hours</th>
            <th className="num">Mean forecast</th>
            <th className="num">MAE vs actual</th>
            <th className="num">Bias</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {revisions.map((rev) => {
            const used = rev.publishTime === usedPublishTime;
            return (
              <tr key={rev.publishTime} className={used ? 'used' : rev.availableAtCutoff ? '' : 'dim'}>
                <td>
                  <input
                    type="checkbox"
                    checked={overlays.includes(rev.publishTime)}
                    disabled={used}
                    onChange={() => onToggle(rev.publishTime)}
                    aria-label={`Overlay forecast ${rev.label}`}
                  />
                </td>
                <td>{rev.label}</td>
                <td>{dateTime(rev.publishTime)}</td>
                <td className="num">{rev.leadHours}</td>
                <td className="num">{rev.coveredHours}</td>
                <td className="num">{gw(rev.meanForecast)}</td>
                <td className="num">{mw(rev.mae)}</td>
                <td className="num">{signed(rev.bias)}</td>
                <td>
                  {used ? (
                    <span className="chip used">used at cutoff</span>
                  ) : rev.availableAtCutoff ? (
                    <span className="chip ok">available</span>
                  ) : (
                    <span className="chip late">after cutoff</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
