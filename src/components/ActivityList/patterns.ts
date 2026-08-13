import { TIME_BAND_LABELS, WEEKDAY_LABELS } from './types';
import type { InsightSummary, MonthSummary, RunPoint, TimeBand } from './types';

const getAverage = (values: readonly number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

export const getHabitMatrix = (runs: readonly RunPoint[]) => {
  const counts = Array.from({ length: WEEKDAY_LABELS.length }, () => 0);
  runs.forEach((run) => {
    counts[run.weekday] += 1;
  });
  return WEEKDAY_LABELS.map((weekday, weekdayIndex) => ({
    label: weekday,
    count: counts[weekdayIndex],
  }));
};

export const getTimeBandMatrix = (runs: readonly RunPoint[]) => {
  const counts: Record<TimeBand, number> = {
    dawn: 0,
    morning: 0,
    afternoon: 0,
    night: 0,
  };
  runs.forEach((run) => {
    counts[run.timeBand] += 1;
  });
  return (Object.keys(TIME_BAND_LABELS) as TimeBand[]).map((band) => ({
    label: TIME_BAND_LABELS[band],
    count: counts[band],
  }));
};

export const getInsights = (
  runs: readonly RunPoint[],
  months: readonly MonthSummary[]
): InsightSummary => {
  const activeMonths = months.filter((month) => month.count > 0);
  const stableMonth =
    activeMonths.length > 0
      ? activeMonths.reduce((best, month) => {
          const bestAverage = best.distance / best.count;
          const currentAverage = month.distance / month.count;
          return currentAverage > bestAverage ? month : best;
        }).month
      : null;

  const weekdayCounts = getHabitMatrix(runs);
  const maxWeekdayCount = Math.max(
    ...weekdayCounts.map((item) => item.count),
    0
  );
  const highFrequencyDays = weekdayCounts
    .filter((item) => item.count === maxWeekdayCount && item.count > 0)
    .slice(0, 2)
    .map((item) => item.label);

  const timeCounts = getTimeBandMatrix(runs);
  const maxTimeCount = Math.max(...timeCounts.map((item) => item.count), 0);
  const highFrequencyBands = timeCounts
    .filter((item) => item.count === maxTimeCount && item.count > 0)
    .slice(0, 2)
    .map((item) => item.label);

  const recent = runs.slice(0, Math.min(6, runs.length));
  const early = [...runs].slice(-Math.min(6, runs.length));
  const recentPace = getAverage(recent.map((run) => run.paceSeconds));
  const earlyPace = getAverage(early.map((run) => run.paceSeconds));
  const paceLabel =
    runs.length < 4
      ? '样本较少，暂不判断配速稳定性。'
      : recentPace && earlyPace && Math.abs(recentPace - earlyPace) < 15
        ? '最近配速较稳定。'
        : recentPace && earlyPace && recentPace < earlyPace
          ? '最近配速略有提升。'
          : '最近配速波动略大。';

  const heartRates = runs
    .map((run) => run.heartRate)
    .filter((rate): rate is number => rate !== null);
  const heartRateLabel =
    heartRates.length < 3
      ? null
      : getAverage(heartRates) >= 170
        ? '有心率记录的跑步强度略高。'
        : '有心率记录的跑步强度较克制。';

  return {
    stableMonth,
    highFrequencyDays,
    highFrequencyBands,
    paceLabel,
    heartRateLabel,
  };
};

export const getChartPath = (
  values: readonly number[],
  width: number,
  height: number
) => {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  return values
    .map((value, index) => {
      const x =
        values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / spread) * (height - 16) - 8;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};
