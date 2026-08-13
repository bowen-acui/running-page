export type TimeBand = 'dawn' | 'morning' | 'afternoon' | 'night';

export interface RunPoint {
  readonly id: number;
  readonly name: string;
  readonly date: Date;
  readonly dateKey: string;
  readonly month: number;
  readonly weekday: number;
  readonly timeBand: TimeBand;
  readonly distance: number;
  readonly seconds: number;
  readonly paceSeconds: number;
  readonly heartRate: number | null;
}

export interface MonthSummary {
  readonly month: number;
  readonly distance: number;
  readonly count: number;
  readonly averagePaceSeconds: number;
  readonly averageHeartRate: number | null;
}

export interface DailyCell {
  readonly kind: 'day';
  readonly key: string;
  readonly label: string;
  readonly distance: number;
  readonly count: number;
  readonly level: number;
}

export interface BlankCell {
  readonly kind: 'blank';
  readonly blankKey: string;
}

export type HeatmapCell = DailyCell | BlankCell;

export interface InsightSummary {
  readonly stableMonth: number | null;
  readonly highFrequencyDays: readonly string[];
  readonly highFrequencyBands: readonly string[];
  readonly paceLabel: string;
  readonly heartRateLabel: string | null;
}

export interface DetailRow {
  readonly label: string;
  readonly value: string;
}

export interface DetailCardData {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly rows: readonly DetailRow[];
}

export interface StaticAiSummary {
  readonly generatedAt: string | null;
  readonly source: 'deepseek' | 'local';
  readonly model: string;
  readonly fallbackReason: string | null;
  readonly trainingGoal?: string;
  readonly items: readonly string[];
}

export const WEEKDAY_LABELS = [
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
  '周日',
] as const;

export const MONTH_LABELS = Array.from(
  { length: 12 },
  (_, index) => `${index + 1}月`
);

export const TIME_BAND_LABELS: Record<TimeBand, string> = {
  dawn: '清晨',
  morning: '上午',
  afternoon: '午后',
  night: '夜间',
};

export const FALLBACK_YEAR = new Date().getFullYear();
