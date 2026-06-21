import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './style.module.css';
import { DIST_UNIT, M_TO_DIST } from '@/utils/utils';
import type { Activity } from '@/utils/utils';
import useActivities from '@/hooks/useActivities';
import aiSummaryData from '@/static/ai-summary.json';

interface RunPoint {
  id: number;
  name: string;
  date: Date;
  dateKey: string;
  month: number;
  weekday: number;
  timeBand: TimeBand;
  distance: number;
  seconds: number;
  paceSeconds: number;
  heartRate: number | null;
}

interface MonthSummary {
  month: number;
  distance: number;
  count: number;
  averagePaceSeconds: number;
  averageHeartRate: number | null;
}

interface DailyCell {
  key: string;
  label: string;
  distance: number;
  count: number;
  level: number;
}

interface BlankCell {
  blankKey: string;
}

interface InsightSummary {
  stableMonth: number | null;
  highFrequencyDays: string[];
  highFrequencyBands: string[];
  paceLabel: string;
  heartRateLabel: string | null;
}

interface DetailRow {
  label: string;
  value: string;
}

interface DetailCardData {
  eyebrow: string;
  title: string;
  subtitle: string;
  rows: DetailRow[];
}

interface StaticAiSummary {
  generatedAt: string | null;
  source: 'deepseek' | 'local';
  model: string;
  fallbackReason: string | null;
  items: string[];
}

type TimeBand = 'dawn' | 'morning' | 'afternoon' | 'night';

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const TIME_BAND_LABELS: Record<TimeBand, string> = {
  dawn: '清晨',
  morning: '上午',
  afternoon: '午后',
  night: '夜间',
};
const FALLBACK_YEAR = new Date().getFullYear();

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

const toDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);

const getMondayFirstWeekday = (date: Date) => (date.getDay() + 6) % 7;

const getTimeBand = (hour: number): TimeBand => {
  if (hour < 9) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'night';
};

const formatShortDate = (date: Date) =>
  `${date.getMonth() + 1}月${date.getDate()}日`;

const formatPace = (paceSeconds: number) => {
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) return '-';
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
};

const formatDistance = (distance: number) =>
  `${distance.toFixed(1)} ${DIST_UNIT}`;

const formatHeartRate = (heartRate: number | null) =>
  heartRate !== null ? `${Math.round(heartRate)} bpm` : '无心率';

