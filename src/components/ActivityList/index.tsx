import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();

  const allRuns = useMemo(() => normalizeRuns(activities), [activities]);
  const years = useMemo(
    () => [...new Set(allRuns.map((run) => run.date.getFullYear()))],
    [allRuns]
  );
  const latestYear = years[0] ?? FALLBACK_YEAR;
  const requestedYear = Number(searchParams.get('year'));
  const year = years.includes(requestedYear) ? requestedYear : latestYear;
  const requestedMonth = Number(searchParams.get('month'));
  const selectedMonth =
    requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : null;
  useEffect(() => {
    const validMonth = requestedMonth >= 1 && requestedMonth <= 12;
    if (requestedYear === year && (!searchParams.has('month') || validMonth)) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set('year', String(year));
    if (!validMonth) next.delete('month');
    setSearchParams(next, { replace: true });
  }, [requestedMonth, requestedYear, searchParams, setSearchParams, year]);
  const yearRuns = useMemo(
    () => allRuns.filter((run) => run.date.getFullYear() === year),
    [allRuns, year]
  );
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
      insights: getInsights(visibleRuns),
      longestGap: getLongestGap(visibleRuns),
      longestStreak: getLongestStreak(visibleRuns),
    };
  }, [visibleRuns]);
  const heatmapColumns = Math.ceil(dailyCells.length / 7);
  const maxMonthDistance = Math.max(
    ...monthSummaries.map((item) => item.distance),
    1
  );
  const aiSummaryMeta = aiSummaryData as StaticAiSummary;
  const usesStaticSummary = Boolean(
    !selectedMonth &&
    year === latestYear &&
    aiSummaryMeta.generatedAt &&
    aiSummaryMeta.items.length &&
    aiSummaryMeta.sourceRunCount === yearRuns.length &&
    String(aiSummaryMeta.sourceLatestRunId ?? '') ===
      String(yearRuns[0]?.id ?? '')
  );
  const aiSummary = useMemo(() => {
    if (usesStaticSummary) {
      return aiSummaryMeta.items.slice(0, 3);
    }
    return getAiSummary(
      year,
      selectedMonth,
      derivedMetrics.insights,
      visibleSummary
    );
  }, [
    year,
    selectedMonth,
    derivedMetrics.insights,
    visibleSummary,
    usesStaticSummary,
    aiSummaryMeta.items,
  ]);
  const aiSummarySource = selectedMonth
    ? '本月数据整理'
    : usesStaticSummary && aiSummaryMeta.source === 'deepseek'
      ? `DeepSeek · ${aiSummaryMeta.model}`
      : '基于跑步记录生成';
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
  const selectYearView = () => {
    setSearchParams({ year: String(year) });
    setSelectedDetail(null);
  };
  const selectYearValue = (nextYear: number) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.set('year', String(nextYear));
      return next;
    });
    setSelectedDetail(null);
  };
  const selectMonthView = () => {
    const month = selectedMonth ?? yearRuns[0]?.month;
    if (!month) return;
    setSearchParams({ year: String(year), month: String(month) });
    setSelectedDetail(null);
  };
  const toggleMonth = (month: MonthSummary, isSelected: boolean) => {
    if (isSelected) {
      selectYearView();
      return;
    }
    setSearchParams({ year: String(year), month: String(month.month) });
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
        years={years}
        selectedMonth={selectedMonth}
        onSelectYearValue={selectYearValue}
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
        heartRateSampleSize={visibleSummary.heartRateSampleSize}
      />

      <FrequencyPanel
        selectedMonth={selectedMonth}
        detailCard={selectedDetail}
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
        sourceLabel={aiSummarySource}
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
