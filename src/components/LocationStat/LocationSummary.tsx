import Stat from '@/components/Stat';
import useActivities from '@/hooks/useActivities';

// only support China for now
const LocationSummary = () => {
  const { years, countries, provinces, cities } = useActivities();
  const cityCount = Object.keys(cities).length;
  if (!countries.length && !provinces.length && !cityCount) return null;

  return (
    <div className="cursor-pointer">
      <section>
        {years.length > 0 ? (
          <Stat value={`${years.length}`} description=" 年里我跑过" />
        ) : null}
        {countries.length > 0 ? (
          <Stat value={countries.length} description=" 个国家" />
        ) : null}
        {provinces.length > 0 ? (
          <Stat value={provinces.length} description=" 个省份" />
        ) : null}
        {cityCount > 0 ? (
          <Stat value={cityCount} description=" 个城市" />
        ) : null}
      </section>
      <hr />
    </div>
  );
};

export default LocationSummary;
