import { TIME_BAND_LABELS, WEEKDAY_LABELS } from './types';
import type { InsightSummary, RunPoint, TimeBand } from './types';

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

export const getInsights = (runs: readonly RunPoint[]): InsightSummary => {
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

  const paceLabel = (() => {
    const paceRuns = runs.filter((run) => run.paceSeconds > 0);
    if (paceRuns.length < 12) return '样本不足 12 次，暂不比较配速变化。';
    const recentPace = getAverage(
      paceRuns.slice(0, 6).map((run) => run.paceSeconds)
    );
    const earlierPace = getAverage(
      paceRuns.slice(6, 12).map((run) => run.paceSeconds)
    );
    return `最近 6 次与更早 6 次平均配速相差 ${Math.round(Math.abs(recentPace - earlierPace))} 秒/公里。`;
  })();

  const heartRates = runs
    .map((run) => run.heartRate)
    .filter((rate): rate is number => rate !== null);
  const heartRateLabel = heartRates.length
    ? `心率记录 ${heartRates.length}/${runs.length} 次，平均 ${Math.round(getAverage(heartRates))} bpm；未设个人基线，不判断强度。`
    : null;

  return {
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
