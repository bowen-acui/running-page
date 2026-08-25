import type { Activity } from '@/utils/utils';
import { isRunActivity, M_TO_DIST } from '@/utils/utils';
import type { PosterContent } from './render';

const toSeconds = (movingTime: string) => {
  const [hours = 0, minutes = 0, seconds = 0] = String(movingTime)
    .split(':')
    .map((part) => Number(part) || 0);
  return hours * 3600 + minutes * 60 + seconds;
};

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}H${pad(minutes)}'${pad(seconds)}"`
    : `${minutes}'${pad(seconds)}"`;
};

const formatPace = (paceSecondsPerKm: number) => {
  if (!Number.isFinite(paceSecondsPerKm) || paceSecondsPerKm <= 0) return '—';
  const minutes = Math.floor(paceSecondsPerKm / 60);
  const seconds = Math.floor(paceSecondsPerKm % 60);
  return `${minutes}'${String(seconds).padStart(2, '0')}"`;
};

const formatDate = (value: string) => value.slice(0, 10).replace(/-/g, '.');

/**
 * Newest first — the poster draws the last route as the primary one, so the
 * most recent run is the one that reads solid.
 */
const byDateAscending = (a: Activity, b: Activity) =>
  a.start_date_local.localeCompare(b.start_date_local);

const polylinesOf = (runs: readonly Activity[]) =>
  runs
    .map((run) => run.summary_polyline)
    .filter((line): line is string => Boolean(line));

interface Totals {
  distanceKm: number;
  seconds: number;
  count: number;
}

const totalsOf = (runs: readonly Activity[]): Totals => {
  const distanceKm = runs.reduce(
    (sum, run) => sum + (run.distance || 0) / M_TO_DIST,
    0
  );
  const seconds = runs.reduce(
    (sum, run) => sum + toSeconds(run.moving_time),
    0
  );
  return { distanceKm, seconds, count: runs.length };
};

/** Cover for a single activity. */
export const buildRunPoster = (
  run: Activity,
  athlete: string
): PosterContent => {
  const seconds = toSeconds(run.moving_time);
  const distanceKm = (run.distance || 0) / M_TO_DIST;
  const gain = Math.round(run.elevation_gain || 0);
  return {
    kicker: run.name || '跑步',
    dateLine: formatDate(run.start_date_local),
    metaLine: `${athlete} · ${run.start_date_local.slice(11, 16)}`,
    distance: distanceKm.toFixed(2),
    duration: formatDuration(seconds),
    footnote: `配速 ${formatPace(distanceKm > 0 ? seconds / distanceKm : 0)}/km   ·   爬升 ${gain} m`,
    polylines: polylinesOf([run]),
  };
};

/** Cover for one month of the current year. */
export const buildMonthPoster = (
  activities: readonly Activity[],
  year: number,
  month: number,
  athlete: string
): PosterContent => {
  const runs = activities
    .filter(isRunActivity)
    .filter((run) => {
      const date = run.start_date_local;
      return (
        Number(date.slice(0, 4)) === year && Number(date.slice(5, 7)) === month
      );
    })
    .sort(byDateAscending);

  const { distanceKm, seconds, count } = totalsOf(runs);
  const label = `${year}.${String(month).padStart(2, '0')}`;
  return {
    kicker: '本月跑量',
    dateLine: label,
    metaLine: `${athlete} · ${count} RUNS`,
    distance: distanceKm.toFixed(1),
    duration: formatDuration(seconds),
    footnote: `均配 ${formatPace(distanceKm > 0 ? seconds / distanceKm : 0)}/km   ·   ${count} 次`,
    polylines: polylinesOf(runs),
  };
};

/** Cover for a whole year. */
export const buildYearPoster = (
  activities: readonly Activity[],
  year: number,
  athlete: string
): PosterContent => {
  const runs = activities
    .filter(isRunActivity)
    .filter((run) => Number(run.start_date_local.slice(0, 4)) === year)
    .sort(byDateAscending);

  const { distanceKm, seconds, count } = totalsOf(runs);
  return {
    kicker: `${year} 年跑量`,
    dateLine: String(year),
    metaLine: `${athlete} · ${count} RUNS`,
    distance: distanceKm.toFixed(1),
    duration: formatDuration(seconds),
    footnote: `均配 ${formatPace(distanceKm > 0 ? seconds / distanceKm : 0)}/km   ·   ${count} 次`,
    polylines: polylinesOf(runs),
  };
};
