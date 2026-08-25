import React, { useMemo, useState } from 'react';
import styles from './style.module.css';
import useActivities from '@/hooks/useActivities';
import getSiteMetadata from '@/hooks/useSiteMetadata';
import SharePoster from '@/components/SharePoster';
import {
  buildMonthPoster,
  buildYearPoster,
} from '@/components/SharePoster/content';
import aiSummaryData from '@/static/ai-summary.json';
import { ContextStrip, EmptyState, PageHeader } from './chrome';
import {
  buildDayDetailCard,
  buildHabitDetailCard,
  buildHeartDetailCard,
  buildMonthDetailCard,
  buildRunDetailCard,
  FALLBACK_YEAR,
  getAiSummary,
  getDailyCells,
  getHabitMatrix,
  getInsights,
  getLongestGap,
  getLongestStreak,
  getMonthSummaries,
  getOverviewDetail,
  getTimeBandMatrix,
  normalizeRuns,
  summarizeRuns,
} from './model';
import {
  FrequencyPanel,
  HabitPanel,
  HeartPanel,
  InsightPanel,
  MonthlyVolumePanel,
  PacePanel,
} from './panels';
import type {
  DetailCardData,
  DailyCell,
  MonthSummary,
  RunPoint,
  StaticAiSummary,
} from './model';

