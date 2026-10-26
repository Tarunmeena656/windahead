// January is GMT so UTC is already UK time
const utc = { timeZone: 'UTC' } as const;

export const mw = (value: number | null | undefined, digits = 0) =>
  value == null ? '–' : `${value.toLocaleString('en-GB', { maximumFractionDigits: digits })} MW`;

export const gw = (value: number | null | undefined) => (value == null ? '–' : `${(value / 1000).toFixed(1)} GW`);

export const gwh = (mwh: number | null | undefined) => (mwh == null ? '–' : `${(mwh / 1000).toFixed(1)} GWh`);

export const signed = (value: number | null | undefined, unit = ' MW') =>
  value == null ? '–' : `${value > 0 ? '+' : ''}${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}${unit}`;

export const pct = (value: number | null | undefined) => (value == null ? '–' : `${value.toFixed(1)}%`);

export const dateLong = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...utc });

export const dateShort = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...utc });

export const dateTime = (isoTime: string) =>
  new Date(isoTime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...utc });

export const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
