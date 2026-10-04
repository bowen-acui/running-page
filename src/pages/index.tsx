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
import type { FeatureCollection, LineString } from 'geojson';
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
  convertMovingTime2Sec,
  filterAndSortRuns,
  filterCityRuns,
  filterTitleRuns,
  filterYearRuns,
  isRunActivity,
  prefersReducedMotion,
  scrollToMap,
  sortDateFunc,
  titleForShow,
  RunIds,
} from '@/utils/utils';
import type { IViewState } from '@/utils/mapTypes';
import { useTheme, useThemeChangeCounter } from '@/hooks/useTheme';

const HASH_RUN_CHANGE_EVENT = 'running-page-hash-run-change';
const RunMap = lazy(() => import('@/components/RunMap'));
const YearCompareChart = lazy(() => import('@/components/YearCompareChart'));

const FILTER_FUNCS = {
  year: filterYearRuns,
  city: filterCityRuns,
  title: filterTitleRuns,
} as const;

type FilterKind = keyof typeof FILTER_FUNCS;
type GeoUtilsModule = typeof import('@/utils/geoUtils');

const EMPTY_GEO_DATA: FeatureCollection<LineString> = {
  type: 'FeatureCollection',
  features: [],
};

const DEFAULT_VIEW_STATE: IViewState = {
  longitude: 20,
  latitude: 20,
  zoom: 3,
};

