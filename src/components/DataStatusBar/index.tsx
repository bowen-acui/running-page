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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[color:var(--color-hr-primary)]/30 pb-3 text-sm text-[color:var(--color-run-date)]">
        <span>
          来源{' '}
          <strong className="font-semibold text-[color:var(--color-text-primary)]">
            {activitySource}
          </strong>
        </span>
        <span>
          同步{' '}
          <strong className="font-semibold text-[color:var(--color-text-primary)]">
            {formatSyncTime(lastSyncedAt)}
          </strong>
        </span>
        <span>
          记录{' '}
          <strong className="font-semibold text-[color:var(--color-text-primary)]">
            {activities.length}
          </strong>
        </span>
      </div>
    </div>
  );
};

export default DataStatusBar;
