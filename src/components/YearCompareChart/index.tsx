import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import useActivities from '@/hooks/useActivities';
import { DIST_UNIT, isRunActivity, M_TO_DIST } from '@/utils/utils';

interface MonthPoint {
  month: number;
  [year: string]: number | null;
}

const cumulativeByMonth = (
  activities: ReturnType<typeof useActivities>['activities'],
  targetYear: string
) => {
  const sums = Array<number>(12).fill(0);
  activities.filter(isRunActivity).forEach((run) => {
    if (run.start_date_local.slice(0, 4) !== targetYear) return;
    const monthIndex = parseInt(run.start_date_local.slice(5, 7), 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      sums[monthIndex] += run.distance / M_TO_DIST;
    }
  });
  let total = 0;
  return sums.map((distance) => {
    total += distance;
    return Math.round(total * 10) / 10;
  });
};

const YearCompareChart = ({ year }: { year: string }) => {
  const { activities, years } = useActivities();
  const prevYear = String(Number(year) - 1);
  const hasPrevYear = years.includes(prevYear);

  const data = useMemo<MonthPoint[]>(() => {
    const current = cumulativeByMonth(activities, year);
    const previous = hasPrevYear
      ? cumulativeByMonth(activities, prevYear)
      : null;
    const now = new Date();
    const isOngoingYear = String(now.getFullYear()) === year;

    return Array.from({ length: 12 }, (_, i) => {
      const point: MonthPoint = { month: i + 1 };
      point[year] = isOngoingYear && i > now.getMonth() ? null : current[i];
      if (previous) point[prevYear] = previous[i];
      return point;
    });
  }, [activities, year, prevYear, hasPrevYear]);

  if (!/^\d{4}$/.test(year)) return null;
  const hasData = data.some((point) => (point[year] ?? 0) > 0);
  if (!hasData) return null;

  return (
    <section className="mb-4 rounded-2xl border border-[color:var(--color-primary)]/8 bg-[color:var(--color-background)]/26 px-3 pt-3 pb-1 sm:px-4">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[0.6rem] font-bold tracking-[0.14em] text-[color:var(--color-run-date)]/66 uppercase">
          Cumulative Distance ({DIST_UNIT})
        </span>
        <span className="flex items-center gap-3 text-[0.62rem] font-semibold text-[color:var(--color-run-date)]/72">
          <span className="flex items-center gap-1">
            <i className="inline-block h-[2px] w-4 bg-[color:var(--color-primary)]" />
            {year}
          </span>
          {hasPrevYear && (
            <span className="flex items-center gap-1">
              <i className="inline-block h-[2px] w-4 border-t-2 border-dashed border-[color:var(--color-run-date)]/55" />
              {prevYear}
            </span>
          )}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={170}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -14 }}
          accessibilityLayer={false}
        >
          <CartesianGrid
            stroke="var(--color-hr-primary)"
            strokeOpacity={0.45}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickFormatter={(m: number) => `${m}月`}
            tick={{ fill: 'var(--color-run-date)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={1}
          />
          <YAxis
            tick={{ fill: 'var(--color-run-date)', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value) => [`${String(value ?? 0)} ${DIST_UNIT}`]}
            labelFormatter={(m) => `1 - ${String(m)} 月`}
            contentStyle={{
              background: 'var(--color-background)',
              border:
                '1px solid color-mix(in srgb, var(--color-primary) 14%, transparent)',
              borderRadius: '0.7rem',
              fontSize: '0.72rem',
              color: 'var(--color-text-primary)',
            }}
          />
          {hasPrevYear && (
            <Line
              type="monotone"
              dataKey={prevYear}
              stroke="var(--color-run-date)"
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey={year}
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
};

export default YearCompareChart;
