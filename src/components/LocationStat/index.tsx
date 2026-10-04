import YearStat from '@/components/YearStat';
import useActivities from '@/hooks/useActivities';
import CitiesStat from './CitiesStat';
import LocationSummary from './LocationSummary';
import PeriodStat from './PeriodStat';
import styles from './style.module.css';

interface ILocationStatProps {
  changeYear: (_year: string) => void;
  changeCity: (_city: string) => void;
  changeTitle: (_title: string) => void;
}

const LocationStat = ({
  changeYear,
  changeCity,
  changeTitle,
}: ILocationStatProps) => {
  const { cities } = useActivities();

  return (
    <div className={`${styles.locationStat} w-full pb-10 lg:pr-8`}>
      <div>
        <LocationSummary />
        {Object.keys(cities).length > 0 && <CitiesStat onClick={changeCity} />}
        <PeriodStat onClick={changeTitle} />
      </div>
      <div className={styles.total}>
        <YearStat year="Total" onClick={changeYear} />
      </div>
    </div>
  );
};

export default LocationStat;
