import { DIST_UNIT, M_TO_DIST } from '@/utils/utils';
import type { Activity } from '@/utils/utils';
import { formatShortDate, toDateKey } from './formatters';
import { FALLBACK_YEAR, MONTH_LABELS } from './types';
import type { HeatmapCell, MonthSummary, RunPoint, TimeBand } from './types';

const isRunningActivity = (activity: Activity) =>
  activity.type === 'Run' || activity.type === 'running';

const toSeconds = (movingTime: string): number => {
  if (!movingTime) return 0;
  const parts = movingTime.split(', ');
  const dayPart = parts.length === 2 ? parseInt(parts[0], 10) : 0;
  const [hours, minutes, seconds] = parts[parts.length - 1]
    .split(':')
    .map(Number);
  return ((dayPart * 24 + hours) * 60 + minutes) * 60 + seconds;
};

const toDistance = (activity: Activity) => activity.distance / M_TO_DIST;

const getMondayFirstWeekday = (date: Date) => (date.getDay() + 6) % 7;

const getTimeBand = (hour: number): TimeBand => {
  if (hour < 9) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
};

const getAverageNullable = (values: ReadonlyArray<number | null>) => {
  const filtered = values.filter((value): value is number => value !== null);
  return filtered.length
    ? filtered.reduce((sum, value) => sum + value, 0) / filtered.length
    : null;
};

export const normalizeRuns = (activities: Activity[]): RunPoint[] => {
  const runs = activities
    .filter(isRunningActivity)
    .map((activity) => {
      const date = new Date(activity.start_date_local.replace(' ', 'T'));
      const distance = toDistance(activity);
      const seconds = toSeconds(activity.moving_time);
      return {
        id: activity.run_id,
        name: activity.name,
        date,
        dateKey: toDateKey(date),
        month: date.getMonth() + 1,
        weekday: getMondayFirstWeekday(date),
        timeBand: getTimeBand(date.getHours()),
        distance,
        seconds,
        paceSeconds: distance > 0 ? seconds / distance : 0,
        heartRate:
          typeof activity.average_heartrate === 'number' &&
          activity.average_heartrate > 0
            ? activity.average_heartrate
            : null,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const latestYear = runs[0]?.date.getFullYear() ?? FALLBACK_YEAR;
  return runs.filter((run) => run.date.getFullYear() === latestYear);
};

export const summarizeRuns = (runs: readonly RunPoint[]) => {
  const distance = runs.reduce((sum, run) => sum + run.distance, 0);
  const seconds = runs.reduce((sum, run) => sum + run.seconds, 0);
  return {
    count: runs.length,
    distance,
    averagePaceSeconds: distance > 0 ? seconds / distance : 0,
    averageHeartRate: getAverageNullable(runs.map((run) => run.heartRate)),
  };
};

export const getMonthSummaries = (
  runs: readonly RunPoint[]
): MonthSummary[] => {
  const monthlyBuckets = MONTH_LABELS.map((_, index) => ({
    month: index + 1,
    distance: 0,
    count: 0,
    seconds: 0,
    heartRateTotal: 0,
    heartRateCount: 0,
  }));

  runs.forEach((run) => {
    const bucket = monthlyBuckets[run.month - 1];
    bucket.distance += run.distance;
    bucket.count += 1;
    bucket.seconds += run.seconds;
    if (run.heartRate !== null) {
      bucket.heartRateTotal += run.heartRate;
      bucket.heartRateCount += 1;
    }
  });

  return monthlyBuckets.map((bucket) => ({
    month: bucket.month,
    distance: bucket.distance,
    count: bucket.count,
    averagePaceSeconds:
      bucket.distance > 0 ? bucket.seconds / bucket.distance : 0,
    averageHeartRate:
      bucket.heartRateCount > 0
        ? bucket.heartRateTotal / bucket.heartRateCount
        : null,
  }));
};

const getDaysInRange = (year: number, month: number | null) => {
  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end = month ? new Date(year, month, 0) : new Date(year, 11, 31);
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

export const getDailyCells = (
  runs: readonly RunPoint[],
  year: number,
  month: number | null
): HeatmapCell[] => {
  const totalsByDay = new Map<string, { distance: number; count: number }>();
  runs.forEach((run) => {
    const current = totalsByDay.get(run.dateKey) ?? { distance: 0, count: 0 };
    current.distance += run.distance;
    current.count += 1;
    totalsByDay.set(run.dateKey, current);
  });

  const days = getDaysInRange(year, month);
  const leadingBlanks = month
    ? []
    : Array.from({
        length: getMondayFirstWeekday(days[0]),
      }).map((_, blankIndex) => ({
        kind: 'blank' as const,
        blankKey: `blank-${year}-${month ?? 'year'}-${blankIndex}`,
      }));

  const cells = days.map((date) => {
    const key = toDateKey(date);
    const value = totalsByDay.get(key) ?? { distance: 0, count: 0 };
    return {
      kind: 'day' as const,
      key,
      distance: value.distance,
      count: value.count,
      level:
        value.distance >= 6
          ? 3
          : value.distance >= 3
            ? 2
            : value.distance > 0
              ? 1
              : 0,
      label: `${formatShortDate(date)} · ${value.count} 次 · ${value.distance.toFixed(1)} ${DIST_UNIT}`,
    };
  });

  return [...leadingBlanks, ...cells];
};

export const getLongestGap = (runs: readonly RunPoint[]) => {
  const dayTimes = Array.from(
    new Set(
      runs.map((run) => {
        const date = new Date(run.date);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    )
  ).sort((a, b) => a - b);

  let longest = 0;
  for (let index = 1; index < dayTimes.length; index += 1) {
    const gap =
      Math.round((dayTimes[index] - dayTimes[index - 1]) / 86400000) - 1;
    longest = Math.max(longest, gap);
  }
  return longest;
};

export const getLongestStreak = (runs: readonly RunPoint[]) => {
  const dayTimes = Array.from(
    new Set(
      runs.map((run) => {
        const date = new Date(run.date);
        date.setHours(0, 0, 0, 0);
        return date.getTime();
      })
    )
  ).sort((a, b) => a - b);

  let longest = 0;
  let current = 0;
  let previous = 0;
  dayTimes.forEach((time) => {
    current = previous && time - previous === 86400000 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = time;
  });
  return longest;
};
