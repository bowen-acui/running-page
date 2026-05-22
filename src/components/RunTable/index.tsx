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
  const [showAllRows, setShowAllRows] = useState(false);

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

  const sortedRuns = useMemo(() => {
    const sortedRuns = (() => {
      if (!sortState) return runs;

      const sortFunction = getSortFunction(sortState.key, sortState.direction);
      if (!sortFunction) return runs;

      return runs.slice().sort(sortFunction);
    })();

    return sortedRuns;
  }, [getSortFunction, runs, sortState]);

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
        const initialDirection = key === 'Date' ? 'ascending' : 'descending';
        const nextDirection =
          currentState?.key === key && currentState.direction === 'descending'
            ? 'ascending'
            : initialDirection;

        return { key, direction: nextDirection };
      });
    },
    [setRunIndex]
  );

  return (
    <div className={styles.tableContainer}>
      <table className={styles.runTable} cellSpacing="0" cellPadding="0">
        <thead>
          <tr>
            <th />
            {sortKeys.map((k) => (
              <th
                key={k}
                aria-sort={
                  sortState?.key === k ? sortState.direction : undefined
                }
                className={styles.sortableHeader}
                onClick={() => handleClick(k)}
              >
                {k}
              </th>
            ))}
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
      {hiddenRunCount > 0 && (
        <div className={styles.tableHint}>
          <span>
            仅显示前 {DEFAULT_VISIBLE_ROWS} 条 / 共 {sortedRuns.length} 条
          </span>
          <button type="button" onClick={() => setShowAllRows(true)}>
            显示全部
          </button>
        </div>
      )}
      {showAllRows && sortedRuns.length > DEFAULT_VISIBLE_ROWS && (
        <div className={styles.tableHint}>
          <span>已显示全部 {sortedRuns.length} 条</span>
          <button type="button" onClick={() => setShowAllRows(false)}>
            收起
          </button>
        </div>
      )}
    </div>
  );
};

export default RunTable;
