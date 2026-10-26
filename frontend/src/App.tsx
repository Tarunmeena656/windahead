import { useState } from 'react';
import { api } from './api';
import { dateShort, dateTime } from './format';
import Accuracy from './pages/Accuracy';
import DayAhead from './pages/DayAhead';
import Method from './pages/Method';
import { useFetch } from './useFetch';

type Tab = 'day' | 'accuracy' | 'method';

const TABS: { id: Tab; label: string }[] = [
  { id: 'day', label: 'Day-ahead view' },
  { id: 'accuracy', label: 'Forecast accuracy' },
  { id: 'method', label: 'Method & data' },
];

// auction gate closes 09:20
const CUTOFFS = ['06:00', '08:00', '09:00', '09:20', '10:00', '12:00', '16:00', '19:00', '23:00'];

export function slotForCutoff(cutoff: string, slots: string[]) {
  const before = slots.filter((s) => s <= cutoff);
  return before.length ? `D-1 ${before[before.length - 1]}` : `D-2 ${slots[slots.length - 1]}`;
}

export default function App() {
  const meta = useFetch(() => api.meta(), []);
  const [tab, setTab] = useState<Tab>('day');
  const [cutoff, setCutoff] = useState('09:00');
  const [date, setDate] = useState<string | null>(null);

  if (meta.error) {
    return (
      <div className="page">
        <p className="error">Could not reach the API: {meta.error}</p>
      </div>
    );
  }
  if (!meta.data) {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  const m = meta.data;
  const day = date ?? m.deliveryFrom;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/favicon.svg" alt="" />
          <div>
            <strong>WindAhead</strong>
            <span>
              Day-ahead wind desk · GB · {dateShort(m.deliveryFrom)} – {dateShort(m.deliveryTo)}
            </span>
          </div>
        </div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
        <label className="cutoff">
          Decision cutoff on D-1
          <select value={cutoff} onChange={(e) => setCutoff(e.target.value)}>
            {CUTOFFS.map((c) => (
              <option key={c} value={c}>
                {c} · forecast {slotForCutoff(c, m.publishSlots)}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="page">
        {tab === 'day' && <DayAhead meta={m} date={day} cutoff={cutoff} onDateChange={setDate} />}
        {tab === 'accuracy' && (
          <Accuracy
            cutoff={cutoff}
            onOpenDay={(d) => {
              setDate(d);
              setTab('day');
            }}
          />
        )}
        {tab === 'method' && <Method meta={m} />}
      </main>

      <footer className="footer">
        Source: {m.data.source}. Snapshot taken {dateTime(m.data.fetchedAt)} UTC. Times are UTC, which is UK time in
        winter.
      </footer>
    </div>
  );
}
