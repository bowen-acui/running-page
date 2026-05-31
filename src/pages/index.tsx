import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Helmet } from 'react-helmet-async';
import Layout from '@/components/Layout';
import LocationStat from '@/components/LocationStat';
import RunTable from '@/components/RunTable';
import SVGStat from '@/components/SVGStat';
import YearsStat from '@/components/YearsStat';
import BrandTitle from '@/components/BrandTitle';
import useActivities from '@/hooks/useActivities';
import getSiteMetadata from '@/hooks/useSiteMetadata';
import { useInterval } from '@/hooks/useInterval';
import { IS_CHINESE } from '@/utils/const';
import {
  Activity,
  filterAndSortRuns,
  filterCityRuns,
  filterTitleRuns,
  filterYearRuns,
  scrollToMap,
  sortDateFunc,
  titleForShow,
  RunIds,
} from '@/utils/utils';
import {
  geoJsonForRuns,
  getBoundsForGeoData,
  type IViewState,
} from '@/utils/geoUtils';
import { useTheme, useThemeChangeCounter } from '@/hooks/useTheme';

const HASH_RUN_CHANGE_EVENT = 'running-page-hash-run-change';
const RunMap = lazy(() => import('@/components/RunMap'));

const getRunIdFromHash = () => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace('#', '');
  if (!hash.startsWith('run_')) return null;
  const runId = parseInt(hash.replace('run_', ''), 10);
  return Number.isNaN(runId) ? null : runId;
};

const subscribeToRunHash = (onStoreChange: () => void) => {
  window.addEventListener('hashchange', onStoreChange);
  window.addEventListener(HASH_RUN_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('hashchange', onStoreChange);
    window.removeEventListener(HASH_RUN_CHANGE_EVENT, onStoreChange);
  };
};

const notifyRunHashChange = () => {
  window.dispatchEvent(new Event(HASH_RUN_CHANGE_EVENT));
};

const isMobileViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 768px)').matches;