const normalizeRuns = (activities: Activity[]): RunPoint[] => {
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

const getAverage = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const getAverageNullable = (values: Array<number | null>) => {
  const filtered = values.filter((value): value is number => value !== null);
  return filtered.length ? getAverage(filtered) : null;
};

const summarizeRuns = (runs: RunPoint[]) => {
  const distance = runs.reduce((sum, run) => sum + run.distance, 0);
  const seconds = runs.reduce((sum, run) => sum + run.seconds, 0);
  return {
    count: runs.length,
    distance,
    averagePaceSeconds: distance > 0 ? seconds / distance : 0,
    averageHeartRate: getAverageNullable(runs.map((run) => run.heartRate)),
  };
};

const getMonthSummaries = (runs: RunPoint[]): MonthSummary[] =>
  MONTH_LABELS.map((_, index) => {
    const month = index + 1;
    const monthRuns = runs.filter((run) => run.month === month);
    const summary = summarizeRuns(monthRuns);
    return {
      month,
      distance: summary.distance,
      count: summary.count,
      averagePaceSeconds: summary.averagePaceSeconds,
      averageHeartRate: summary.averageHeartRate,
    };
  });

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

const getDailyCells = (
  runs: RunPoint[],
  year: number,
  month: number | null
): Array<DailyCell | BlankCell> => {
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
        blankKey: `blank-${year}-${month ?? 'year'}-${blankIndex}`,
      }));
  const cells = days.map((date) => {
    const key = toDateKey(date);
    const value = totalsByDay.get(key) ?? { distance: 0, count: 0 };
    return {
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

const getLongestGap = (runs: RunPoint[]) => {
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

const getLongestStreak = (runs: RunPoint[]) => {
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

const getHabitMatrix = (runs: RunPoint[]) =>
  WEEKDAY_LABELS.map((weekday, weekdayIndex) => ({
    label: weekday,
    count: runs.filter((run) => run.weekday === weekdayIndex).length,
  }));

const getTimeBandMatrix = (runs: RunPoint[]) =>
  (Object.keys(TIME_BAND_LABELS) as TimeBand[]).map((band) => ({
    label: TIME_BAND_LABELS[band],
    count: runs.filter((run) => run.timeBand === band).length,
  }));

const getInsights = (
  runs: RunPoint[],
  months: MonthSummary[]
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
    recentPace && earlyPace && Math.abs(recentPace - earlyPace) < 15
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

const getChartPath = (values: number[], width: number, height: number) => {
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

const getOverviewDetail = (
  year: number,
  selectedMonth: number | null,
  summary: ReturnType<typeof summarizeRuns>,
  longestStreak: number,
  longestGap: number
): DetailCardData => ({
  eyebrow: 'Selected View',
  title: selectedMonth ? `${selectedMonth} 月训练摘要` : `${year} 年训练摘要`,
  subtitle: '点击下方图表元素后，这里会同步显示对应的具体数据。',
  rows: [
    { label: '跑步次数', value: `${summary.count} 次` },
    { label: '总距离', value: formatDistance(summary.distance) },
    { label: '平均配速', value: formatPace(summary.averagePaceSeconds) },
    { label: '平均心率', value: formatHeartRate(summary.averageHeartRate) },
    { label: '最长连续', value: `${longestStreak} 天` },
    { label: '最长断档', value: `${longestGap} 天` },
  ],
});

const getAiSummary = (
  year: number,
  selectedMonth: number | null,
  insights: InsightSummary,
  summary: ReturnType<typeof summarizeRuns>,
  longestStreak: number
) => {
  const scopeLabel = selectedMonth ? `${selectedMonth} 月` : `${year} 年`;
  return [
    `${scopeLabel}共完成 ${summary.count} 次跑步，累计 ${formatDistance(summary.distance)}。`,
    insights.stableMonth
      ? `节奏最稳定的月份是 ${insights.stableMonth} 月，连续性最高达到 ${longestStreak} 天。`
      : `当前样本里还没有形成特别稳定的月份，最长连续跑步为 ${longestStreak} 天。`,
    insights.heartRateLabel ?? insights.paceLabel,
  ];
};

const ActivityList: React.FC = () => {
  const { activities } = useActivities();
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const yearRuns = useMemo(() => normalizeRuns(activities), [activities]);
  const year = yearRuns[0]?.date.getFullYear() ?? FALLBACK_YEAR;
  const monthSummaries = useMemo(() => getMonthSummaries(yearRuns), [yearRuns]);
  const visibleRuns = useMemo(
    () =>
      selectedMonth
        ? yearRuns.filter((run) => run.month === selectedMonth)
        : yearRuns,
    [selectedMonth, yearRuns]
  );
  const visibleSummary = useMemo(
    () => summarizeRuns(visibleRuns),
    [visibleRuns]
  );
  const dailyCells = useMemo(
    () => getDailyCells(yearRuns, year, selectedMonth),
    [yearRuns, year, selectedMonth]
  );
  const heatmapColumns = Math.ceil(dailyCells.length / 7);
  const maxMonthDistance = Math.max(
    ...monthSummaries.map((item) => item.distance),
    1
  );
  const paceRuns = visibleRuns
    .filter((run) => run.paceSeconds > 0)
    .slice()
    .reverse();
  const heartRuns = visibleRuns
    .filter((run) => run.heartRate !== null)
    .slice()
    .reverse();
  const habitMatrix = getHabitMatrix(visibleRuns);
  const timeBandMatrix = getTimeBandMatrix(visibleRuns);
  const insights = getInsights(visibleRuns, monthSummaries);
  const longestGap = getLongestGap(visibleRuns);
  const longestStreak = getLongestStreak(visibleRuns);
  const overviewDetail = useMemo(
    () =>
      getOverviewDetail(
        year,
        selectedMonth,
        visibleSummary,
        longestStreak,
        longestGap
      ),
    [year, selectedMonth, visibleSummary, longestStreak, longestGap]
  );
  const aiSummary = useMemo(() => {
    const staticSummary = aiSummaryData as StaticAiSummary;
    if (
      !selectedMonth &&
      staticSummary.generatedAt &&
      staticSummary.items.length
    ) {
      return staticSummary.items.slice(0, 3);
    }
    return getAiSummary(
      year,
      selectedMonth,
      insights,
      visibleSummary,
      longestStreak
    );
  }, [year, selectedMonth, insights, visibleSummary, longestStreak]);
  const aiSummaryMeta = aiSummaryData as StaticAiSummary;
  const [selectedDetail, setSelectedDetail] = useState<DetailCardData | null>(
    null
  );
  const detailCard = selectedDetail ?? overviewDetail;

  if (!yearRuns.length) {
    return (
      <main className={styles.activityList}>
        <section className={styles.emptyState}>
          <p>Running Journal</p>
          <h1>还没有足够的跑步记录形成节奏。</h1>
          <span>同步完成后，这里会显示你的训练洞察。</span>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.activityList}>
      <header className={styles.pageHeader}>
        <div>
          <p>Running Journal</p>
          <h1>跑步节奏</h1>
          <span>
            {year} · {selectedMonth ? `${selectedMonth} 月洞察` : '训练洞察'}
          </span>
        </div>
        <div className={styles.headerActions}>
          <Link to="/" className={styles.homeLink}>
            返回首页
          </Link>
          <div className={styles.viewSwitch} aria-label="视图切换">
            <button
              type="button"
              aria-pressed={!selectedMonth}
              className={!selectedMonth ? styles.activeSwitch : ''}
              onClick={() => {
                setSelectedMonth(null);
                setSelectedDetail(null);
              }}
            >
              年
            </button>
            <button
              type="button"
              aria-pressed={Boolean(selectedMonth)}
              className={selectedMonth ? styles.activeSwitch : ''}
              onClick={() => {
                const peakMonth = monthSummaries.reduce((best, item) =>
                  item.distance > best.distance ? item : best
                ).month;
                setSelectedMonth(selectedMonth ?? peakMonth);
                setSelectedDetail(null);
              }}
            >
              月
            </button>
          </div>
        </div>
      </header>

      <section className={styles.contextStrip} aria-label="当前视图摘要">
        <span>{selectedMonth ? `${selectedMonth} 月` : '全年'}</span>
        <span>{visibleSummary.count} 次</span>
        <span>{formatDistance(visibleSummary.distance)}</span>
        <span>{formatPace(visibleSummary.averagePaceSeconds)}</span>
        <span>
          {visibleSummary.averageHeartRate !== null
            ? `${Math.round(visibleSummary.averageHeartRate)} bpm`
            : '心率不足'}
        </span>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p>Frequency</p>
            <h2>
              {selectedMonth ? `${selectedMonth} 月跑步热力` : '全年跑步热力图'}
            </h2>
          </div>
          <span>点击任意格子可查看当天记录。</span>
        </div>
        <div className={styles.detailCard}>
          <div className={styles.detailCardHeader}>
            <div>
              <p>{detailCard.eyebrow}</p>
              <h3>{detailCard.title}</h3>
            </div>
            <span>{detailCard.subtitle}</span>
          </div>
          <div className={styles.detailGrid}>
            {detailCard.rows.map((row) => (
              <div key={row.label} className={styles.detailItem}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
        <div
          className={`${styles.heatmapGrid} ${
            selectedMonth ? styles.monthHeatmapGrid : ''
          }`}
          style={{
            gridTemplateColumns: selectedMonth
              ? `repeat(${dailyCells.length}, minmax(0, 1fr))`
              : `repeat(${heatmapColumns}, minmax(0, 1fr))`,
          }}
          aria-label="跑步热力图"
        >
          {dailyCells.map((cell) =>
            'key' in cell ? (
              <button
                key={cell.key}
                type="button"
                className={`${styles.heatCell} ${styles[`heatLevel${cell.level}`]}`}
                title={cell.label}
                aria-label={cell.label}
                onClick={() =>
                  setSelectedDetail({
                    eyebrow: 'Day Note',
                    title: formatShortDate(dateFromKey(cell.key)),
                    subtitle: cell.count
                      ? '这一天有实际跑步记录。'
                      : '这一天没有跑步记录。',
                    rows: [
                      { label: '跑步次数', value: `${cell.count} 次` },
                      {
                        label: '总距离',
                        value: `${cell.distance.toFixed(1)} ${DIST_UNIT}`,
                      },
                      {
                        label: '强度层级',
                        value:
                          cell.level === 3
                            ? '高'
                            : cell.level === 2
                              ? '中'
                              : cell.level === 1
                                ? '轻'
                                : '空白',
                      },
                    ],
                  })
                }
              />
            ) : (
              <span key={cell.blankKey} className={styles.blankCell} />
            )
          )}
        </div>
        <div className={styles.legend}>
          <span>少</span>
          <i className={styles.heatLevel0} />
          <i className={styles.heatLevel1} />
          <i className={styles.heatLevel2} />
          <i className={styles.heatLevel3} />
          <span>多</span>
        </div>
      </section>

      <section className={styles.splitGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>Monthly Volume</p>
              <h2>月度跑量</h2>
            </div>
            <span>点击月份可切到该月并查看摘要。</span>
          </div>
          <div className={styles.monthChart}>
            {monthSummaries.map((month) => {
              const height = Math.max(
                6,
                (month.distance / maxMonthDistance) * 100
              );
              const isPeak =
                month.distance === maxMonthDistance && month.distance > 0;
              const isSelected = selectedMonth === month.month;
              return (
                <button
                  key={month.month}
                  type="button"
                  className={`${styles.monthBar} ${isPeak ? styles.peakBar : ''} ${
                    isSelected ? styles.selectedBar : ''
                  }`}
                  aria-pressed={isSelected}
                  title={`${month.month} 月 · ${formatDistance(month.distance)} · ${month.count} 次`}
                  aria-label={`${month.month} 月 · ${formatDistance(month.distance)} · ${month.count} 次`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedMonth(null);
                      setSelectedDetail(null);
                      return;
                    }
                    setSelectedMonth(month.month);
                    setSelectedDetail({
                      eyebrow: 'Month Summary',
                      title: `${month.month} 月跑步摘要`,
                      subtitle: '当前视图已切换到这个月份。',
                      rows: [
                        { label: '跑步次数', value: `${month.count} 次` },
                        {
                          label: '总距离',
                          value: formatDistance(month.distance),
                        },
                        {
                          label: '平均配速',
                          value: formatPace(month.averagePaceSeconds),
                        },
                        {
                          label: '平均心率',
                          value: formatHeartRate(month.averageHeartRate),
                        },
                      ],
                    });
                  }}
                >
                  <i style={{ height: `${height}%` }} />
                  <span>{month.month}</span>
                </button>
              );
            })}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>Pace Stability</p>
              <h2>配速趋势</h2>
            </div>
            <span>{paceRuns.length ? insights.paceLabel : '数据不足'}</span>
          </div>
          {paceRuns.length ? (
            <div className={styles.lineChart}>
              <svg viewBox="0 0 320 150" role="img" aria-label="配速趋势图">
                <path
                  className={styles.gridLine}
                  d="M0 38 H320 M0 75 H320 M0 112 H320"
                />
                <path
                  className={styles.trendPath}
                  d={getChartPath(
                    paceRuns.map((run) => run.paceSeconds),
                    320,
                    150
                  )}
                />
                {paceRuns.map((run, index) => {
                  const values = paceRuns.map((item) => item.paceSeconds);
                  const min = Math.min(...values);
                  const max = Math.max(...values);
                  const spread = Math.max(max - min, 1);
                  const x =
                    values.length === 1
                      ? 160
                      : (index / (values.length - 1)) * 320;
                  const y = 150 - ((run.paceSeconds - min) / spread) * 134 - 8;
                  return (
                    <circle
                      key={run.id}
                      className={styles.chartDot}
                      cx={x}
                      cy={y}
                      r="4"
                      role="button"
                      tabIndex={0}
                      aria-label={`${formatShortDate(run.date)} · ${formatPace(run.paceSeconds)}`}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        setSelectedDetail({
                          eyebrow: 'Pace Note',
                          title: formatShortDate(run.date),
                          subtitle: run.name,
                          rows: [
                            {
                              label: '距离',
                              value: formatDistance(run.distance),
                            },
                            {
                              label: '配速',
                              value: formatPace(run.paceSeconds),
                            },
                            {
                              label: '时长',
                              value: `${Math.round(run.seconds / 60)} min`,
                            },
                            {
                              label: '心率',
                              value: formatHeartRate(run.heartRate),
                            },
                          ],
                        });
                      }}
                      onClick={() =>
                        setSelectedDetail({
                          eyebrow: 'Pace Note',
                          title: formatShortDate(run.date),
                          subtitle: run.name,
                          rows: [
                            {
                              label: '距离',
                              value: formatDistance(run.distance),
                            },
                            {
                              label: '配速',
                              value: formatPace(run.paceSeconds),
                            },
                            {
                              label: '时长',
                              value: `${Math.round(run.seconds / 60)} min`,
                            },
                            {
                              label: '心率',
                              value: formatHeartRate(run.heartRate),
                            },
                          ],
                        })
                      }
                    >
                      <title>
                        {formatShortDate(run.date)} ·{' '}
                        {formatPace(run.paceSeconds)}
                      </title>
                    </circle>
                  );
                })}
              </svg>
            </div>
          ) : (
            <p className={styles.quietEmpty}>配速记录不足，暂不判断稳定性。</p>
          )}
        </article>
      </section>

      <section className={styles.splitGrid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>Heart Rate</p>
              <h2>心率强度</h2>
            </div>
            <span>{insights.heartRateLabel ?? '心率记录不足'}</span>
          </div>
          {heartRuns.length >= 3 ? (
            <div className={styles.heartChart}>
              {heartRuns.map((run) => {
                const rate = run.heartRate ?? 0;
                const height = Math.max(
                  18,
                  Math.min(100, ((rate - 120) / 70) * 100)
                );
                return (
                  <button
                    key={run.id}
                    type="button"
                    className={rate >= 170 ? styles.highHeartBar : ''}
                    title={`${formatShortDate(run.date)} · ${Math.round(rate)} bpm`}
                    aria-label={`${formatShortDate(run.date)} · ${Math.round(rate)} bpm`}
                    onClick={() =>
                      setSelectedDetail({
                        eyebrow: 'Heart Note',
                        title: formatShortDate(run.date),
                        subtitle:
                          rate >= 170
                            ? '这次强度偏高一些。'
                            : '这次心率相对克制。',
                        rows: [
                          {
                            label: '平均心率',
                            value: `${Math.round(rate)} bpm`,
                          },
                          {
                            label: '距离',
                            value: formatDistance(run.distance),
                          },
                          {
                            label: '配速',
                            value: formatPace(run.paceSeconds),
                          },
                        ],
                      })
                    }
                  >
                    <i style={{ height: `${height}%` }} />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className={styles.quietEmpty}>
              心率记录不足，暂不判断训练强度。
            </p>
          )}
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>Habit Rhythm</p>
              <h2>习惯节奏</h2>
            </div>
            <span>
              连续 {longestStreak} 天 · 最长断档 {longestGap} 天
            </span>
          </div>
          <div className={styles.habitMatrix}>
            {habitMatrix.map((item) => (
              <button
                key={item.label}
                type="button"
                title={`${item.label} · ${item.count} 次`}
                aria-label={`${item.label} · ${item.count} 次`}
                onClick={() =>
                  setSelectedDetail({
                    eyebrow: 'Week Rhythm',
                    title: `${item.label} 跑步习惯`,
                    subtitle: '当前视图里的星期分布。',
                    rows: [
                      { label: '跑步次数', value: `${item.count} 次` },
                      {
                        label: '占当前比例',
                        value: visibleRuns.length
                          ? `${Math.round((item.count / visibleRuns.length) * 100)}%`
                          : '0%',
                      },
                    ],
                  })
                }
              >
                <i
                  style={{
                    opacity: item.count
                      ? Math.min(1, 0.24 + item.count / 8)
                      : 0.12,
                  }}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          <div className={styles.timeBandMatrix}>
            {timeBandMatrix.map((item) => (
              <button
                key={item.label}
                type="button"
                title={`${item.label} · ${item.count} 次`}
                aria-label={`${item.label} · ${item.count} 次`}
                onClick={() =>
                  setSelectedDetail({
                    eyebrow: 'Time Habit',
                    title: `${item.label} 节奏`,
                    subtitle: '当前视图里的时间段分布。',
                    rows: [
                      { label: '跑步次数', value: `${item.count} 次` },
                      {
                        label: '占当前比例',
                        value: visibleRuns.length
                          ? `${Math.round((item.count / visibleRuns.length) * 100)}%`
                          : '0%',
                      },
                    ],
                  })
                }
              >
                <i
                  style={{
                    opacity: item.count
                      ? Math.min(1, 0.22 + item.count / 8)
                      : 0.12,
                  }}
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.insightPanel}>
        <div className={`${styles.panelHeader} ${styles.insightHeader}`}>
          <div>
            <p>AI Summary</p>
            <h2>训练建议</h2>
          </div>
          <span>
            {aiSummaryMeta.source === 'deepseek'
              ? `DeepSeek · ${aiSummaryMeta.model}`
              : selectedMonth
                ? '当前月份使用页面内本地洞察。'
                : '本地规则生成，配置 DeepSeek 后会自动替换。'}
          </span>
        </div>
        <div className={styles.insightBody}>
          {aiSummary.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        {aiSummaryMeta.fallbackReason && !selectedMonth && (
          <small className={styles.aiHint}>
            DeepSeek 未生成：{aiSummaryMeta.fallbackReason}
          </small>
        )}
      </section>
    </main>
  );
};

export default ActivityList;
