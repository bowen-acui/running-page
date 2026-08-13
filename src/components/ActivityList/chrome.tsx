import React from 'react';
import { Link } from 'react-router-dom';
import styles from './style.module.css';
import { formatDistance, formatPace } from './model';

interface EmptyStateProps {
  readonly title: string;
  readonly subtitle: string;
}

interface PageHeaderProps {
  readonly year: number;
  readonly selectedMonth: number | null;
  readonly onSelectYear: () => void;
  readonly onSelectMonth: () => void;
}

interface ContextStripProps {
  readonly selectedMonth: number | null;
  readonly count: number;
  readonly distance: number;
  readonly averagePaceSeconds: number;
  readonly averageHeartRate: number | null;
}

export const EmptyState = ({ title, subtitle }: EmptyStateProps) => (
  <section className={styles.activityList}>
    <section className={styles.emptyState}>
      <p>Running Journal</p>
      <h1>{title}</h1>
      <span>{subtitle}</span>
    </section>
  </section>
);

export const PageHeader = ({
  year,
  selectedMonth,
  onSelectYear,
  onSelectMonth,
}: PageHeaderProps) => (
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
}: ContextStripProps) => (
  <section className={styles.contextStrip} aria-label="当前视图摘要">
    <span>{selectedMonth ? `${selectedMonth} 月` : '全年'}</span>
    <span>{count} 次</span>
    <span>{formatDistance(distance)}</span>
    <span>{formatPace(averagePaceSeconds)}</span>
    <span>
      {averageHeartRate !== null
        ? `${Math.round(averageHeartRate)} bpm`
        : '心率不足'}
    </span>
  </section>
);
