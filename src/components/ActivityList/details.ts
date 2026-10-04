import { DIST_UNIT } from '@/utils/utils';
import {
  dateFromKey,
  formatDistance,
  formatHeartRate,
  formatPace,
  formatShortDate,
  getHeatLevelLabel,
} from './formatters';
import type {
  DailyCell,
  DetailCardData,
  DetailRow,
  InsightSummary,
  MonthSummary,
  RunPoint,
} from './types';
import { summarizeRuns } from './analytics';

export const getOverviewDetail = (
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
    {
      label: '心率样本',
      value: `${summary.heartRateSampleSize}/${summary.count} 次`,
    },
    { label: '最长连续', value: `${longestStreak} 天` },
    { label: '最长断档', value: `${longestGap} 天` },
  ],
});

export const getAiSummary = (
  year: number,
  selectedMonth: number | null,
  insights: InsightSummary,
  summary: ReturnType<typeof summarizeRuns>
) => {
  const scopeLabel = selectedMonth ? `${selectedMonth} 月` : `${year} 年`;
  return [
    `${scopeLabel}共完成 ${summary.count} 次跑步，累计 ${formatDistance(summary.distance)}。`,
    insights.highFrequencyDays.length
      ? `这段记录中较常在 ${insights.highFrequencyDays.join('、')} 跑步。`
      : '这段记录还没有足够的跑步日数据。',
    summary.heartRateSampleSize
      ? `心率记录 ${summary.heartRateSampleSize}/${summary.count} 次，平均 ${formatHeartRate(summary.averageHeartRate)}；未设个人基线，不判断强度。`
      : '心率记录不足，暂不判断强度。',
  ];
};

export const buildDayDetailCard = (cell: DailyCell): DetailCardData => ({
  eyebrow: 'Day Note',
  title: formatShortDate(dateFromKey(cell.key)),
  subtitle: cell.count ? '这一天有实际跑步记录。' : '这一天没有跑步记录。',
  rows: [
    { label: '跑步次数', value: `${cell.count} 次` },
    {
      label: '总距离',
      value: `${cell.distance.toFixed(1)} ${DIST_UNIT}`,
    },
    {
      label: '强度层级',
      value: getHeatLevelLabel(cell.level),
    },
  ],
});

export const buildMonthDetailCard = (
  month: MonthSummary,
  subtitle: string
): DetailCardData => ({
  eyebrow: 'Month Summary',
  title: `${month.month} 月跑步摘要`,
  subtitle,
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
    {
      label: '心率样本',
      value: `${month.heartRateSampleSize}/${month.count} 次`,
    },
  ],
});

export const buildRunDetailCard = (
  eyebrow: string,
  run: RunPoint,
  extraRows: readonly DetailRow[] = []
): DetailCardData => ({
  eyebrow,
  title: formatShortDate(run.date),
  subtitle: run.name,
  rows: [
    { label: '距离', value: formatDistance(run.distance) },
    { label: '配速', value: formatPace(run.paceSeconds) },
    { label: '时长', value: `${Math.round(run.seconds / 60)} min` },
    { label: '心率', value: formatHeartRate(run.heartRate) },
    ...extraRows,
  ],
});

export const buildHeartDetailCard = (
  run: RunPoint,
  heartRate: number
): DetailCardData => ({
  eyebrow: 'Heart Note',
  title: formatShortDate(run.date),
  subtitle: '仅呈现设备记录；没有个人心率基线，不作强度判断。',
  rows: [
    { label: '平均心率', value: `${Math.round(heartRate)} bpm` },
    { label: '距离', value: formatDistance(run.distance) },
    { label: '配速', value: formatPace(run.paceSeconds) },
  ],
});

export const buildHabitDetailCard = (
  eyebrow: string,
  title: string,
  subtitle: string,
  count: number,
  totalCount: number
): DetailCardData => ({
  eyebrow,
  title,
  subtitle,
  rows: [
    { label: '跑步次数', value: `${count} 次` },
    {
      label: '占当前比例',
      value: totalCount ? `${Math.round((count / totalCount) * 100)}%` : '0%',
    },
  ],
});
