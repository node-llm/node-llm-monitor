import { useTranslation } from 'react-i18next';
import type { TimeRange } from '../types';

interface TimeRangeFilterProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function TimeRangeFilter({ value, onChange }: TimeRangeFilterProps) {
  const { t } = useTranslation();

  const ranges: { value: TimeRange; label: string }[] = [
    { value: '1h', label: t('metrics.lastHour') },
    { value: '24h', label: t('metrics.last24h') },
    { value: '7d', label: t('metrics.last7d') },
    { value: '30d', label: t('metrics.last30d') },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-600 uppercase tracking-wider">{t('metrics.timeRange')}</span>
      <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 border border-monitor-border dark:border-slate-700">
        {ranges.map((range) => (
          <button
            key={range.value}
            onClick={() => onChange(range.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              value === range.value
                ? 'bg-monitor-accent text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}
