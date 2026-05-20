import React, {
  lazy,
  useState,
  Suspense,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useSyncExternalStore,
} from 'react';
import VirtualList from 'rc-virtual-list';
import { useNavigate } from 'react-router-dom';
import styles from './style.module.css';
import { ACTIVITY_TOTAL, LOADING_TEXT } from '@/utils/const';
import { totalStat, yearSummaryStats } from '@assets/index';
import { loadSvgComponent } from '@/utils/svgUtils';
import { SHOW_ELEVATION_GAIN, HOME_PAGE_TITLE } from '@/utils/const';
import { DIST_UNIT, M_TO_DIST } from '@/utils/utils';
import type { Activity } from '@/utils/utils';
import useActivities from '@/hooks/useActivities';
// Layout constants (avoid magic numbers)
const ITEM_WIDTH = 260;
const ITEM_GAP = 20;

const VIRTUAL_LIST_STYLES = {
  horizontalScrollBar: {},
  horizontalScrollBarThumb: {
    background:
      'var(--color-primary, var(--color-scrollbar-thumb, rgba(0,0,0,0.4)))',
  },
  verticalScrollBar: {},
  verticalScrollBarThumb: {
    background:
      'var(--color-primary, var(--color-scrollbar-thumb, rgba(0,0,0,0.4)))',
  },
};

interface SnapshotStore<T> {
  getSnapshot: () => T;
  getServerSnapshot: () => T;
  setSnapshot: (nextSnapshot: T) => void;
  subscribe: (listener: () => void) => () => void;
}

