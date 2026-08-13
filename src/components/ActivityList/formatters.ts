import { DIST_UNIT } from '@/utils/utils';

export const toDateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

export const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);

export const formatShortDate = (date: Date) =>
  `${date.getMonth() + 1}月${date.getDate()}日`;

export const formatPace = (paceSeconds: number) => {
  if (!Number.isFinite(paceSeconds) || paceSeconds <= 0) return '-';
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
};

export const formatDistance = (distance: number) =>
  `${distance.toFixed(1)} ${DIST_UNIT}`;

export const formatHeartRate = (heartRate: number | null) =>
  heartRate !== null ? `${Math.round(heartRate)} bpm` : '无心率';

export const getHeatLevelLabel = (level: number) => {
  switch (level) {
    case 3:
      return '高';
    case 2:
      return '中';
    case 1:
      return '轻';
    default:
      return '空白';
  }
};
