/**
 * One dropdown per tag key, such as Project or Environment, that filters every view.
 * Keys and labels come from the host's `ui.tagFilters` when set, otherwise from the tags seen.
 */
import { uiConfig } from '../ui-config';
import type { TagValues } from '../types';

interface TagFilterBarProps {
  tagValues: TagValues;
  tags: Record<string, string>;
  onChange: (tags: Record<string, string>) => void;
}

const titleCase = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]+/g, ' ');

export function TagFilterBar({ tagValues, tags, onChange }: TagFilterBarProps) {
  const filters = uiConfig.tagFilters ?? Object.keys(tagValues).sort().map((key) => ({ key, label: titleCase(key) }));
  const shown = filters.filter(({ key }) => (tagValues[key]?.length ?? 0) > 0 || tags[key]);
  if (shown.length === 0) return null;

  const set = (key: string, value: string) => {
    const next = { ...tags };
    if (value) next[key] = value;
    else delete next[key];
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filter by tag">
      {shown.map(({ key, label }) => {
        const values = tagValues[key] ?? [];
        const current = tags[key] ?? '';
        return (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">{label}</span>
            <select
              className="text-sm rounded-lg border border-monitor-border dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-monitor-accent/40"
              value={current}
              onChange={(e) => set(key, e.target.value)}
            >
              <option value="">All</option>
              {(values.includes(current) || !current ? values : [current, ...values]).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {Object.keys(tags).length > 0 && (
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-sm font-medium text-monitor-accent hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}
