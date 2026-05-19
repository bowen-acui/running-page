import YearStat from '@/components/YearStat';
import {
  CHINESE_LOCATION_INFO_MESSAGE_FIRST,
  CHINESE_LOCATION_INFO_MESSAGE_SECOND,
} from '@/utils/const';
import CitiesStat from './CitiesStat';
import LocationSummary from './LocationSummary';
import PeriodStat from './PeriodStat';

interface ILocationStatProps {
  changeYear: (_year: string) => void;
  changeCity: (_city: string) => void;
  changeTitle: (_title: string) => void;
}

const LocationStat = ({
  changeYear,
  changeCity,
  changeTitle,
}: ILocationStatProps) => (
  <div className="w-full pb-10 lg:pr-12">
    <section className="rounded-[2rem] border border-[color:var(--color-hr-primary)]/30 bg-[color:var(--color-run-row-hover-background)]/24 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-run-date)]">
        Atlas
      </p>
      <p className="mt-3 leading-7 text-[color:var(--color-text-primary)]">
        {CHINESE_LOCATION_INFO_MESSAGE_FIRST}
        .
        <br />
        {CHINESE_LOCATION_INFO_MESSAGE_SECOND}
        .
        <br />
        <br />
        Yesterday you said tomorrow.
      </p>
    </section>
    <hr className="my-6" />
    <LocationSummary />
    <CitiesStat onClick={changeCity} />
    <PeriodStat onClick={changeTitle} />
    <YearStat year="Total" onClick={changeYear} />
  </div>
);

export default LocationStat;
