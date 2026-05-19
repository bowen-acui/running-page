import useActivities from '@/hooks/useActivities';
import getSiteMetadata from '@/hooks/useSiteMetadata';

const formatSyncTime = (value: string | null) => {
  if (!value) return '未获取';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const DataStatusBar = () => {
  const { lastSyncedAt, activities } = useActivities();
  const { activitySource } = getSiteMetadata();

  return (
    <div className="mx-auto mt-4 max-w-screen-2xl px-4 lg:px-16">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-[1.6rem] border border-[color:var(--color-hr-primary)]/35 bg-[color:var(--color-run-row-hover-background)]/40 px-4 py-4 backdrop-blur-sm">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.3em] text-[color:var(--color-run-date)]">
            Source
          </p>
          <p className="mt-2 text-lg font-black italic text-[color:var(--color-text-primary)]">
            {activitySource}
          </p>
        </div>
        <div className="rounded-[1.6rem] border border-[color:var(--color-hr-primary)]/35 bg-[color:var(--color-run-row-hover-background)]/40 px-4 py-4 backdrop-blur-sm">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.3em] text-[color:var(--color-run-date)]">
            Last Sync
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--color-text-primary)] md:text-base">
            {formatSyncTime(lastSyncedAt)}
          </p>
        </div>
        <div className="rounded-[1.6rem] border border-[color:var(--color-hr-primary)]/35 bg-[color:var(--color-run-row-hover-background)]/40 px-4 py-4 backdrop-blur-sm">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.3em] text-[color:var(--color-run-date)]">
            Activities
          </p>
          <p className="mt-2 text-lg font-black italic text-[color:var(--color-text-primary)]">
            {activities.length}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataStatusBar;
