import React, { useState, useMemo, useCallback } from 'react';
import {
  sortDateFunc,
  sortDateFuncReverse,
  convertMovingTime2Sec,
  Activity,
  RunIds,
} from '@/utils/utils';
import { SHOW_ELEVATION_GAIN } from '@/utils/const';
import { DIST_UNIT } from '@/utils/utils';

import RunRow from './RunRow';
import styles from './style.module.css';

interface IRunTableProperties {
  runs: Activity[];
  locateActivity: (_runIds: RunIds) => void;
  runIndex: number;
  setRunIndex: (_index: number) => void;
}

type SortFunc = (_a: Activity, _b: Activity) => number;
type SortDirection = 'ascending' | 'descending';

interface SortState {
  direction: SortDirection;
  key: string;
}

const DEFAULT_VISIBLE_ROWS = 20;

const RunTable = ({
  runs,
  locateActivity,
  runIndex,
  setRunIndex,
}: IRunTableProperties) => {
  const [sortState, setSortState] = useState<SortState | null>(null);
  const [showAllForKey, setShowAllForKey] = useState<string | null>(null);
  const [month, setMonth] = useState('');
  const filterKey = `${runs.length}:${runs[0]?.run_id ?? ''}:${runs.at(-1)?.run_id ?? ''}:${month}`;
  const showAllRows = showAllForKey === filterKey;

  const sortKeys = useMemo(() => {
    const keys = [DIST_UNIT, 'Elev', 'Pace', 'BPM', 'Time', 'Date'];
    return SHOW_ELEVATION_GAIN ? keys : keys.filter((key) => key !== 'Elev');
  }, []);

  const getSortFunction = useCallback(
    (key: string, direction: SortDirection): SortFunc | undefined => {
      const multiplier = direction === 'ascending' ? 1 : -1;

      if (key === DIST_UNIT) {
        return (a, b) => (a.distance - b.distance) * multiplier;
      }
      if (key === 'Elev') {
        return (a, b) =>
          ((a.elevation_gain ?? 0) - (b.elevation_gain ?? 0)) * multiplier;
      }
      if (key === 'Pace') {
        return (a, b) => (a.average_speed - b.average_speed) * multiplier;
      }
      if (key === 'BPM') {
        return (a, b) =>
          ((a.average_heartrate ?? 0) - (b.average_heartrate ?? 0)) *
          multiplier;
      }
      if (key === 'Time') {
        return (a, b) =>
          (convertMovingTime2Sec(a.moving_time) -
            convertMovingTime2Sec(b.moving_time)) *
          multiplier;
      }
      if (key === 'Date') {
        return direction === 'ascending' ? sortDateFuncReverse : sortDateFunc;
      }

      return undefined;
    },
    []
  );

  const filteredRuns = useMemo(
    () =>
      runs.filter((run) => {
        const date = run.start_date_local.slice(0, 10);
        return !month || date.slice(5, 7) === month;
      }),
    [month, runs]
  );

  const sortedRuns = useMemo(() => {
    const sortedRuns = (() => {
      if (!sortState) return filteredRuns;

      const sortFunction = getSortFunction(sortState.key, sortState.direction);
      if (!sortFunction) return filteredRuns;

      return filteredRuns.slice().sort(sortFunction);
    })();

    return sortedRuns;
  }, [filteredRuns, getSortFunction, sortState]);

  const displayedRuns = useMemo(
    () =>
      showAllRows ? sortedRuns : sortedRuns.slice(0, DEFAULT_VISIBLE_ROWS),
    [showAllRows, sortedRuns]
  );

  const hiddenRunCount = Math.max(0, sortedRuns.length - displayedRuns.length);

  const runIndexById = useMemo(
    () => new Map(runs.map((run, index) => [run.run_id, index])),
    [runs]
  );

  const handleClick = useCallback(
    (key: string) => {
      setRunIndex(-1);
      setSortState((currentState) => {
        // First click on a column uses its natural starting direction
        // (Date oldest-first, everything else largest-first); clicking the
        // same column again always flips, so every column toggles both ways.
        const initialDirection = key === 'Date' ? 'ascending' : 'descending';
        const nextDirection =
          currentState?.key === key
            ? currentState.direction === 'ascending'
              ? 'descending'
              : 'ascending'
            : initialDirection;

        return { key, direction: nextDirection };
      });
    },
    [setRunIndex]
  );

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableFilters}>
        <label>
          月份
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            <option value="">全年</option>
            {[...new Set(runs.map((run) => run.start_date_local.slice(5, 7)))]
              .sort()
              .map((value) => (
                <option key={value} value={value}>
                  {Number(value)} 月
                </option>
              ))}
          </select>
        </label>
        <span>当前 {sortedRuns.length} 条</span>
      </div>
      <table className={styles.runTable} cellSpacing="0" cellPadding="0">
        <thead>
          <tr>
            <th />
            {sortKeys.map((k) => {
              const isActiveSort = sortState?.key === k;
              return (
                <th
                  key={k}
                  aria-sort={isActiveSort ? sortState.direction : undefined}
                  className={styles.sortableHeader}
                >
                  <button type="button" onClick={() => handleClick(k)}>
                    {k}
                    <span className={styles.sortIndicator} aria-hidden="true">
                      {isActiveSort
                        ? sortState.direction === 'ascending'
                          ? '▲'
                          : '▼'
                        : ''}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {displayedRuns.map((run) => {
            const sourceIndex = runIndexById.get(run.run_id) ?? -1;
            return (
              <RunRow
                key={run.run_id}
                elementIndex={sourceIndex}
                locateActivity={locateActivity}
                run={run}
                runIndex={runIndex}
                setRunIndex={setRunIndex}
              />
            );
          })}
        </tbody>
      </table>
      {sortedRuns.length === 0 && (
        <div className={styles.emptyState}>
          <span>没有符合条件的跑步记录</span>
          {month && (
            <button type="button" onClick={() => setMonth('')}>
              清空月份筛选
            </button>
          )}
        </div>
      )}
      {hiddenRunCount > 0 && (
        <div className={styles.tableHint}>
          <span>
            仅显示前 {DEFAULT_VISIBLE_ROWS} 条 / 共 {sortedRuns.length} 条
          </span>
          <button type="button" onClick={() => setShowAllForKey(filterKey)}>
            显示全部
          </button>
        </div>
      )}
      {showAllRows && sortedRuns.length > DEFAULT_VISIBLE_ROWS && (
        <div className={styles.tableHint}>
          <span>已显示全部 {sortedRuns.length} 条</span>
          <button type="button" onClick={() => setShowAllForKey(null)}>
            收起
          </button>
        </div>
      )}
    </div>
  );
};

export default RunTable;