function createSnapshotStore<T>(initialSnapshot: T): SnapshotStore<T> {
  let snapshot = initialSnapshot;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    setSnapshot: (nextSnapshot) => {
      if (Object.is(snapshot, nextSnapshot)) return;
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const getInitialListHeight = () =>
  typeof window === 'undefined' ? 500 : Math.max(100, window.innerHeight - 40);

const getIsCompactSummary = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 768px)').matches;

const loadRoutePreview = () => import('@/components/RoutePreview');
const RoutePreview = lazy(loadRoutePreview);
const loadActivityChart = () => import('./ActivityChart');
const ActivityChart = lazy(loadActivityChart);

void loadActivityChart();

const MonthOfLifeSvg = (sportType: string) => {
  const path = sportType === 'all' ? './mol.svg' : `./mol_${sportType}.svg`;
  return lazy(() => loadSvgComponent(totalStat, path));
};

const RunningSvg = MonthOfLifeSvg('running');
const WalkingSvg = MonthOfLifeSvg('walking');
const HikingSvg = MonthOfLifeSvg('hiking');
const CyclingSvg = MonthOfLifeSvg('cycling');
const SwimmingSvg = MonthOfLifeSvg('swimming');
const SkiingSvg = MonthOfLifeSvg('skiing');
const AllSvg = MonthOfLifeSvg('all');

const yearSummarySvgs = Object.fromEntries(
  Object.keys(yearSummaryStats).map((path) => [
    path,
    lazy(() => loadSvgComponent(yearSummaryStats, path)),
  ])
);

interface ActivitySummary {
  totalDistance: number;
  totalTime: number;
  totalElevationGain: number;
  count: number;
  dailyDistances: number[];
  maxDistance: number;
  maxSpeed: number;
  location: string;
  totalHeartRate: number; // Add heart rate statistics
  heartRateCount: number;
  activities: Activity[]; // Add activities array for day interval
}

interface DisplaySummary {
  totalDistance: number;
  averageSpeed: number;
  totalTime: number;
  count: number;
  maxDistance: number;
  maxSpeed: number;
  location: string;
  totalElevationGain?: number;
  averageHeartRate?: number; // Add heart rate display
}

interface ChartData {
  day: number;
  distance: string;
}

interface ActivityCardProps {
  period: string;
  summary: DisplaySummary;
  dailyDistances: number[];
  interval: string;
  activities?: Activity[]; // Add activities for day interval
  compact?: boolean;
}

interface ActivityGroups {
  [key: string]: ActivitySummary;
}

type IntervalType = 'year' | 'month' | 'week' | 'day' | 'life';

// A row group contains multiple activity card data items that will be rendered in one virtualized row
type RowGroup = Array<{ period: string; summary: ActivitySummary }>;

interface ActivityListCache {
  activityGroups: Map<string, ActivityGroups>;
  availableYears?: string[];
  periodSummaries: Map<string, RowGroup>;
  sportTypeOptions?: string[];
}

const activityListCache = new WeakMap<Activity[], ActivityListCache>();

const getActivityListCache = (activityData: Activity[]) => {
  let cache = activityListCache.get(activityData);
  if (!cache) {
    cache = {
      activityGroups: new Map(),
      periodSummaries: new Map(),
    };
    activityListCache.set(activityData, cache);
  }
  return cache;
};

const getSportTypeOptions = (activityData: Activity[]) => {
  const cache = getActivityListCache(activityData);
  if (cache.sportTypeOptions) return cache.sportTypeOptions;

  const sportTypeSet = new Set(activityData.map((activity) => activity.type));
  if (sportTypeSet.has('Run')) {
    sportTypeSet.delete('Run');
    sportTypeSet.add('running');
  }
  if (sportTypeSet.has('Walk')) {
    sportTypeSet.delete('Walk');
    sportTypeSet.add('walking');
  }
  if (sportTypeSet.has('Ride')) {
    sportTypeSet.delete('Ride');
    sportTypeSet.add('cycling');
  }
  cache.sportTypeOptions = ['all', ...sportTypeSet];
  return cache.sportTypeOptions;
};

const getAvailableActivityYears = (activityData: Activity[]) => {
  const cache = getActivityListCache(activityData);
  if (cache.availableYears) return cache.availableYears;

  cache.availableYears = Array.from(
    new Set(
      activityData.map((activity) =>
        new Date(activity.start_date_local).getFullYear().toString()
      )
    )
  ).sort((a, b) => Number(b) - Number(a));
  return cache.availableYears;
};

const convertTimeToSeconds = (time: string): number => {
  const [hours, minutes, seconds] = time.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
};

const formatPace = (speed: number): string => {
  if (speed === 0) return `0:00 min/${DIST_UNIT}`;
  const pace = 60 / speed;
  const totalSeconds = Math.round(pace * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds} min/${DIST_UNIT}`;
};

const generateLabels = (interval: string, period: string): number[] => {
  if (interval === 'month') {
    const [year, month] = period.split('-').map(Number);
    return Array.from(
      { length: new Date(year, month, 0).getDate() },
      (_, i) => i + 1
    );
  }
  if (interval === 'week') {
    return Array.from({ length: 7 }, (_, i) => i + 1);
  }
  if (interval === 'year') {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }
  return [];
};

const matchesSportType = (activity: Activity, sportTypeArg: string) => {
  if (sportTypeArg === 'all') return true;
  if (sportTypeArg === 'running') {
    return activity.type === 'running' || activity.type === 'Run';
  }
  if (sportTypeArg === 'walking') {
    return activity.type === 'walking' || activity.type === 'Walk';
  }
  if (sportTypeArg === 'cycling') {
    return activity.type === 'cycling' || activity.type === 'Ride';
  }
  return activity.type === sportTypeArg;
};

const createEmptyActivitySummary = (): ActivitySummary => ({
  totalDistance: 0,
  totalTime: 0,
  totalElevationGain: 0,
  count: 0,
  dailyDistances: [],
  maxDistance: 0,
  maxSpeed: 0,
  location: '',
  totalHeartRate: 0,
  heartRateCount: 0,
  activities: [],
});

const getActivitySummaryCacheKey = (
  intervalArg: IntervalType,
  sportTypeArg: string
) => `${intervalArg}:${sportTypeArg}`;

const groupActivitiesByInterval = (
  activityData: Activity[],
  intervalArg: IntervalType,
  sportTypeArg: string
): ActivityGroups => {
  const cache = getActivityListCache(activityData);
  const cacheKey = getActivitySummaryCacheKey(intervalArg, sportTypeArg);
  const cachedGroups = cache.activityGroups.get(cacheKey);
  if (cachedGroups) return cachedGroups;

  const activityGroups = activityData
    .filter((activity) => matchesSportType(activity, sportTypeArg))
    .reduce((acc: ActivityGroups, activity) => {
      const date = new Date(activity.start_date_local);
      let key: string;
      let index: number;
      switch (intervalArg) {
        case 'year':
          key = date.getFullYear().toString();
          index = date.getMonth();
          break;
        case 'month':
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          index = date.getDate() - 1;
          break;
        case 'week': {
          const currentDate = new Date(date.valueOf());
          currentDate.setDate(
            currentDate.getDate() + 4 - (currentDate.getDay() || 7)
          );
          const yearStart = new Date(currentDate.getFullYear(), 0, 1);
          const weekNum = Math.ceil(
            ((currentDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
          );
          key = `${currentDate.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
          index = (date.getDay() + 6) % 7;
          break;
        }
        case 'day':
          key = date.toLocaleDateString('zh').replaceAll('/', '-');
          index = 0;
          break;
        default:
          key = date.getFullYear().toString();
          index = 0;
      }

      if (!acc[key]) acc[key] = createEmptyActivitySummary();

      const distance = activity.distance / M_TO_DIST;
      const timeInSeconds = convertTimeToSeconds(activity.moving_time);
      const speed = timeInSeconds > 0 ? distance / (timeInSeconds / 3600) : 0;

      acc[key].totalDistance += distance;
      acc[key].totalTime += timeInSeconds;

      if (SHOW_ELEVATION_GAIN && activity.elevation_gain) {
        acc[key].totalElevationGain += activity.elevation_gain;
      }

      if (activity.average_heartrate) {
        acc[key].totalHeartRate += activity.average_heartrate;
        acc[key].heartRateCount += 1;
      }

      acc[key].count += 1;
      if (intervalArg === 'day') acc[key].activities.push(activity);
      acc[key].dailyDistances[index] =
        (acc[key].dailyDistances[index] || 0) + distance;
      if (distance > acc[key].maxDistance) acc[key].maxDistance = distance;
      if (speed > acc[key].maxSpeed) acc[key].maxSpeed = speed;
      if (intervalArg === 'day')
        acc[key].location = activity.location_country || '';

      return acc;
    }, {} as ActivityGroups);

  cache.activityGroups.set(cacheKey, activityGroups);
  return activityGroups;
};