const clearRunHash = () => {
  if (window.location.hash) {
    window.history.pushState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`
    );
    notifyRunHashChange();
  }
};

const setRunHash = (runId: number) => {
  const newHash = `#run_${runId}`;
  if (window.location.hash !== newHash) {
    window.history.pushState(null, '', newHash);
    notifyRunHashChange();
  }
};

const useRunHashId = () =>
  useSyncExternalStore(subscribeToRunHash, getRunIdFromHash, () => null);

const Index = () => {
  const { siteTitle, navLinks } = getSiteMetadata();
  const { activities, thisYear } = useActivities();
  const themeChangeCounter = useThemeChangeCounter();
  const [year, setYear] = useState(thisYear);
  const [runIndex, setRunIndex] = useState(-1);
  const [title, setTitle] = useState('');
  // Animation states for replacing intervalIdRef
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);
  const [animationRuns, setAnimationRuns] = useState<Activity[]>([]);
  const [currentFilter, setCurrentFilter] = useState<{
    item: string;
    func: (_run: Activity, _value: string) => boolean;
  }>({ item: thisYear, func: filterYearRuns });

  // Track if we're showing a single run from URL hash
  const singleRunId = useRunHashId();

  // Animation trigger for single runs - increment this to force animation replay
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [isMapCollapsed, setIsMapCollapsed] = useState(isMobileViewport);
  const [shouldRenderMap, setShouldRenderMap] = useState(() => !isMobileViewport());
  const mapPanelRef = useRef<HTMLDivElement | null>(null);

  // Memoize expensive calculations
  const runs = useMemo(() => {
    return filterAndSortRuns(
      activities,
      currentFilter.item,
      currentFilter.func,
      sortDateFunc
    );
  }, [activities, currentFilter.item, currentFilter.func]);

  const geoData = useMemo(() => {
    void themeChangeCounter;
    return geoJsonForRuns(runs);
  }, [runs, themeChangeCounter]);

  // for auto zoom
  const bounds = useMemo(() => {
    return getBoundsForGeoData(geoData);
  }, [geoData]);

  const [viewState, setViewState] = useState<IViewState>(() => ({
    ...bounds,
  }));

  // Add state for animated geoData to handle the animation effect
  const [animatedGeoData, setAnimatedGeoData] = useState(geoData);

  // Use useInterval for animation instead of intervalIdRef
  useInterval(
    () => {
      if (!isAnimating || currentAnimationIndex >= animationRuns.length) {
        setIsAnimating(false);
        setAnimatedGeoData(geoData);
        return;
      }

      const runsNum = animationRuns.length;
      const sliceNum = runsNum >= 8 ? Math.ceil(runsNum / 8) : 1;
      const nextIndex = Math.min(currentAnimationIndex + sliceNum, runsNum);
      const tempRuns = animationRuns.slice(0, nextIndex);
      setAnimatedGeoData(geoJsonForRuns(tempRuns));
      setCurrentAnimationIndex(nextIndex);

      if (nextIndex >= runsNum) {
        setIsAnimating(false);
        setAnimatedGeoData(geoData);
      }
    },
    isAnimating ? 300 : null
  );

  // Helper function to start animation
  const startAnimation = useCallback(
    (runsToAnimate: Activity[]) => {
      if (runsToAnimate.length === 0) {
        setAnimatedGeoData(geoData);
        return;
      }

      const sliceNum =
        runsToAnimate.length >= 8 ? Math.ceil(runsToAnimate.length / 8) : 1;
      setAnimationRuns(runsToAnimate);
      setCurrentAnimationIndex(sliceNum);
      setIsAnimating(true);
    },
    [geoData]
  );

  const changeByItem = useCallback(
    (
      item: string,
      name: string,
      func: (_run: Activity, _value: string) => boolean
    ) => {
      scrollToMap();
      if (name != 'Year') {
        setYear(thisYear);
      }
      setCurrentFilter({ item, func });
      setRunIndex(-1);
      setTitle(`${item} ${name} Running Heatmap`);
      // Reset single run state when changing filters
      clearRunHash();
    },
    [thisYear]
  );

  const changeYear = useCallback(
    (y: string) => {
      // default year
      setYear(y);

      if ((viewState.zoom ?? 0) > 3 && bounds) {
        setViewState({
          ...bounds,
        });
      }

      changeByItem(y, 'Year', filterYearRuns);
      // Stop current animation
      setIsAnimating(false);
    },
    [viewState.zoom, bounds, changeByItem]
  );

  const changeCity = useCallback(
    (city: string) => {
      changeByItem(city, 'City', filterCityRuns);
    },
    [changeByItem]
  );

  const changeTitle = useCallback(
    (title: string) => {
      changeByItem(title, 'Title', filterTitleRuns);
    },
    [changeByItem]
  );

  const locateActivity = useCallback(
    (runIds: RunIds) => {
      const ids = new Set(runIds);

      const selectedRuns = !runIds.length
        ? runs
        : runs.filter((run: Activity) => ids.has(run.run_id));

      if (!selectedRuns.length) {
        return;
      }

      const lastRun = selectedRuns.slice().sort(sortDateFunc)[0];

      if (!lastRun) {
        return;
      }

      // Set runIndex for table highlighting when single run is selected
      if (runIds.length === 1) {
        const runId = runIds[0];
        const runIdx = runs.findIndex((run) => run.run_id === runId);
        setRunIndex(runIdx);
      } else {
        setRunIndex(-1);
      }

      // Update URL hash when a single run is located
      if (runIds.length === 1) {
        const runId = runIds[0];
        setRunHash(runId);
      } else {
        // If multiple runs or no runs, clear the hash and single run state
        clearRunHash();
      }

      // Create geoData for selected runs and calculate new bounds
      const selectedGeoData = geoJsonForRuns(selectedRuns);
      const selectedBounds = getBoundsForGeoData(selectedGeoData);

      // Stop any existing animation
      setIsAnimating(false);

      // Update the animated geoData immediately to trigger RunMap animation
      setAnimatedGeoData(selectedGeoData);

      // For single run, trigger animation by incrementing the trigger
      if (runIds.length === 1) {
        setAnimationTrigger((prev) => prev + 1);
      }

      // Update view state
      setViewState({
        ...selectedBounds,
      });
      setTitle(titleForShow(lastRun));
      scrollToMap();
    },
    [runs]
  );

  // Auto locate activity when singleRunId is set and activities are loaded
  // First, detect the run's year and switch to it if needed
  useEffect(() => {
    if (singleRunId !== null && activities.length > 0) {
      const frameId = requestAnimationFrame(() => {
        const targetRun = activities.find((run) => run.run_id === singleRunId);
        if (targetRun) {
          const runYear = targetRun.start_date_local.slice(0, 4);
          if (year !== runYear) {
            setYear(runYear);
            setCurrentFilter({ item: runYear, func: filterYearRuns });
          }
        } else {
          // If run doesn't exist, clear the hash and show a warning
          console.warn(`Run with ID ${singleRunId} not found in activities`);
          window.history.replaceState(null, '', window.location.pathname);
          notifyRunHashChange();
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [singleRunId, activities, year]);

  useEffect(() => {
    if (singleRunId !== null && runs.length > 0) {
      const frameId = requestAnimationFrame(() => {
        const runExistsInCurrentRuns = runs.some(
          (run) => run.run_id === singleRunId
        );
        if (runExistsInCurrentRuns) {
          locateActivity([singleRunId]);
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [runs, singleRunId, locateActivity]);

  // Update bounds when geoData changes
  useEffect(() => {
    if (singleRunId === null) {
      const frameId = requestAnimationFrame(() => {
        setViewState((prev) => ({
          ...prev,
          ...bounds,
        }));
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [bounds, singleRunId]);

  // Animate geoData when runs change
  useEffect(() => {
    if (singleRunId === null) {
      const frameId = requestAnimationFrame(() => startAnimation(runs));
      return () => cancelAnimationFrame(frameId);
    }
  }, [runs, startAnimation, singleRunId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = () => {
      setIsMapCollapsed(mediaQuery.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (singleRunId !== null) {
      setIsMapCollapsed(false);
      setShouldRenderMap(true);
    }
  }, [singleRunId]);

  useEffect(() => {
    if (!isMapCollapsed) {
      setShouldRenderMap(true);
    }
  }, [isMapCollapsed]);

  useEffect(() => {
    const node = mapPanelRef.current;
    if (!node || shouldRenderMap || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRenderMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: '180px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRenderMap]);

  const { theme } = useTheme();
  const summaryLink = navLinks.find((link) => link.name === 'Summary');
  return (
    <Layout>
      <Helmet>
        <html lang="en" data-theme={theme} />
      </Helmet>
      <div className="grid w-full gap-3 sm:gap-5 lg:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)] lg:items-start lg:gap-5 xl:gap-6">
        <section className="w-full lg:sticky lg:top-8">
          <div className="mb-1 grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-[1.625rem] pt-1 sm:mb-1.5 lg:mr-6">
            <h1 className="min-w-0 overflow-visible pt-[0.08em] text-[clamp(0.86rem,3.5vw,1.02rem)] leading-none sm:text-[1.18rem]">
              <BrandTitle
                title={siteTitle}
                prefixClassName="font-black tracking-[0.004em]"
                suffixClassName="top-[0.04em] text-[1.02em] font-semibold tracking-[0.008em]"
              />
            </h1>
            {summaryLink && (
              <a
                className="inline-flex h-7 shrink-0 items-center justify-center self-start rounded-full border border-[color:var(--color-primary)]/10 bg-[color:var(--color-background)]/46 px-3 text-[0.56rem] font-semibold tracking-[0.1em] text-[color:var(--color-run-date)]/72 uppercase transition-colors hover:text-[color:var(--color-text-primary)]"
                href={summaryLink.url}
              >
                {summaryLink.name}
              </a>
            )}
          </div>
          {(viewState.zoom ?? 0) <= 3 && IS_CHINESE ? (
            <LocationStat
              changeYear={changeYear}
              changeCity={changeCity}
              changeTitle={changeTitle}
            />
          ) : (
            <YearsStat year={year} onClick={changeYear} />
          )}
        </section>
        <section className="min-w-0 space-y-4 sm:space-y-6" id="map-container">
          <div
            ref={mapPanelRef}
            className={`home-map-panel map-shell ${isMapCollapsed ? 'map-shell-collapsed' : ''} overflow-hidden rounded-[1.75rem] border border-[color:var(--color-primary)]/10 bg-[color:var(--color-run-row-hover-background)]/14 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-3`}
          >
            {isMapCollapsed ? (
              <button
                type="button"
                className="group relative flex min-h-44 w-full items-center justify-between overflow-hidden rounded-[1.35rem] border border-[color:var(--color-primary)]/8 bg-[color:var(--color-background)]/28 px-5 py-4 text-left text-[color:var(--color-run-date)] transition-colors duration-200 hover:bg-[color:var(--color-background)]/42"
                onClick={() => setIsMapCollapsed(false)}
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,color-mix(in_srgb,var(--color-primary)_9%,transparent),transparent_32%)]" />
                <span className="relative z-10 min-w-0">
                  <span className="block text-[0.68rem] font-semibold tracking-[0.18em] text-[color:var(--color-run-date)]/70 uppercase">
                    Route Map
                  </span>
                  <strong className="mt-1 block text-[1.05rem] leading-tight font-black text-[color:var(--color-text-primary)]">
                    查看路线地图
                  </strong>
                  <span className="mt-1.5 block text-[0.78rem] leading-snug text-[color:var(--color-run-date)]/78">
                    加载完整路线和缩放控件
                  </span>
                </span>
                <span className="relative z-10 flex h-20 w-24 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--color-run-row-hover-background)]/28 ring-1 ring-[color:var(--color-primary)]/8">
                  <svg
                    aria-hidden="true"
                    className="h-14 w-16 text-[color:var(--color-primary)] opacity-75"
                    viewBox="0 0 88 64"
                    fill="none"
                  >
                    <path
                      d="M8 46C20 18 31 22 39 35C47 48 55 49 80 16"
                      stroke="currentColor"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="8" cy="46" r="5" fill="currentColor" />
                    <circle cx="80" cy="16" r="5" fill="currentColor" />
                  </svg>
                </span>
              </button>
            ) : (
              shouldRenderMap && (
                <Suspense
                  fallback={
                    <div className="flex min-h-[var(--map-height,320px)] items-center justify-center rounded-[1.35rem] bg-[color:var(--color-background)]/28 text-sm font-semibold text-[color:var(--color-run-date)]/72">
                      加载路线地图...
                    </div>
                  }
                >
                  <RunMap
                    title={title}
                    viewState={viewState}
                    geoData={animatedGeoData}
                    setViewState={setViewState}
                    changeYear={changeYear}
                    thisYear={year}
                    animationTrigger={animationTrigger}
                  />
                </Suspense>
              )
            )}
          </div>
          <div className="home-data-panel min-w-0 overflow-hidden rounded-[1.75rem] border border-[color:var(--color-primary)]/10 bg-[color:var(--color-run-row-hover-background)]/14 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
            {year === 'Total' ? (
              <SVGStat />
            ) : (
              <RunTable
                runs={runs}
                locateActivity={locateActivity}
                runIndex={runIndex}
                setRunIndex={setRunIndex}
              />
            )}
          </div>
        </section>
      </div>
      {import.meta.env.VERCEL && <Analytics />}
    </Layout>
  );
};

export default Index;
