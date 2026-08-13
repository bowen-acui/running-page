import React from 'react';
import styles from './style.module.css';
import {
  formatDistance,
  formatPace,
  formatShortDate,
  getChartPath,
} from './model';
import type {
  DailyCell,
  DetailCardData,
  HeatmapCell,
  MonthSummary,
  RunPoint,
  StaticAiSummary,
} from './model';

interface DetailCardProps {
  readonly detailCard: DetailCardData;
}

interface FrequencyPanelProps {
  readonly selectedMonth: number | null;
  readonly detailCard: DetailCardData;
  readonly dailyCells: readonly HeatmapCell[];
  readonly heatmapColumns: number;
  readonly onSelectDay: (cell: DailyCell) => void;
}

interface MonthlyVolumePanelProps {
  readonly monthSummaries: readonly MonthSummary[];
  readonly maxMonthDistance: number;
  readonly selectedMonth: number | null;
  readonly onToggleMonth: (month: MonthSummary, isSelected: boolean) => void;
}

interface PacePanelProps {
  readonly paceRuns: readonly RunPoint[];
  readonly paceValues: readonly number[];
  readonly paceMin: number;
  readonly paceSpread: number;
  readonly paceLabel: string;
  readonly onSelectRun: (run: RunPoint) => void;
}

interface HeartPanelProps {
  readonly heartRuns: readonly RunPoint[];
  readonly heartRateLabel: string | null;
  readonly onSelectHeartRun: (run: RunPoint, rate: number) => void;
}

interface HabitPanelProps {
  readonly longestStreak: number;
  readonly longestGap: number;
  readonly habitMatrix: ReadonlyArray<{
    readonly label: string;
    readonly count: number;
  }>;
  readonly timeBandMatrix: ReadonlyArray<{
    readonly label: string;
    readonly count: number;
  }>;
  readonly totalRuns: number;
  readonly onSelectHabit: (
    eyebrow: string,
    title: string,
    subtitle: string,
    count: number,
    totalCount: number
  ) => void;
}

interface InsightPanelProps {
  readonly aiSummary: readonly string[];
  readonly aiSummaryMeta: StaticAiSummary;
  readonly selectedMonth: number | null;
}

export const DetailCard = ({ detailCard }: DetailCardProps) => (
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
);

export const FrequencyPanel = ({
  selectedMonth,
  detailCard,
  dailyCells,
  heatmapColumns,
  onSelectDay,
}: FrequencyPanelProps) => (
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
    <DetailCard detailCard={detailCard} />
    <div
      className={`${styles.heatmapGrid} ${selectedMonth ? styles.monthHeatmapGrid : ''}`}
      style={{
        gridTemplateColumns: selectedMonth
          ? `repeat(${dailyCells.length}, minmax(0, 1fr))`
          : `repeat(${heatmapColumns}, minmax(0, 1fr))`,
      }}
      aria-label="跑步热力图"
    >
      {dailyCells.map((cell) =>
        cell.kind === 'day' ? (
          <button
            key={cell.key}
            type="button"
            className={`${styles.heatCell} ${styles[`heatLevel${cell.level}`]}`}
            title={cell.label}
            aria-label={cell.label}
            onClick={() => onSelectDay(cell)}
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
);

export const MonthlyVolumePanel = ({
  monthSummaries,
  maxMonthDistance,
  selectedMonth,
  onToggleMonth,
}: MonthlyVolumePanelProps) => (
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
        const height = Math.max(6, (month.distance / maxMonthDistance) * 100);
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
            onClick={() => onToggleMonth(month, isSelected)}
          >
            <i style={{ height: `${height}%` }} />
            <span>{month.month}</span>
          </button>
        );
      })}
    </div>
  </article>
);

export const PacePanel = ({
  paceRuns,
  paceValues,
  paceMin,
  paceSpread,
  paceLabel,
  onSelectRun,
}: PacePanelProps) => (
  <article className={styles.panel}>
    <div className={styles.panelHeader}>
      <div>
        <p>Pace Stability</p>
        <h2>配速趋势</h2>
      </div>
      <span>{paceRuns.length ? paceLabel : '数据不足'}</span>
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
            d={getChartPath(paceValues, 320, 150)}
          />
          {paceRuns.map((run, index) => {
            const x =
              paceValues.length === 1
                ? 160
                : (index / (paceValues.length - 1)) * 320;
            const y =
              150 - ((run.paceSeconds - paceMin) / paceSpread) * 134 - 8;
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
                  onSelectRun(run);
                }}
                onClick={() => onSelectRun(run)}
              >
                <title>
                  {run.date.getMonth() + 1}月{run.date.getDate()}日 ·{' '}
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
);

export const HeartPanel = ({
  heartRuns,
  heartRateLabel,
  onSelectHeartRun,
}: HeartPanelProps) => (
  <article className={styles.panel}>
    <div className={styles.panelHeader}>
      <div>
        <p>Heart Rate</p>
        <h2>心率强度</h2>
      </div>
      <span>{heartRateLabel ?? '心率记录不足'}</span>
    </div>
    {heartRuns.length >= 3 ? (
      <div className={styles.heartChart}>
        {heartRuns.map((run) => {
          const rate = run.heartRate ?? 0;
          const height = Math.max(18, Math.min(100, ((rate - 120) / 70) * 100));
          return (
            <button
              key={run.id}
              type="button"
              className={rate >= 170 ? styles.highHeartBar : ''}
              title={`${formatShortDate(run.date)} · ${Math.round(rate)} bpm`}
              aria-label={`${formatShortDate(run.date)} · ${Math.round(rate)} bpm`}
              onClick={() => onSelectHeartRun(run, rate)}
            >
              <i style={{ height: `${height}%` }} />
            </button>
          );
        })}
      </div>
    ) : (
      <p className={styles.quietEmpty}>心率记录不足，暂不判断训练强度。</p>
    )}
  </article>
);

export const HabitPanel = ({
  longestStreak,
  longestGap,
  habitMatrix,
  timeBandMatrix,
  totalRuns,
  onSelectHabit,
}: HabitPanelProps) => (
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
            onSelectHabit(
              'Week Rhythm',
              `${item.label} 跑步习惯`,
              '当前视图里的星期分布。',
              item.count,
              totalRuns
            )
          }
        >
          <i
            style={{
              opacity: item.count ? Math.min(1, 0.24 + item.count / 8) : 0.12,
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
            onSelectHabit(
              'Time Habit',
              `${item.label} 节奏`,
              '当前视图里的时间段分布。',
              item.count,
              totalRuns
            )
          }
        >
          <i
            style={{
              opacity: item.count ? Math.min(1, 0.22 + item.count / 8) : 0.12,
            }}
          />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  </article>
);

export const InsightPanel = ({
  aiSummary,
  aiSummaryMeta,
  selectedMonth,
}: InsightPanelProps) => (
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
    {aiSummaryMeta.trainingGoal && !selectedMonth && (
      <small className={styles.aiHint}>
        当前目标：{aiSummaryMeta.trainingGoal}
      </small>
    )}
    {aiSummaryMeta.fallbackReason && !selectedMonth && (
      <small className={styles.aiHint}>
        DeepSeek 未生成：{aiSummaryMeta.fallbackReason}
      </small>
    )}
  </section>
);
