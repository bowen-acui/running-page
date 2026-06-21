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
    <ul className={styles.buttons}>
      {yearsButtons.map((year) => {
        const isSelected = year === thisYear;
        return (
          <li
            key={`${year}button`}
            className={styles.button + ` ${isSelected ? styles.selected : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => {
              changeYear(year);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                changeYear(year);
              }
            }}
          >
            {year}
          </li>
        );
      })}
    </ul>
  );
};

export default RunMapButtons;
