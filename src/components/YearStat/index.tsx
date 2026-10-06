import useActivities from '@/hooks/useActivities';
import type { Activity } from '@/utils/utils';
import {
  DIST_UNIT,
  formatPace,
  intComma,
  isRunActivity,
  M_TO_DIST,
  M_TO_ELEV,
} from '@/utils/utils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';

interface YearStatAccumulator {
  averageHeartRateTotal: number;
  heartRateNullCount: number;
  runCount: number;
  streak: number;
  totalDistance: number;
  totalElevationGain: number;
  totalMetersForPace: number;
  totalSecondsForPace: number;
}

interface YearStatSummary {
  averageHeartRate: string;
  averagePace: string;
  hasHeartRate: boolean;
  runCount: number;
  streak: number;
  totalDistance: number;
  totalElevationGain: string;
}

const createAccumulator = (): YearStatAccumulator => ({
  averageHeartRateTotal: 0,
  heartRateNullCount: 0,
  runCount: 0,
  streak: 0,
  totalDistance: 0,
  totalElevationGain: 0,
  totalMetersForPace: 0,
  totalSecondsForPace: 0,
});

const addRunToAccumulator = (
  accumulator: YearStatAccumulator,
  run: Activity
) => {
  accumulator.runCount += 1;
  accumulator.totalDistance += run.distance || 0;
  accumulator.totalElevationGain += run.elevation_gain || 0;

  if (run.average_speed) {
    accumulator.totalMetersForPace += run.distance || 0;
    accumulator.totalSecondsForPace += (run.distance || 0) / run.average_speed;
  }

  if (run.average_heartrate) {
    accumulator.averageHeartRateTotal += run.average_heartrate;
  } else {
    accumulator.heartRateNullCount += 1;
  }

  if (run.streak) {
    accumulator.streak = Math.max(accumulator.streak, run.streak);
  }
};

const finalizeYearStat = (
  accumulator: YearStatAccumulator
): YearStatSummary => {
  const heartRateCount = accumulator.runCount - accumulator.heartRateNullCount;

  return {
    averageHeartRate: (
      accumulator.averageHeartRateTotal / heartRateCount
    ).toFixed(0),
    averagePace: formatPace(
      accumulator.totalMetersForPace / accumulator.totalSecondsForPace
    ),
    hasHeartRate: accumulator.averageHeartRateTotal !== 0,
    runCount: accumulator.runCount,
    streak: accumulator.streak,
    totalDistance: parseFloat(
      (accumulator.totalDistance / M_TO_DIST).toFixed(1)
    ),
    totalElevationGain: (accumulator.totalElevationGain * M_TO_ELEV).toFixed(0),
  };
};

const yearStatCache = new WeakMap<Activity[], Map<string, YearStatSummary>>();

const getYearStatSummaries = (activityData: Activity[]) => {
  const cachedSummaries = yearStatCache.get(activityData);
  if (cachedSummaries) return cachedSummaries;

  const accumulators = new Map<string, YearStatAccumulator>();
  accumulators.set('Total', createAccumulator());

  activityData.filter(isRunActivity).forEach((run) => {
    const year = run.start_date_local.slice(0, 4);
    if (!accumulators.has(year)) {
      accumulators.set(year, createAccumulator());
    }
    addRunToAccumulator(accumulators.get('Total')!, run);
    addRunToAccumulator(accumulators.get(year)!, run);
  });

  const summaries = new Map(
    Array.from(accumulators, ([year, accumulator]) => [
      year,
      finalizeYearStat(accumulator),
    ])
  );
  yearStatCache.set(activityData, summaries);
  return summaries;
};

const YearStat = ({
  year,
  onClick,
  selected = false,
}: {
  year: string;
  onClick: (_year: string) => void;
  selected?: boolean;
}) => {
  const { activities } = useActivities();
  const summary = getYearStatSummaries(activities).get(year);
  const titleLabel = year === 'Total' ? '全部跑步' : '年度跑步';

  if (!summary) return null;

  const selectedClass = selected
    ? 'border-[color:var(--color-primary)]/18'
    : 'border-[color:var(--color-primary)]/8';

  return (
    <div
      className={`cursor-pointer overflow-hidden rounded-[1.7rem] border ${selectedClass} bg-[color-mix(in_srgb,var(--color-background)_92%,var(--color-run-row-hover-background)_8%)] p-4 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--color-background)_86%,var(--color-run-row-hover-background)_14%)] sm:p-5`}
      onClick={() => onClick(year)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick(year);
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[color:var(--color-run-date)]/72">
              {titleLabel}
            </p>
            <h2 className="mt-1 text-[clamp(1.6rem,5.5vw,2.2rem)] leading-none font-[family:var(--font-display)] font-semibold tracking-[-0.026em] text-[color:var(--color-text-primary)] tabular-nums">
              {year}
            </h2>
          </div>
          <div className="flex flex-col items-end text-right">
            <p className="text-xs font-medium text-[color:var(--color-run-date)]/72">
              跑步次数
            </p>
            <p className="mt-1 text-[clamp(1.35rem,4.8vw,1.7rem)] leading-none font-[family:var(--font-display)] font-semibold tracking-[-0.018em] text-[color:var(--color-text-primary)] tabular-nums">
              {intComma(summary.runCount.toString())}
            </p>
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-[color:var(--color-hr-primary)]/65 pt-3">
          <div>
            <span className="text-xs font-medium text-[color:var(--color-run-date)]/72">
              累计距离
            </span>
            <p className="mt-1 flex items-baseline gap-1.5 font-[family:var(--font-display)]">
              <strong
                className={`text-[clamp(1.7rem,5vw,2rem)] leading-none font-semibold tracking-[-0.04em] text-[color:var(--color-text-primary)] tabular-nums ${selected ? 'sm:text-[clamp(2rem,7vw,2.8rem)]' : ''}`}
              >
                {intComma(summary.totalDistance.toString())}
              </strong>
              <span className="text-sm font-medium text-[color:var(--color-text-primary)]/65">
                {DIST_UNIT}
              </span>
            </p>
          </div>
          {selected && (
            <p className="pb-1 text-sm text-[color:var(--color-run-date)]/74">
              平均配速{' '}
              <strong className="font-[family:var(--font-display)] font-semibold text-[color:var(--color-text-primary)] tabular-nums">
                {summary.averagePace}
              </strong>
              <span className="ml-1">/{DIST_UNIT}</span>
            </p>
          )}
        </div>
        {selected && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[color:var(--color-hr-primary)]/65 pt-3 text-sm text-[color:var(--color-run-date)]/76">
            <span>
              连续跑步{' '}
              <strong className="font-[family:var(--font-display)] font-semibold text-[color:var(--color-text-primary)] tabular-nums">
                {summary.streak}
              </strong>{' '}
              天
            </span>
            {summary.hasHeartRate && (
              <span>
                平均心率{' '}
                <strong className="font-[family:var(--font-display)] font-semibold text-[color:var(--color-text-primary)] tabular-nums">
                  {summary.averageHeartRate}
                </strong>{' '}
                bpm
              </span>
            )}
            {SHOW_ELEVATION_GAIN && (
              <span>
                累计爬升{' '}
                <strong className="font-[family:var(--font-display)] font-semibold text-[color:var(--color-text-primary)] tabular-nums">
                  {summary.totalElevationGain}
                </strong>{' '}
                m
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default YearStat;
