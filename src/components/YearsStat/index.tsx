import { lazy, Suspense, useMemo } from 'react';
import YearStat from '@/components/YearStat';
import useActivities from '@/hooks/useActivities';
import { yearSummaryStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import styles from './style.module.css';

const yearSummarySvgs = Object.fromEntries(
  Object.keys(yearSummaryStats).map((path) => [
    path,
    lazy(() => loadSvgComponent(yearSummaryStats, path)),
  ])
);

const YearsStat = ({
  year,
  onClick,
}: {
  year: string;
  onClick: (_year: string) => void;
}) => {
  const { years } = useActivities();

  const yearsArrayUpdate = useMemo(() => {
    let updatedYears = years.slice();
    if (years.length > 1) {
      updatedYears.push('Total');
    }
    updatedYears = updatedYears.filter((x) => x !== year);
    updatedYears.unshift(year);
    return updatedYears;
  }, [years, year]);
  const heatmapYear = year === 'Total' ? years[0] : year;
  const YearSummarySVG = heatmapYear
    ? yearSummarySvgs[`./year_summary_${heatmapYear}.svg`]
    : null;

  return (
    <div className="w-full space-y-3 pb-4 sm:space-y-4 sm:pb-6 lg:pr-6 lg:pb-10">
      {yearsArrayUpdate.map((yearItem) => (
        <YearStat key={yearItem} year={yearItem} onClick={onClick} />
      ))}
      {YearSummarySVG && (
        <section className={styles.sidebarHeatmap}>
          <div className={styles.heatmapHeader}>
            <span>Year Heatmap</span>
            <strong>{heatmapYear}</strong>
          </div>
          <div className={styles.heatmapViewport}>
            <Suspense
              fallback={<div className={styles.loading}>加载中...</div>}
            >
              <YearSummarySVG className={styles.heatmapSvg} />
            </Suspense>
          </div>
        </section>
      )}
    </div>
  );
};

export default YearsStat;
