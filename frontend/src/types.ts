export type Meta = {
  deliveryFrom: string;
  deliveryTo: string;
  decisionFrom: string;
  decisionTo: string;
  defaultCutoff: string;
  publishSlots: string[];
  data: {
    fetchedAt: string;
    actuals: { rows: number; from: string; to: string };
    forecasts: { rows: number; publishedFrom: string; publishedTo: string };
    source: string;
  };
};

export type HourPoint = {
  time: string;
  hour: number;
  forecast: number | null;
  actual: number | null;
  error: number | null;
};

export type Summary = {
  hours: number;
  meanForecast: number | null;
  meanActual: number | null;
  totalForecastMwh: number | null;
  totalActualMwh: number | null;
  mae: number | null;
  rmse: number | null;
  bias: number | null;
  maxShortfall: number | null;
  maxSurplus: number | null;
  worstHour: number | null;
};

export type Revision = {
  publishTime: string;
  label: string;
  leadHours: number;
  availableAtCutoff: boolean;
  coveredHours: number;
  meanForecast: number | null;
  mae: number | null;
  bias: number | null;
  series: Record<string, number>;
};

export type Guidance = {
  monthBias: number;
  errorP10: number;
  shortfallP90: number;
  shortfallP95: number;
  plannedWindMwh: number;
  marginMwh: number;
};

export type DayView = {
  date: string;
  cutoff: string;
  decisionTime: string;
  forecastPublishedAt: string;
  forecastLabel: string;
  points: HourPoint[];
  summary: Summary;
  revisions: Revision[];
  guidance: Guidance;
};

export type DailyRow = Summary & { date: string; forecastPublishedAt: string; forecastLabel: string };

export type SlotRow = { label: string; leadHours: number; days: number; hoursPerDay: number; mae: number; bias: number };

export type Accuracy = {
  cutoff: string;
  days: number;
  metrics: {
    hours: number;
    mae: number;
    rmse: number;
    bias: number;
    maePctOfMean: number;
    maePctOfPeak: number;
    meanActual: number;
    peakActual: number;
    correlation: number | null;
  };
  errorQuantiles: Record<string, number>;
  absErrorQuantiles: Record<string, number>;
  daily: DailyRow[];
  byHour: { hour: number; mae: number; bias: number; n: number }[];
  byLevel: { from: number; to: number; n: number; mae: number; bias: number }[];
  bySlot: SlotRow[];
  histogram: { from: number; to: number; count: number }[];
  scatter: [number, number][];
};