const ActivityList: React.FC = () => {
  const { activities } = useActivities();
  const { siteTitle } = getSiteMetadata();
  // "阿崔 Running" → "阿崔"; the cover signs with the name, not the site title.
  const athlete = siteTitle.replace(/\s*Running\s*$/i, '').trim() || siteTitle;
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const yearRuns = useMemo(() => normalizeRuns(activities), [activities]);
  const year = yearRuns[0]?.date.getFullYear() ?? FALLBACK_YEAR;
  const runsByMonth = useMemo(() => {
    const monthMap = new Map<number, RunPoint[]>();
    yearRuns.forEach((run) => {
      const monthRuns = monthMap.get(run.month);
      if (monthRuns) {
        monthRuns.push(run);
        return;
      }
      monthMap.set(run.month, [run]);
    });
    return monthMap;
  }, [yearRuns]);
  const monthSummaries = useMemo(() => getMonthSummaries(yearRuns), [yearRuns]);
  const visibleRuns = useMemo(
    () => (selectedMonth ? (runsByMonth.get(selectedMonth) ?? []) : yearRuns),
    [selectedMonth, runsByMonth, yearRuns]
  );
  const visibleSummary = useMemo(
    () => summarizeRuns(visibleRuns),
    [visibleRuns]
  );
  const dailyCells = useMemo(
    () => getDailyCells(yearRuns, year, selectedMonth),
    [yearRuns, year, selectedMonth]
  );
  const derivedMetrics = useMemo(() => {
    const paceRuns = visibleRuns
      .filter((run) => run.paceSeconds > 0)
      .slice()
      .reverse();
    const heartRuns = visibleRuns
      .filter((run) => run.heartRate !== null)
      .slice()
      .reverse();
    const paceValues = paceRuns.map((run) => run.paceSeconds);
    const paceMin = paceValues.length ? Math.min(...paceValues) : 0;
    const paceMax = paceValues.length ? Math.max(...paceValues) : 0;
    return {
      paceRuns,
      paceValues,
      paceMin,
      paceSpread: Math.max(paceMax - paceMin, 1),
      heartRuns,
      habitMatrix: getHabitMatrix(visibleRuns),
      timeBandMatrix: getTimeBandMatrix(visibleRuns),
      insights: getInsights(visibleRuns, monthSummaries),
      longestGap: getLongestGap(visibleRuns),
      longestStreak: getLongestStreak(visibleRuns),
    };
  }, [visibleRuns, monthSummaries]);
  const heatmapColumns = Math.ceil(dailyCells.length / 7);
  const maxMonthDistance = Math.max(
    ...monthSummaries.map((item) => item.distance),
    1
  );
  const peakMonth = useMemo(
    () =>
      monthSummaries.reduce((best, item) =>
        item.distance > best.distance ? item : best
      ).month,
    [monthSummaries]
  );
  const overviewDetail = useMemo(
    () =>
      getOverviewDetail(
        year,
        selectedMonth,
        visibleSummary,
        derivedMetrics.longestStreak,
        derivedMetrics.longestGap
      ),
    [
      year,
      selectedMonth,
      visibleSummary,
      derivedMetrics.longestStreak,
      derivedMetrics.longestGap,
    ]
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
      derivedMetrics.insights,
      visibleSummary,
      derivedMetrics.longestStreak
    );
  }, [
    year,
    selectedMonth,
    derivedMetrics.insights,
    visibleSummary,
    derivedMetrics.longestStreak,
  ]);
  const aiSummaryMeta = aiSummaryData as StaticAiSummary;
  const [selectedDetail, setSelectedDetail] = useState<DetailCardData | null>(
    null
  );
  const [isSharing, setIsSharing] = useState(false);
  // The cover follows whatever the page is showing: a month view shares that
  // month, the year view shares the year.
  const posterContent = useMemo(
    () =>
      selectedMonth
        ? buildMonthPoster(activities, year, selectedMonth, athlete)
        : buildYearPoster(activities, year, athlete),
    [activities, year, selectedMonth, athlete]
  );
  const detailCard = selectedDetail ?? overviewDetail;
  const selectYearView = () => {
    setSelectedMonth(null);
    setSelectedDetail(null);
  };
  const selectMonthView = () => {
    setSelectedMonth(selectedMonth ?? peakMonth);
    setSelectedDetail(null);
  };
  const toggleMonth = (month: MonthSummary, isSelected: boolean) => {
    if (isSelected) {
      selectYearView();
      return;
    }
    setSelectedMonth(month.month);
    setSelectedDetail(
      buildMonthDetailCard(
        month,
        month.count > 0
          ? '当前视图已切换到这个月份。'
          : '这个月份还没有跑步记录。'
      )
    );
  };
  const selectDay = (cell: DailyCell) =>
    setSelectedDetail(buildDayDetailCard(cell));
  const selectPaceRun = (run: RunPoint) =>
    setSelectedDetail(buildRunDetailCard('Pace Note', run));
  const selectHeartRun = (run: RunPoint, rate: number) =>
    setSelectedDetail(buildHeartDetailCard(run, rate));
  const selectHabit = (
    eyebrow: string,
    title: string,
    subtitle: string,
    count: number,
    totalCount: number
  ) =>
    setSelectedDetail(
      buildHabitDetailCard(eyebrow, title, subtitle, count, totalCount)
    );

  if (!yearRuns.length) {
    return (
      <EmptyState
        title="还没有足够的跑步记录形成节奏。"
        subtitle="同步完成后，这里会显示你的训练洞察。"
      />
    );
  }

  return (
    <main className={styles.activityList}>
      <PageHeader
        year={year}
        selectedMonth={selectedMonth}
        onSelectYear={selectYearView}
        onSelectMonth={selectMonthView}
        onShare={() => setIsSharing(true)}
      />

      <ContextStrip
        selectedMonth={selectedMonth}
        count={visibleSummary.count}
        distance={visibleSummary.distance}
        averagePaceSeconds={visibleSummary.averagePaceSeconds}
        averageHeartRate={visibleSummary.averageHeartRate}
      />

      <FrequencyPanel
        selectedMonth={selectedMonth}
        detailCard={detailCard}
        dailyCells={dailyCells}
        heatmapColumns={heatmapColumns}
        onSelectDay={selectDay}
      />

      <section className={styles.splitGrid}>
        <MonthlyVolumePanel
          monthSummaries={monthSummaries}
          maxMonthDistance={maxMonthDistance}
          selectedMonth={selectedMonth}
          onToggleMonth={toggleMonth}
        />
        <PacePanel
          paceRuns={derivedMetrics.paceRuns}
          paceValues={derivedMetrics.paceValues}
          paceMin={derivedMetrics.paceMin}
          paceSpread={derivedMetrics.paceSpread}
          paceLabel={derivedMetrics.insights.paceLabel}
          onSelectRun={selectPaceRun}
        />
      </section>

      <section className={styles.splitGrid}>
        <HeartPanel
          heartRuns={derivedMetrics.heartRuns}
          heartRateLabel={derivedMetrics.insights.heartRateLabel}
          onSelectHeartRun={selectHeartRun}
        />
        <HabitPanel
          longestStreak={derivedMetrics.longestStreak}
          longestGap={derivedMetrics.longestGap}
          habitMatrix={derivedMetrics.habitMatrix}
          timeBandMatrix={derivedMetrics.timeBandMatrix}
          totalRuns={visibleRuns.length}
          onSelectHabit={selectHabit}
        />
      </section>

      <InsightPanel
        aiSummary={aiSummary}
        aiSummaryMeta={aiSummaryMeta}
        selectedMonth={selectedMonth}
      />

      {isSharing && (
        <SharePoster
          content={posterContent}
          onClose={() => setIsSharing(false)}
        />
      )}
    </main>
  );
};

export default ActivityList;
