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

interface MetricProps {
  label: string;
  unit?: string;
  value: number | string;
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

const Metric = ({ label, unit, value }: MetricProps) => (
  <div className="flex min-h-[5.25rem] flex-col justify-between rounded-2xl border border-[color:var(--color-hr-primary)]/10 bg-[color:var(--color-background)]/35 px-3 py-2.5 sm:min-h-[5.75rem] sm:px-3.5">
    <span className="text-[0.68rem] font-bold tracking-[0.14em] text-[color:var(--color-run-date)] uppercase not-italic">
      {label}
    </span>
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="text-[clamp(1.65rem,7vw,2.85rem)] leading-none font-black tracking-[-0.04em] text-[color:var(--color-text-primary)] not-italic">
        {intComma(value.toString())}
      </span>
      {unit && (
        <span className="text-xs font-black tracking-[-0.02em] text-[color:var(--color-text-primary)]/75 uppercase sm:text-sm">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const YearStat = ({
  year,
  onClick,
}: {
  year: string;
  onClick: (_year: string) => void;
}) => {
  const { activities } = useActivities();
  const summary = getYearStatSummaries(activities).get(year);
  const titleLabel = year === 'Total' ? 'All Time' : 'Journey';

  if (!summary) return null;

  return (
    <div
      className="cursor-pointer rounded-[1.7rem] border border-[color:var(--color-hr-primary)]/20 bg-[color:var(--color-run-row-hover-background)]/18 p-4 transition-transform duration-200 hover:-translate-y-0.5 sm:p-5"
      onClick={() => onClick(year)}
    >
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[0.68rem] font-bold tracking-[0.18em] text-[color:var(--color-run-date)] uppercase">
              {titleLabel}
            </p>
            <h2 className="text-[clamp(2.2rem,9vw,3.8rem)] leading-none font-black tracking-[-0.05em] text-[color:var(--color-text-primary)]">
              {year}
            </h2>
          </div>
          <div className="pb-1 text-right">
            <p className="text-[0.68rem] font-bold tracking-[0.18em] text-[color:var(--color-run-date)] uppercase">
              Runs
            </p>
            <p className="text-[clamp(1.85rem,7vw,3rem)] leading-none font-black tracking-[-0.04em] text-[color:var(--color-text-primary)]">
              {intComma(summary.runCount.toString())}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Metric
            value={summary.totalDistance}
            unit={DIST_UNIT}
            label="Distance"
          />
          <Metric value={summary.averagePace} label="Avg Pace" />
          <Metric value={summary.streak} unit="day" label="Streak" />
          {summary.hasHeartRate && (
            <Metric
              value={summary.averageHeartRate}
              unit="bpm"
              label="Avg HR"
            />
          )}
        </div>
        {SHOW_ELEVATION_GAIN && (
          <Metric value={summary.totalElevationGain} label="Elevation" />
        )}
      </section>
    </div>
  );
};

export default YearStat;
