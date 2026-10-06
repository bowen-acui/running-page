import React from 'react';
import { Link } from 'react-router-dom';
import styles from './style.module.css';
import { formatDistance, formatPace } from './model';
import { DIST_UNIT } from '@/utils/utils';

interface EmptyStateProps {
  readonly title: string;
  readonly subtitle: string;
}

interface PageHeaderProps {
  readonly year: number;
  readonly years: readonly number[];
  readonly selectedMonth: number | null;
  readonly onSelectYearValue: (year: number) => void;
  readonly onSelectYear: () => void;
  readonly onSelectMonth: () => void;
  readonly onShare: () => void;
}

interface ContextStripProps {
  readonly selectedMonth: number | null;
  readonly count: number;
  readonly distance: number;
  readonly averagePaceSeconds: number;
  readonly averageHeartRate: number | null;
  readonly heartRateSampleSize: number;
}

export const EmptyState = ({ title, subtitle }: EmptyStateProps) => (
  <section className={styles.activityList}>
    <section className={styles.emptyState}>
      <p>年度回顾</p>
      <h1>{title}</h1>
      <span>{subtitle}</span>
    </section>
  </section>
);

export const PageHeader = ({
  year,
  years,
  selectedMonth,
  onSelectYearValue,
  onSelectYear,
  onSelectMonth,
  onShare,
}: PageHeaderProps) => (
  <header className={styles.pageHeader}>
    <div>
      <p>年度回顾</p>
      <h1>跑步节奏</h1>
      <span>
        <select
          aria-label="选择年份"
          value={year}
          onChange={(event) => onSelectYearValue(Number(event.target.value))}
        >
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        {' · '}
        {selectedMonth ? `${selectedMonth} 月洞察` : '训练洞察'}
      </span>
    </div>
    <div className={styles.headerActions}>
      <Link to="/" className={styles.homeLink}>
        返回首页
      </Link>
      <button type="button" className={styles.shareLink} onClick={onShare}>
        生成封面
      </button>
      <div className={styles.viewSwitch} aria-label="视图切换">
        <button
          type="button"
          aria-pressed={!selectedMonth}
          className={!selectedMonth ? styles.activeSwitch : ''}
          onClick={onSelectYear}
        >
          年
        </button>
        <button
          type="button"
          aria-pressed={Boolean(selectedMonth)}
          className={selectedMonth ? styles.activeSwitch : ''}
          onClick={onSelectMonth}
        >
          月
        </button>
      </div>
    </div>
  </header>
);

export const ContextStrip = ({
  selectedMonth,
  count,
  distance,
  averagePaceSeconds,
  averageHeartRate,
  heartRateSampleSize,
}: ContextStripProps) => (
  <section className={styles.contextStrip} aria-label="当前视图摘要">
    <div className={styles.contextPrimary}>
      <span>{selectedMonth ? '本月跑量' : '全年跑量'}</span>
      <strong>{formatDistance(distance)}</strong>
    </div>
    <div className={styles.contextMetrics}>
      <div>
        <span>跑步次数</span>
        <strong>{count} 次</strong>
      </div>
      <div>
        <span>平均配速</span>
        <strong>
          {formatPace(averagePaceSeconds)} /{DIST_UNIT}
        </strong>
      </div>
      <div>
        <span>平均心率</span>
        <strong>
          {averageHeartRate !== null
            ? `${Math.round(averageHeartRate)} bpm`
            : '暂无数据'}
        </strong>
        <small>
          {averageHeartRate !== null
            ? `覆盖 ${heartRateSampleSize}/${count} 次`
            : '记录不足'}
        </small>
      </div>
    </div>
  </section>
);