const sortPeriodSummaries = (
  activitiesByInterval: ActivityGroups,
  interval: IntervalType
): RowGroup =>
  Object.entries(activitiesByInterval)
    .sort(([a], [b]) => {
      if (interval === 'day') {
        return new Date(b).getTime() - new Date(a).getTime();
      }
      if (interval === 'week') {
        const [yearA, weekA] = a.split('-W').map(Number);
        const [yearB, weekB] = b.split('-W').map(Number);
        return yearB - yearA || weekB - weekA;
      }
      const [yearA, monthA = 0] = a.split('-').map(Number);
      const [yearB, monthB = 0] = b.split('-').map(Number);
      return yearB - yearA || monthB - monthA;
    })
    .map(([period, summary]) => ({ period, summary }));

const getPeriodSummaries = (
  activityData: Activity[],
  intervalArg: IntervalType,
  sportTypeArg: string
): RowGroup => {
  const cache = getActivityListCache(activityData);
  const cacheKey = getActivitySummaryCacheKey(intervalArg, sportTypeArg);
  const cachedSummaries = cache.periodSummaries.get(cacheKey);
  if (cachedSummaries) return cachedSummaries;

  const summaries = sortPeriodSummaries(
    groupActivitiesByInterval(activityData, intervalArg, sportTypeArg),
    intervalArg
  );
  cache.periodSummaries.set(cacheKey, summaries);
  return summaries;
};

const toDisplaySummary = (summary: ActivitySummary): DisplaySummary => ({
  totalDistance: summary.totalDistance,
  averageSpeed: summary.totalTime
    ? summary.totalDistance / (summary.totalTime / 3600)
    : 0,
  totalTime: summary.totalTime,
  count: summary.count,
  maxDistance: summary.maxDistance,
  maxSpeed: summary.maxSpeed,
  location: summary.location,
  totalElevationGain: SHOW_ELEVATION_GAIN
    ? summary.totalElevationGain
    : undefined,
  averageHeartRate:
    summary.heartRateCount > 0
      ? summary.totalHeartRate / summary.heartRateCount
      : undefined,
});