const formatActivityTime = (value: string | null) => {
  if (!value) return '未获取';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

// Parse a shareable filter hash like #year_2025 / #city_上海 / #title_晨跑
const getFilterFromHash = (): { kind: FilterKind; value: string } | null => {
  if (typeof window === 'undefined') return null;
  let hash: string;
  try {
    hash = decodeURIComponent(window.location.hash.replace('#', ''));
  } catch {
    return null;
  }
  const match = hash.match(/^(year|city|title)_(.+)$/);
  if (!match) return null;
  return { kind: match[1] as FilterKind, value: match[2] };
};

const setFilterHash = (kind: string, item: string) => {
  const newHash = `#${kind}_${encodeURIComponent(item)}`;
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, '', newHash);
    notifyRunHashChange();
  }
};

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
  const { activities, thisYear, lastSyncedAt } = useActivities();
  const themeChangeCounter = useThemeChangeCounter();
  // Restore a shared filter from the URL hash on first load
  const [initialFilter] = useState(getFilterFromHash);
  const [year, setYear] = useState(
    initialFilter?.kind === 'year' ? initialFilter.value : thisYear
  );
  const [runIndex, setRunIndex] = useState(-1);
  const [title, setTitle] = useState('');
  // Animation states for replacing intervalIdRef
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(0);
  const [animationRuns, setAnimationRuns] = useState<Activity[]>([]);
  const [currentFilter, setCurrentFilter] = useState<{
    item: string;
    func: (_run: Activity, _value: string) => boolean;
  }>(() =>
    initialFilter
      ? { item: initialFilter.value, func: FILTER_FUNCS[initialFilter.kind] }
      : { item: thisYear, func: filterYearRuns }
  );

  // Track if we're showing a single run from URL hash
  const singleRunId = useRunHashId();

  // Animation trigger for single runs - increment this to force animation replay
  const [animationTrigger, setAnimationTrigger] = useState(0);
  const [isMapCollapsed, setIsMapCollapsed] = useState(isMobileViewport);
  const [shouldRenderMap, setShouldRenderMap] = useState(false);
  const mapPanelRef = useRef<HTMLDivElement | null>(null);
  const geoUtilsRef = useRef<Promise<GeoUtilsModule> | null>(null);
  const geoJsonForRunsRef = useRef<GeoUtilsModule['geoJsonForRuns'] | null>(
    null
  );
  const currentGeoDataRef =
    useRef<FeatureCollection<LineString>>(EMPTY_GEO_DATA);
  const locateRequestRef = useRef(0);
  const isSingleRunView = singleRunId !== null;
  const isMapExpanded = !isMapCollapsed || isSingleRunView;
  const shouldDisplayMap = shouldRenderMap || isSingleRunView;

  // Memoize expensive calculations
  const runs = useMemo(() => {
    return filterAndSortRuns(
      activities,
      currentFilter.item,
      currentFilter.func,
      sortDateFunc
    );
  }, [activities, currentFilter.item, currentFilter.func]);

  const recentSummary = useMemo(() => {
    const runActivities = activities
      .filter(isRunActivity)
      .slice()
      .sort(sortDateFunc);
    const now = new Date();
    const currentWeek = new Date(now);
    currentWeek.setHours(0, 0, 0, 0);
    currentWeek.setDate(
      currentWeek.getDate() - ((currentWeek.getDay() + 6) % 7)
    );
    const weeks = Array.from({ length: 4 }, (_, index) => {
      const start = new Date(currentWeek);
      start.setDate(start.getDate() - (3 - index) * 7);
      const next = new Date(start);
      next.setDate(next.getDate() + 7);
      const weekRuns = runActivities.filter((run) => {
        const date = new Date(run.start_date_local.replace(' ', 'T'));
        return date >= start && date < next;
      });
      return { start, runs: weekRuns };
    });
    const thisWeekRuns = weeks[3].runs;
    const weekDays = new Set(
      thisWeekRuns.map((run) => run.start_date_local.slice(0, 10))
    );
    const seconds = thisWeekRuns.reduce(
      (sum, run) => sum + convertMovingTime2Sec(run.moving_time),
      0
    );
    return {
      weeks,
      thisWeekRuns,
      weekDays,
      seconds,
      runCount: runActivities.length,
    };
  }, [activities]);

  const loadGeoUtils = useCallback(() => {
    geoUtilsRef.current ??= import('@/utils/geoUtils');
    return geoUtilsRef.current;
  }, []);

  const [viewState, setViewState] = useState<IViewState>(DEFAULT_VIEW_STATE);

  // Add state for animated geoData to handle the animation effect
  const [animatedGeoData, setAnimatedGeoData] =
    useState<FeatureCollection<LineString>>(EMPTY_GEO_DATA);

  // Use useInterval for animation instead of intervalIdRef
  useInterval(
    () => {
      if (!isAnimating || currentAnimationIndex >= animationRuns.length) {
        setIsAnimating(false);
        setAnimatedGeoData(currentGeoDataRef.current);
        return;
      }

      const geoJsonForRuns = geoJsonForRunsRef.current;
      if (!geoJsonForRuns) {
        setIsAnimating(false);
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
        setAnimatedGeoData(currentGeoDataRef.current);
      }
    },
    isAnimating ? 300 : null
  );

  // Helper function to start animation
  const startAnimation = useCallback((runsToAnimate: Activity[]) => {
    const geoJsonForRuns = geoJsonForRunsRef.current;
    if (!geoJsonForRuns) {
      return;
    }
    if (runsToAnimate.length === 0 || prefersReducedMotion()) {
      setAnimatedGeoData(currentGeoDataRef.current);
      return;
    }

    const sliceNum =
      runsToAnimate.length >= 8 ? Math.ceil(runsToAnimate.length / 8) : 1;
    setAnimationRuns(runsToAnimate);
    setCurrentAnimationIndex(sliceNum);
    setIsAnimating(true);
  }, []);

  const changeByItem = useCallback(
    (
      item: string,
      name: string,
      func: (_run: Activity, _value: string) => boolean
    ) => {
      locateRequestRef.current += 1;
      scrollToMap();
      if (name != 'Year') {
        setYear(thisYear);
      }
      setCurrentFilter({ item, func });
      setRunIndex(-1);
      setIsAnimating(false);
      setTitle(`${item} ${name} Running Heatmap`);
      // Reflect the filter in the URL so the view is shareable; this also
      // resets any single-run state since the hash no longer starts with run_
      setFilterHash(name.toLowerCase(), item);
    },
    [thisYear, setYear, setCurrentFilter, setRunIndex, setTitle]
  );

  const changeYear = useCallback(
    (y: string) => {
      // default year
      setYear(y);

      changeByItem(y, 'Year', filterYearRuns);
    },
    [changeByItem, setYear]
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
      const requestId = ++locateRequestRef.current;
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

      void (async () => {
        const { geoJsonForRuns, getBoundsForGeoData } = await loadGeoUtils();
        if (requestId !== locateRequestRef.current) {
          return;
        }
        geoJsonForRunsRef.current = geoJsonForRuns;

        const selectedGeoData = geoJsonForRuns(selectedRuns);
        const selectedBounds = getBoundsForGeoData(selectedGeoData);
        currentGeoDataRef.current = selectedGeoData;

        setIsAnimating(false);
        setAnimatedGeoData(selectedGeoData);

        if (runIds.length === 1) {
          setAnimationTrigger((prev) => prev + 1);
        }

        setViewState({
          ...selectedBounds,
        });
        setTitle(titleForShow(lastRun));
        scrollToMap();
      })();
    },
    [
      loadGeoUtils,
      runs,
      setRunIndex,
      setIsAnimating,
      setAnimatedGeoData,
      setAnimationTrigger,
      setViewState,
      setTitle,
    ]
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

  useEffect(() => {
    if (!shouldDisplayMap || singleRunId !== null) {
      return;
    }

    let isCancelled = false;
    let frameId: number | null = null;
    const requestId = locateRequestRef.current;

    void (async () => {
      const { geoJsonForRuns, getBoundsForGeoData } = await loadGeoUtils();
      if (isCancelled || requestId !== locateRequestRef.current) {
        return;
      }

      void themeChangeCounter;
      geoJsonForRunsRef.current = geoJsonForRuns;
      const nextGeoData = geoJsonForRuns(runs);
      currentGeoDataRef.current = nextGeoData;
      const nextBounds = getBoundsForGeoData(nextGeoData);

      setViewState((prev) => ({
        ...prev,
        ...nextBounds,
      }));
      setAnimatedGeoData(nextGeoData);

      frameId = requestAnimationFrame(() => {
        if (!isCancelled && requestId === locateRequestRef.current) {
          startAnimation(runs);
        }
      });
    })();

    return () => {
      isCancelled = true;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [
    loadGeoUtils,
    runs,
    shouldDisplayMap,
    singleRunId,
    startAnimation,
    themeChangeCounter,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = () => {
      setIsMapCollapsed(mediaQuery.matches);
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Drop the table highlight when the run hash clears.
  useEffect(() => {
    if (singleRunId === null) {
      const frameId = requestAnimationFrame(() => {
        setRunIndex(-1);
      });
      return () => cancelAnimationFrame(frameId);
    }
  }, [singleRunId]);

  useEffect(() => {
    if (!isMapExpanded || shouldRenderMap || typeof window === 'undefined') {
      return;
    }

    const idleCallback = window.requestIdleCallback?.bind(window);
    const cancelIdleCallback = window.cancelIdleCallback?.bind(window);
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const enableMap = () => setShouldRenderMap(true);

    if (idleCallback) {
      idleId = idleCallback(enableMap, { timeout: 900 });
    } else {
      timeoutId = window.setTimeout(enableMap, 180);
    }

    return () => {
      if (idleId !== null && cancelIdleCallback) {
        cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isMapExpanded, shouldRenderMap]);

  useEffect(() => {
    const node = mapPanelRef.current;
    if (
      !node ||
      shouldRenderMap ||
      typeof IntersectionObserver === 'undefined'
    ) {
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
  const recentRunsCard = (
    <section className="mt-2 rounded-[1.7rem] border border-[color:var(--color-primary)]/10 bg-[color:var(--color-background)]/60 p-4 text-[color:var(--color-text-primary)] lg:mr-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.72rem] font-semibold tracking-[0.04em]">
          近期跑步
        </h2>
        <span className="text-[0.68rem] text-[color:var(--color-run-date)]/65">
          累计 {recentSummary.runCount} 次
        </span>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-xs text-[color:var(--color-run-date)]/75">
          本周
        </span>
        <strong className="text-[1.7rem] leading-none font-[family:var(--font-display)] font-semibold tabular-nums">
          {recentSummary.thisWeekRuns.length}
        </strong>
        <span className="text-xs text-[color:var(--color-run-date)]/75">
          / 2 次
        </span>
      </p>
      <p className="mt-1 text-[0.72rem] text-[color:var(--color-run-date)]/75">
        {recentSummary.weekDays.size} 个跑步日 ·{' '}
        {Math.floor(recentSummary.seconds / 60)} 分钟
      </p>
      <div className="mt-4 grid grid-cols-4" aria-label="最近四周每周跑步次数">
        {recentSummary.weeks.map((week) => (
          <span
            key={week.start.toISOString()}
            className="flex flex-col items-center gap-0.5 border-r border-[color:var(--color-primary)]/8 last:border-r-0"
          >
            <strong className="text-lg leading-none font-[family:var(--font-display)] font-medium tabular-nums">
              {week.runs.length}
            </strong>
            <span className="text-[0.65rem] text-[color:var(--color-run-date)]/60">
              {week.start.toLocaleDateString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
              })}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-4 border-t border-[color:var(--color-primary)]/8 pt-3 text-[0.68rem] text-[color:var(--color-run-date)]/65">
        最近活动{' '}
        <time
          dateTime={lastSyncedAt?.replace(' ', 'T')}
          className="font-medium text-[color:var(--color-text-primary)]"
        >
          {formatActivityTime(lastSyncedAt)}
        </time>
      </p>
    </section>
  );
  return (
    <Layout>
      <Helmet>
        <html lang="zh-CN" data-theme={theme} />
      </Helmet>
      <div className="grid w-full gap-3 sm:gap-5 lg:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)] lg:items-start lg:gap-5 xl:gap-6">
        <section className="w-full lg:sticky lg:top-8">
          <div className="mb-2 grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 pt-0.5 sm:mb-2.5 sm:px-3.5 lg:mr-6">
            <h1 className="min-w-0 overflow-visible pt-[0.06em] text-[clamp(0.86rem,3.5vw,1rem)] leading-none sm:text-[1.14rem]">
              <BrandTitle
                title={siteTitle}
                prefixClassName="font-black tracking-[0.004em]"
                suffixClassName="top-[0.04em] text-[1.02em] font-semibold tracking-[0.008em]"
              />
            </h1>
            {summaryLink && (
              <a
                className="relative inline-flex h-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-primary)]/8 bg-[color:var(--color-background)]/30 px-3 text-[0.54rem] font-semibold tracking-[0.1em] text-[color:var(--color-run-date)]/64 uppercase transition-colors before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] hover:border-[color:var(--color-primary)]/14 hover:text-[color:var(--color-text-primary)]"
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
          <div className="hidden min-[769px]:block">{recentRunsCard}</div>
        </section>
        <section className="min-w-0 space-y-4 sm:space-y-6" id="map-container">
          <div
            ref={mapPanelRef}
            className={`home-map-panel map-shell ${isMapExpanded ? '' : 'map-shell-collapsed'} overflow-hidden rounded-[1.75rem] border border-[color:var(--color-primary)]/10 bg-[color:var(--color-run-row-hover-background)]/14 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-3`}
          >
            {!isMapExpanded ? (
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
            ) : shouldDisplayMap ? (
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
                  locateActivity={locateActivity}
                />
              </Suspense>
            ) : (
              <div className="flex min-h-[var(--map-height,320px)] items-center justify-center rounded-[1.35rem] border border-[color:var(--color-primary)]/6 bg-[color:var(--color-background)]/24 text-sm font-semibold text-[color:var(--color-run-date)]/66">
                准备路线地图...
              </div>
            )}
          </div>
          <div className="home-data-panel min-w-0 overflow-hidden rounded-[1.75rem] border border-[color:var(--color-primary)]/10 bg-[color:var(--color-run-row-hover-background)]/14 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
            {year === 'Total' ? (
              <SVGStat />
            ) : (
              <>
                <Suspense fallback={null}>
                  <YearCompareChart year={year} />
                </Suspense>
                <RunTable
                  runs={runs}
                  locateActivity={locateActivity}
                  runIndex={runIndex}
                  setRunIndex={setRunIndex}
                />
              </>
            )}
          </div>
        </section>
        <div className="min-[769px]:hidden">{recentRunsCard}</div>
      </div>
      {import.meta.env.VERCEL && <Analytics />}
    </Layout>
  );
};

export default Index;
