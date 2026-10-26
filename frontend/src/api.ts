import type { Accuracy, DayView, Meta } from './types';

const base = import.meta.env.VITE_API_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(base + path);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') message = body.detail;
    } catch {
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  meta: () => get<Meta>('/api/meta'),
  day: (date: string, cutoff: string) => get<DayView>(`/api/day/${date}?cutoff=${cutoff}`),
  accuracy: (cutoff: string) => get<Accuracy>(`/api/accuracy?cutoff=${cutoff}`),
};