function useActivityListMeasurements(itemWidth: number, gap: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const sampleRef = useRef<HTMLDivElement | null>(null);
  const containerResizeObserverRef = useRef<ResizeObserver | null>(null);
  const filterResizeObserverRef = useRef<ResizeObserver | null>(null);
  const sampleResizeObserverRef = useRef<ResizeObserver | null>(null);
  const layoutFrameRef = useRef<number | null>(null);

  const itemsPerRowStore = useMemo(() => createSnapshotStore(0), []);
  const rowHeightStore = useMemo(() => createSnapshotStore(360), []);
  const listHeightStore = useMemo(
    () => createSnapshotStore(getInitialListHeight()),
    []
  );

  const itemsPerRow = useSyncExternalStore(
    itemsPerRowStore.subscribe,
    itemsPerRowStore.getSnapshot,
    itemsPerRowStore.getServerSnapshot
  );
  const rowHeight = useSyncExternalStore(
    rowHeightStore.subscribe,
    rowHeightStore.getSnapshot,
    rowHeightStore.getServerSnapshot
  );
  const listHeight = useSyncExternalStore(
    listHeightStore.subscribe,
    listHeightStore.getSnapshot,
    listHeightStore.getServerSnapshot
  );

  const updateItemsPerRow = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.clientWidth;
    const count = Math.floor((containerWidth + gap) / (itemWidth + gap));
    itemsPerRowStore.setSnapshot(count);
  }, [gap, itemWidth, itemsPerRowStore]);

  const updateListHeight = useCallback(() => {
    const filterH = filterRef.current?.clientHeight || 0;
    const containerEl = containerRef.current;
    let topOffset = 0;
    if (containerEl) {
      const rect = containerEl.getBoundingClientRect();
      topOffset = Math.max(0, rect.top);
    }

    const base = topOffset || filterH || 0;
    let bottomPadding = 16;
    if (containerEl?.parentElement) {
      try {
        const parentRect = containerEl.parentElement.getBoundingClientRect();
        const containerRect = containerEl.getBoundingClientRect();
        const distanceToParentBottom = Math.max(
          0,
          parentRect.bottom - containerRect.bottom
        );
        bottomPadding = Math.min(
          48,
          Math.max(8, Math.round(distanceToParentBottom / 4))
        );
      } catch (e) {
        console.error(e);
      }
    }

    listHeightStore.setSnapshot(
      Math.max(100, window.innerHeight - base - bottomPadding)
    );
  }, [listHeightStore]);

  const updateRowHeight = useCallback(() => {
    const height = sampleRef.current?.offsetHeight ?? 0;
    if (height) rowHeightStore.setSnapshot(height);
  }, [rowHeightStore]);

  const updateMeasurements = useCallback(() => {
    updateItemsPerRow();
    updateListHeight();
    updateRowHeight();
  }, [updateItemsPerRow, updateListHeight, updateRowHeight]);

  const scheduleMeasurementUpdate = useCallback(() => {
    if (layoutFrameRef.current !== null) {
      cancelAnimationFrame(layoutFrameRef.current);
    }

    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = null;
      updateMeasurements();
    });
  }, [updateMeasurements]);

  const disconnectContainerObserver = useCallback(() => {
    containerResizeObserverRef.current?.disconnect();
    containerResizeObserverRef.current = null;
  }, []);

  const disconnectFilterObserver = useCallback(() => {
    filterResizeObserverRef.current?.disconnect();
    filterResizeObserverRef.current = null;
  }, []);

  const disconnectSampleObserver = useCallback(() => {
    sampleResizeObserverRef.current?.disconnect();
    sampleResizeObserverRef.current = null;
  }, []);

  const setSummaryContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      disconnectContainerObserver();
      containerRef.current = node;

      if (!node) {
        itemsPerRowStore.setSnapshot(0);
        return;
      }

      const observer = new ResizeObserver(scheduleMeasurementUpdate);
      observer.observe(node);
      containerResizeObserverRef.current = observer;
      scheduleMeasurementUpdate();
    },
    [disconnectContainerObserver, itemsPerRowStore, scheduleMeasurementUpdate]
  );

  const setFilterContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      disconnectFilterObserver();
      filterRef.current = node;

      if (!node) return;

      const observer = new ResizeObserver(scheduleMeasurementUpdate);
      observer.observe(node);
      filterResizeObserverRef.current = observer;
      scheduleMeasurementUpdate();
    },
    [disconnectFilterObserver, scheduleMeasurementUpdate]
  );

  const setSampleCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      disconnectSampleObserver();
      sampleRef.current = node;

      if (!node) return;

      const observer = new ResizeObserver(scheduleMeasurementUpdate);
      observer.observe(node);
      sampleResizeObserverRef.current = observer;
      scheduleMeasurementUpdate();
    },
    [disconnectSampleObserver, scheduleMeasurementUpdate]
  );

  useEffect(() => {
    scheduleMeasurementUpdate();
    window.addEventListener('resize', scheduleMeasurementUpdate);
    return () => {
      window.removeEventListener('resize', scheduleMeasurementUpdate);
    };
  }, [scheduleMeasurementUpdate]);

  useEffect(
    () => () => {
      disconnectContainerObserver();
      disconnectFilterObserver();
      disconnectSampleObserver();
      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }
    },
    [
      disconnectContainerObserver,
      disconnectFilterObserver,
      disconnectSampleObserver,
    ]
  );

  return {
    itemsPerRow,
    listHeight,
    rowHeight,
    setFilterContainerRef,
    setSampleCardRef,
    setSummaryContainerRef,
  };
}

