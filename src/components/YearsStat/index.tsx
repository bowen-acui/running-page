import { useMemo } from 'react';
import YearStat from '@/components/YearStat';
import useActivities from '@/hooks/useActivities';
import { INFO_MESSAGE } from '@/utils/const';

const YearsStat = ({
  year,
  onClick,
}: {
  year: string;
  onClick: (_year: string) => void;
}) => {
  const { years } = useActivities();

  // Memoize the years array calculation
  const yearsArrayUpdate = useMemo(() => {
    // make sure the year click on front
    let updatedYears = years.slice();
    updatedYears.push('Total');
    updatedYears = updatedYears.filter((x) => x !== year);
    updatedYears.unshift(year);
    return updatedYears;
  }, [years, year]);

  const infoMessage = useMemo(() => {
    return INFO_MESSAGE(years.length, year);
  }, [years.length, year]);

  // for short solution need to refactor
  return (
    <div className="w-full pb-10 lg:pr-12">
      <section className="rounded-[2rem] border border-[color:var(--color-hr-primary)]/30 bg-[color:var(--color-run-row-hover-background)]/24 px-5 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-[color:var(--color-run-date)]">
          Timeline
        </p>
        <p className="mt-3 leading-7 text-[color:var(--color-text-primary)]">
          {infoMessage}
          <br />
        </p>
      </section>
      <hr className="my-6" />
      {yearsArrayUpdate.map((yearItem) => (
        <YearStat key={yearItem} year={yearItem} onClick={onClick} />
      ))}
    </div>
  );
};

export default YearsStat;
