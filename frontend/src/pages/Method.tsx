import { Card } from '../components/Kpi';
import { dateTime } from '../format';
import type { Meta } from '../types';

export default function Method({ meta }: { meta: Meta }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Method and data</h1>
          <p className="sub">What the numbers mean and where they come from.</p>
        </div>
      </div>

      <Card title="Data" subtitle={`Snapshot from the Elexon BMRS Insights API, taken ${dateTime(meta.data.fetchedAt)} UTC`}>
        <div className="prose">
          <ul>
            <li>
              <strong>Actual generation</strong>: dataset <code>FUELHH</code>, fuel type <code>WIND</code>. Half-hourly
              metered output of transmission-connected wind in GB, in MW. {meta.data.actuals.rows.toLocaleString()} rows,{' '}
              {meta.data.actuals.from.slice(0, 10)} to {meta.data.actuals.to.slice(0, 10)}.
            </li>
            <li>
              <strong>Forecast generation</strong>: dataset <code>WINDFOR</code>. Hourly wind forecast published by the
              system operator about eight times a day ({meta.publishSlots.join(', ')} UK time), each covering the next
              72 hours. {meta.data.forecasts.rows.toLocaleString()} rows published between{' '}
              {meta.data.forecasts.publishedFrom.slice(0, 10)} and {meta.data.forecasts.publishedTo.slice(0, 10)}.
            </li>
            <li>
              Scope: purchase decisions made in January 2026, i.e. delivery days {meta.deliveryFrom} to {meta.deliveryTo}.
              January is on GMT, so Elexon's UTC timestamps are UK local time.
            </li>
          </ul>
        </div>
      </Card>

      <Card title="Which forecast counts as 'the latest available'">
        <div className="prose">
          <p>
            The desk commits for delivery day D on D-1, before the day-ahead auction gate closes (09:20 in GB). The app
            takes the decision cutoff from the header (default 09:00) and uses the most recent WINDFOR publication made at
            or before that moment that covers every hour of D. Publications made two days ahead stop at 21:00 of D, so
            with the default cutoff the 07:30 publication on D-1 is used. Later publications are shown as revisions but
            never used for the accuracy numbers, because the desk could not have seen them.
          </p>
        </div>
      </Card>

      <Card title="How forecast and actual are compared">
        <div className="prose">
          <ul>
            <li>
              Actuals are half-hourly and forecasts hourly, so the two half hours of each hour are averaged into one
              hourly actual (MW). Summing hourly MW over a day gives MWh.
            </li>
            <li>
              <strong>Error = forecast − actual.</strong> Positive error means the forecast was too high and the wind
              came in short. That is the direction that costs a buyer money, since the gap has to be bought closer to real
              time.
            </li>
            <li>
              <strong>MAE</strong> is the average size of the hourly miss. <strong>RMSE</strong> is similar but weighs
              large misses more. <strong>Bias</strong> is the average signed error. Percentiles describe the distribution
              of the signed error: P90 = 4,000 MW means that in 90% of hours the forecast overshot by less than 4,000 MW.
            </li>
            <li>
              The "likely range" band on the day chart is forecast − P90 error to forecast − P10 error, so it is where the
              actual landed in 80% of January hours.
            </li>
            <li>
              "Wind to plan on" is the forecast minus the P90 shortfall, floored at zero, summed over the day. "Extra to
              procure" is the difference between that and the raw forecast. It is a planning aid, not a trading
              recommendation.
            </li>
          </ul>
        </div>
      </Card>

      <Card title="Limitations">
        <div className="prose">
          <ul>
            <li>
              National level only, and only transmission-connected wind. Embedded (distribution-connected) wind is not in
              FUELHH, and a utility would compare against its own portfolio.
            </li>
            <li>
              FUELHH is metered output after any curtailment. Part of the positive bias in January 2026 may be wind that
              was available but constrained off, which the forecast does not know about. For a buyer the metered figure
              is still the one that matters.
            </li>
            <li>One month of data. The error statistics describe January 2026 and should be refreshed as data accrues.</li>
            <li>No demand data in scope, so the app quantifies the wind side of the residual position only.</li>
          </ul>
        </div>
      </Card>
    </>
  );
}