function useCompactSummaryLayout() {
  const [isCompact, setIsCompact] = useState(getIsCompactSummary);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = () => setIsCompact(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isCompact;
}

const ActivityCardInner: React.FC<ActivityCardProps> = ({
  period,
  summary,
  dailyDistances,
  interval,
  activities = [],
  compact = false,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const showChart = !compact && ['month', 'week', 'year'].includes(interval);
  const handleCardClick = useCallback(() => {
    if (interval === 'day' && activities.length > 0) {
      setIsFlipped((current) => !current);
    }
  }, [activities.length, interval]);

  const data: ChartData[] = useMemo(() => {
    if (!showChart) return [];
    return generateLabels(interval, period).map((day) => ({
      day,
      distance: (dailyDistances[day - 1] || 0).toFixed(2),
    }));
  }, [dailyDistances, interval, period, showChart]);

  const { yAxisMax, yAxisTicks } = useMemo(() => {
    if (!showChart) {
      return { yAxisMax: 0, yAxisTicks: [] };
    }
    const max = Math.ceil(
      Math.max(...data.map((d) => parseFloat(d.distance))) + 10
    );
    return {
      yAxisMax: max,
      yAxisTicks: Array.from(
        { length: Math.ceil(max / 5) + 1 },
        (_, i) => i * 5
      ),
    };
  }, [data, showChart]);

  const metricItems = [
    {
      label: ACTIVITY_TOTAL.AVERAGE_SPEED_TITLE,
      value: formatPace(summary.averageSpeed),
    },
    {
      label: ACTIVITY_TOTAL.TOTAL_TIME_TITLE,
      value: formatTime(summary.totalTime),
    },
    ...(summary.averageHeartRate !== undefined
      ? [
          {
            label: ACTIVITY_TOTAL.AVERAGE_HEART_RATE_TITLE,
            value: `${summary.averageHeartRate.toFixed(0)} bpm`,
          },
        ]
      : []),
    ...(SHOW_ELEVATION_GAIN && summary.totalElevationGain !== undefined
      ? [
          {
            label: ACTIVITY_TOTAL.TOTAL_ELEVATION_GAIN_TITLE,
            value: `${summary.totalElevationGain.toFixed(0)} m`,
          },
        ]
      : []),
    ...(interval !== 'day'
      ? [
          {
            label: ACTIVITY_TOTAL.MAX_DISTANCE_TITLE,
            value: `${summary.maxDistance.toFixed(2)} ${DIST_UNIT}`,
          },
          {
            label: ACTIVITY_TOTAL.MAX_SPEED_TITLE,
            value: formatPace(summary.maxSpeed),
          },
          {
            label: ACTIVITY_TOTAL.AVERAGE_DISTANCE_TITLE,
            value: `${(summary.totalDistance / summary.count).toFixed(2)} ${DIST_UNIT}`,
          },
        ]
      : []),
  ];

  return (
    <div
      className={`${styles.activityCard} ${interval === 'day' ? `${styles.activityCardDay} ${styles.activityCardFlippable}` : ''}`}
      onClick={handleCardClick}
      style={{
        cursor:
          interval === 'day' && activities.length > 0 ? 'pointer' : 'default',
      }}
    >
      <div className={`${styles.cardInner} ${isFlipped ? styles.flipped : ''}`}>
        {/* Front side - Activity details */}
        <div className={styles.cardFront}>
          <div className={styles.cardHeader}>
            <h2 className={styles.activityName}>{period}</h2>
            {interval === 'day' && summary.count > 1 && (
              <span className={styles.activityCount}>{summary.count} 次</span>
            )}
            {interval !== 'day' && (
              <span className={styles.activityCount}>{summary.count} 次</span>
            )}
          </div>
          <div className={styles.primaryMetric}>
            <span>{ACTIVITY_TOTAL.TOTAL_DISTANCE_TITLE}</span>
            <strong>
              {summary.totalDistance.toFixed(2)}
              <small>{DIST_UNIT}</small>
            </strong>
          </div>
          <div className={styles.activityDetails}>
            {metricItems.map((item) => (
              <p key={`${item.label}-${item.value}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </p>
            ))}
          </div>
          {showChart && (
            <div className={styles.chart}>
              <Suspense fallback={null}>
                <ActivityChart
                  data={data}
                  yAxisMax={yAxisMax}
                  yAxisTicks={yAxisTicks}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* Back side - Route preview */}
        {interval === 'day' && activities.length > 0 && (
          <div className={styles.cardBack}>
            <div className={styles.routeContainer}>
              <Suspense fallback={null}>
                <RoutePreview activities={activities} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// custom equality for memo: compare key summary fields, dailyDistances values and activities length
const activityCardAreEqual = (
  prev: ActivityCardProps,
  next: ActivityCardProps
) => {
  if (prev.period !== next.period) return false;
  if (prev.interval !== next.interval) return false;
  if (prev.compact !== next.compact) return false;
  const s1 = prev.summary;
  const s2 = next.summary;
  if (
    s1.totalDistance !== s2.totalDistance ||
    s1.averageSpeed !== s2.averageSpeed ||
    s1.totalTime !== s2.totalTime ||
    s1.count !== s2.count ||
    s1.maxDistance !== s2.maxDistance ||
    s1.maxSpeed !== s2.maxSpeed ||
    s1.location !== s2.location ||
    (s1.totalElevationGain ?? undefined) !==
      (s2.totalElevationGain ?? undefined) ||
    (s1.averageHeartRate ?? undefined) !== (s2.averageHeartRate ?? undefined)
  ) {
    return false;
  }
  const d1 = prev.dailyDistances || [];
  const d2 = next.dailyDistances || [];
  if (d1.length !== d2.length) return false;
  for (let i = 0; i < d1.length; i++) if (d1[i] !== d2[i]) return false;
  const a1 = prev.activities || [];
  const a2 = next.activities || [];
  if (a1.length !== a2.length) return false;
  return true;
};

const ActivityCard = React.memo(ActivityCardInner, activityCardAreEqual);

const ActivityList: React.FC = () => {
  const { activities: activityData } = useActivities();
  const [interval, setInterval] = useState<IntervalType>('month');
  const [sportType, setSportType] = useState<string>('running');
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const isCompact = useCompactSummaryLayout();

  const availableYears = useMemo(
    () => getAvailableActivityYears(activityData),
    [activityData]
  );
  const sportTypeOptions = useMemo(
    () => getSportTypeOptions(activityData),
    [activityData]
  );

  // Keyboard navigation for year selection in Life view
  useEffect(() => {
    if (interval !== 'life') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;

      // Prevent default scrolling behavior
      e.preventDefault();

      // Remove focus from current element to avoid visual confusion
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      const currentIndex = selectedYear
        ? availableYears.indexOf(selectedYear)
        : -1;

      if (e.key === 'ArrowLeft') {
        // Move to newer year (left in UI, lower index since sorted descending)
        if (currentIndex === -1) {
          // No year selected, select the last (oldest) year
          setSelectedYear(availableYears[availableYears.length - 1]);
        } else if (currentIndex > 0) {
          setSelectedYear(availableYears[currentIndex - 1]);
        } else if (currentIndex === 0) {
          // At the most recent year, deselect to show Life view
          setSelectedYear(null);
        }
      } else if (e.key === 'ArrowRight') {
        // Move to older year (right in UI, higher index since sorted descending)
        if (currentIndex === -1) {
          // No year selected, select the first (most recent) year
          setSelectedYear(availableYears[0]);
        } else if (currentIndex < availableYears.length - 1) {
          setSelectedYear(availableYears[currentIndex + 1]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interval, selectedYear, availableYears]);

  const navigate = useNavigate();

  const handleHomeClick = () => {
    navigate('/');
  };

  function toggleInterval(newInterval: IntervalType): void {
    if (newInterval === 'life' && sportType !== 'all') {
      setSportType('all');
    }
    if (newInterval === 'day') {
      void loadRoutePreview();
    }
    setInterval(newInterval);
  }

  const dataList = useMemo(
    () => getPeriodSummaries(activityData, interval, sportType),
    [activityData, interval, sportType]
  );

  const {
    itemsPerRow,
    listHeight,
    rowHeight,
    setFilterContainerRef,
    setSampleCardRef,
    setSummaryContainerRef,
  } = useActivityListMeasurements(ITEM_WIDTH, ITEM_GAP);

  // ref to the VirtualList DOM node so we can control scroll position
  const virtualListRef = useRef<HTMLDivElement | null>(null);

  // when the interval changes, scroll the virtual list to top to improve UX
  useEffect(() => {
    // attempt to find the virtual list DOM node and reset scrollTop
    const resetScroll = () => {
      // prefer an explicit ref if available
      const el =
        virtualListRef.current || document.querySelector('.rc-virtual-list');
      if (el) {
        try {
          el.scrollTop = 0;
        } catch (e) {
          console.error(e);
        }
      }
    };

    // Defer to next frame so the list has time to re-render with new data
    const id = requestAnimationFrame(() => requestAnimationFrame(resetScroll));
    // also fallback to a short timeout
    const t = setTimeout(resetScroll, 50);

    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [interval, sportType]);

  const calcGroup: RowGroup[] = useMemo(() => {
    if (itemsPerRow < 1) return [];
    const groupLength = Math.ceil(dataList.length / itemsPerRow);
    const arr: RowGroup[] = [];
    for (let i = 0; i < groupLength; i++) {
      const start = i * itemsPerRow;
      arr.push(dataList.slice(start, start + itemsPerRow));
    }
    return arr;
  }, [dataList, itemsPerRow]);

  // compute a row width so we can center the VirtualList and keep cards left-aligned inside
  const rowWidth =
    isCompact || itemsPerRow < 1
      ? '100%'
      : `${itemsPerRow * ITEM_WIDTH + Math.max(0, itemsPerRow - 1) * ITEM_GAP}px`;

  const loading = itemsPerRow < 1 || !rowHeight;
  const itemGap = isCompact ? 12 : ITEM_GAP;
  const viewportHeight =
    typeof window === 'undefined' ? 500 : window.innerHeight;
  const virtualListHeight = isCompact
    ? Math.max(360, Math.min(listHeight, viewportHeight - 120))
    : listHeight;
  const SelectedYearSvg = selectedYear
    ? yearSummarySvgs[`./year_summary_${selectedYear}.svg`]
    : null;

  return (
    <div className={styles.activityList}>
      <div className={styles.filterContainer} ref={setFilterContainerRef}>
        <button className={styles.smallHomeButton} onClick={handleHomeClick}>
          {HOME_PAGE_TITLE}
        </button>
        <select
          onChange={(e) => setSportType(e.target.value)}
          value={sportType}
        >
          {sportTypeOptions.map((type) => (
            <option
              key={type}
              value={type}
              disabled={interval === 'life' && type !== 'all'}
            >
              {type}
            </option>
          ))}
        </select>
        <select
          onChange={(e) => toggleInterval(e.target.value as IntervalType)}
          value={interval}
        >
          <option value="year">{ACTIVITY_TOTAL.YEARLY_TITLE}</option>
          <option value="month">{ACTIVITY_TOTAL.MONTHLY_TITLE}</option>
          <option value="week">{ACTIVITY_TOTAL.WEEKLY_TITLE}</option>
          <option value="day">{ACTIVITY_TOTAL.DAILY_TITLE}</option>
          <option value="life">Life</option>
        </select>
      </div>

      {interval === 'life' && (
        <div className={styles.lifeContainer}>
          {/* Year selector buttons */}
          <div className={styles.yearSelector}>
            {availableYears.map((year) => (
              <button
                key={year}
                className={`${styles.yearButton} ${selectedYear === year ? styles.yearButtonActive : ''}`}
                onClick={() =>
                  setSelectedYear(selectedYear === year ? null : year)
                }
              >
                {year}
              </button>
            ))}
          </div>
          <Suspense fallback={<div>Loading SVG...</div>}>
            {SelectedYearSvg ? (
              // Show Year Summary SVG when a year is selected
              <SelectedYearSvg className={styles.yearSummarySvg} />
            ) : (
              // Show Life SVG when no year is selected
              <>
                {(sportType === 'running' || sportType === 'Run') && (
                  <RunningSvg className={styles.lifeSvg} />
                )}
                {sportType === 'walking' && (
                  <WalkingSvg className={styles.lifeSvg} />
                )}
                {sportType === 'hiking' && (
                  <HikingSvg className={styles.lifeSvg} />
                )}
                {sportType === 'cycling' && (
                  <CyclingSvg className={styles.lifeSvg} />
                )}
                {sportType === 'swimming' && (
                  <SwimmingSvg className={styles.lifeSvg} />
                )}
                {sportType === 'skiing' && (
                  <SkiingSvg className={styles.lifeSvg} />
                )}
                {sportType === 'all' && <AllSvg className={styles.lifeSvg} />}
              </>
            )}
          </Suspense>
        </div>
      )}

      {interval !== 'life' && (
        <div className={styles.summaryContainer} ref={setSummaryContainerRef}>
          {isCompact ? (
            <div className={styles.mobileCardList}>
              {dataList.map((cardData) => (
                <ActivityCard
                  key={cardData.period}
                  period={cardData.period}
                  summary={toDisplaySummary(cardData.summary)}
                  dailyDistances={cardData.summary.dailyDistances}
                  interval={interval}
                  compact={isCompact}
                  activities={
                    interval === 'day' ? cardData.summary.activities : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <>
              {/* hidden sample card for measuring row height */}
              <div
                style={{
                  position: 'absolute',
                  visibility: 'hidden',
                  pointerEvents: 'none',
                  height: 'auto',
                  width: ITEM_WIDTH,
                }}
                ref={setSampleCardRef}
              >
                {dataList[0] && (
                  <ActivityCard
                    key={dataList[0].period}
                    period={dataList[0].period}
                    summary={toDisplaySummary(dataList[0].summary)}
                    dailyDistances={dataList[0].summary.dailyDistances}
                    interval={interval}
                    compact={isCompact}
                    activities={
                      interval === 'day'
                        ? dataList[0].summary.activities
                        : undefined
                    }
                  />
                )}
              </div>
              <div className={styles.summaryInner}>
                <div style={{ width: rowWidth }}>
                  {loading ? (
                    // Use full viewport height (or viewport minus filter height if available) to avoid flicker
                    <div
                      style={{
                        height: virtualListHeight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <div
                        style={{
                          padding: 20,
                          color: 'var(--color-run-table-thead)',
                        }}
                      >
                        {LOADING_TEXT}
                      </div>
                    </div>
                  ) : (
                    <VirtualList
                      key={`${sportType}-${interval}-${itemsPerRow}-${isCompact ? 'compact' : 'wide'}`}
                      data={calcGroup}
                      height={virtualListHeight}
                      itemHeight={rowHeight}
                      itemKey={(row: RowGroup) => row[0]?.period ?? ''}
                      styles={VIRTUAL_LIST_STYLES}
                    >
                      {(row: RowGroup) => (
                        <div
                          ref={virtualListRef}
                          className={styles.rowContainer}
                          style={{ gap: `${itemGap}px` }}
                        >
                          {row.map(
                            (cardData: {
                              period: string;
                              summary: ActivitySummary;
                            }) => (
                              <ActivityCard
                                key={cardData.period}
                                period={cardData.period}
                                summary={toDisplaySummary(cardData.summary)}
                                dailyDistances={cardData.summary.dailyDistances}
                                interval={interval}
                                compact={isCompact}
                                activities={
                                  interval === 'day'
                                    ? cardData.summary.activities
                                    : undefined
                                }
                              />
                            )
                          )}
                        </div>
                      )}
                    </VirtualList>
                  )}
                </div>
              </div>
            </>
          )}
          {isCompact && dataList.length === 0 && (
            <div
              style={{
                minHeight: 240,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  padding: 20,
                  color: 'var(--color-run-table-thead)',
                }}
              >
                {LOADING_TEXT}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ActivityList;
