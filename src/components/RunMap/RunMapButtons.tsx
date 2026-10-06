import useActivities from '@/hooks/useActivities';
import styles from './style.module.css';

const RunMapButtons = ({
  changeYear,
  thisYear,
}: {
  changeYear: (_year: string) => void;
  thisYear: string;
}) => {
  const { years } = useActivities();
  const yearsButtons = years.slice();
  yearsButtons.push('Total');

  return (
    <div className={styles.buttons} role="group" aria-label="选择地图年份">
      {yearsButtons.map((year) => {
        const isSelected = year === thisYear;
        return (
          <button
            key={`${year}button`}
            type="button"
            className={styles.button + ` ${isSelected ? styles.selected : ''}`}
            aria-pressed={isSelected}
            onClick={() => changeYear(year)}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
};

export default RunMapButtons;
