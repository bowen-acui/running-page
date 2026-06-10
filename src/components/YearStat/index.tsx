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
  <div className="flex min-h-[4.1rem] flex-col justify-between rounded-2xl border border-[color:var(--color-primary)]/8 bg-[color:var(--color-background)]/38 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:min-h-[4.55rem]">
    <span className="text-[0.58rem] font-semibold tracking-[0.1em] text-[color:var(--color-run-date)]/66 uppercase not-italic">
      {label}
    </span>
    <div className="flex items-baseline gap-1.5 font-[family:var(--font-display)] whitespace-nowrap">
      <span className="text-[clamp(1.18rem,4.6vw,1.74rem)] leading-none font-semibold tracking-[-0.018em] text-[color:var(--color-text-primary)] not-italic">
        {intComma(value.toString())}
      </span>
      {unit && (
        <span className="text-[0.62rem] font-medium tracking-[0.01em] text-[color:var(--color-text-primary)]/55 uppercase sm:text-[0.7rem]">
          {unit}
        </span>
      )}
    </div>
  </div>
);

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
  const titleLabel = year === 'Total' ? 'All Time' : 'Journey';

  if (!summary) return null;

  const selectedClass = selected
    ? 'border-[color:var(--color-primary)]/32 ring-1 ring-[color:var(--color-primary)]/22'
    : 'border-[color:var(--color-primary)]/10';

  return (
    <div
      className={`cursor-pointer overflow-hidden rounded-[1.7rem] border ${selectedClass} bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-run-row-hover-background)_46%,white_18%),color-mix(in_srgb,var(--color-background)_88%,transparent))] p-3 shadow-[0_16px_46px_rgba(7,54,76,0.055)] transition-transform duration-200 hover:-translate-y-0.5 sm:p-3.5`}
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
      <section className="space-y-2.5">
        <div className="flex items-start justify-between gap-4 rounded-2xl bg-[color:var(--color-background)]/26 px-3 py-2.5">
          <div>
            <p className="text-[0.58rem] font-semibold tracking-[0.12em] text-[color:var(--color-run-date)]/66 uppercase">
              {titleLabel}
            </p>
            <h2 className="text-[clamp(1.45rem,5.5vw,2.2rem)] leading-none font-[family:var(--font-display)] font-semibold tracking-[-0.026em] text-[color:var(--color-text-primary)]">
              {year}
            </h2>
          </div>
          <div className="flex flex-col items-end px-0.5 py-0.5 text-right">
            <p className="text-[0.56rem] font-semibold tracking-[0.12em] text-[color:var(--color-run-date)]/66 uppercase">
              Runs
            </p>
            <p className="text-[clamp(1.18rem,4.8vw,1.76rem)] leading-none font-[family:var(--font-display)] font-semibold tracking-[-0.018em] text-[color:var(--color-text-primary)]">
              {intComma(summary.runCount.toString())}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
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
