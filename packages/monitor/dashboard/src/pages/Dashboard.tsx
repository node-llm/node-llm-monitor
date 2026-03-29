import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMonitor } from '../hooks/useMonitor';
import { 
  StatCard, 
  TraceList, 
  TraceDetail, 
  MetricsChart, 
  ProviderTable,
  TimeRangeFilter,
  DebouncedInput,
  TokenAnalytics
} from '../components';
import {
  IconBarChart,
  IconDollar,
  IconClock,
  IconAlertTriangle,
  IconSparkle,
  IconRefresh,
  IconTarget,
  IconSearch,
} from '../components/Icons';

type View = 'metrics' | 'tokens' | 'traces';

export function Dashboard() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('metrics');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const {
    metrics,
    traces,
    selectedTrace,
    selectedEvents,
    loading,
    error,
    timeRange,
    setTimeRange,
    filters,
    setFilters,
    selectTrace,
    refresh,
  } = useMonitor({ pollInterval: autoRefresh ? 5000 : 0 });

  const stats = metrics?.totals;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setView('metrics')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              view === 'metrics'
                ? 'bg-monitor-accent text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <IconBarChart className="w-4 h-4" /> {t('navigation.metrics')}
          </button>
          <button
            onClick={() => setView('tokens')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              view === 'tokens'
                ? 'bg-monitor-accent text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <IconTarget className="w-4 h-4" /> {t('navigation.tokens')}
          </button>
          <button
            onClick={() => setView('traces')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-1.5 ${
              view === 'traces'
                ? 'bg-monitor-accent text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <IconSearch className="w-4 h-4" /> {t('navigation.traces')}
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <TimeRangeFilter value={timeRange} onChange={setTimeRange} />
          
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              autoRefresh
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
            title={autoRefresh ? 'Auto-refresh enabled (5s)' : 'Auto-refresh disabled'}
          >
            <IconRefresh className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} style={autoRefresh ? { animationDuration: '3s' } : undefined} />
            <span className="hidden sm:inline">{autoRefresh ? t('common.auto') : t('common.manual')}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="glass rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <IconAlertTriangle className="w-4 h-4 text-red-400" />
            <p className="text-sm text-red-300">{error.message}</p>
          </div>
          <button 
            onClick={refresh}
            className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Stats Grid - Always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('dashboard.totalRequests')}
          value={stats?.totalRequests ?? 0}
          icon={<IconBarChart />}
          color="default"
        />
        <StatCard
          label={t('dashboard.estCost')}
          value={`$${(stats?.totalCost ?? 0).toFixed(4)}`}
          icon={<IconDollar />}
          color="warning"
        />
        <StatCard
          label={t('dashboard.avgResponseTime')}
          value={`${(stats?.avgDuration ?? 0).toFixed(0)}ms`}
          icon={<IconClock />}
          color="default"
        />
        <StatCard
          label={t('dashboard.errorRate')}
          value={`${(stats?.errorRate ?? 0).toFixed(1)}%`}
          icon={<IconAlertTriangle />}
          color={stats && stats.errorRate > 5 ? 'error' : 'success'}
        />
        <StatCard
          label={t('dashboard.selfCorrections')}
          value={stats?.totalSelfCorrections ?? 0}
          icon={<IconSparkle />}
          color="default"
        />
      </div>

      {view === 'metrics' ? (
        <>
          {/* Provider Table */}
          <ProviderTable 
            data={metrics?.byProvider ?? []} 
            loading={loading && !metrics} 
          />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetricsChart
              title={t('dashboard.inputTokens')}
              data={metrics?.timeSeries.promptTokens ?? []}
              color="#3b82f6"
              unit=""
            />
            <MetricsChart
              title={t('dashboard.outputTokens')}
              data={metrics?.timeSeries.completionTokens ?? []}
              color="#10b981"
              unit=""
            />
            <MetricsChart
              title={t('dashboard.responseTimeTitle')}
              data={metrics?.timeSeries.duration ?? []}
              color="#22c55e"
              formatter={(v) => v.toFixed(0)}
              unit="ms"
            />
            <MetricsChart
              title={t('dashboard.errorsTitle')}
              data={metrics?.timeSeries.errors ?? []}
              color="#ef4444"
              unit=""
            />
          </div>
        </>
      ) : view === 'tokens' ? (
        /* Token Analytics View */
        <TokenAnalytics 
          metrics={metrics} 
          loading={loading && !metrics} 
        />
      ) : (
        /* Traces View */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            
            {/* Filter Bar */}
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-4 rounded-xl space-y-3">
              <div className="flex gap-3">
                <DebouncedInput
                  placeholder={t('dashboard.searchPlaceholder')}
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-monitor-accent/50"
                  value={filters.query || ''}
                  onChange={(value) => setFilters({ ...filters, query: value || undefined })}
                />
                <select
                  className="px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-monitor-accent/50"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: (e.target.value as any) || undefined })}
                >
                  <option value="">{t('common.allStatus')}</option>
                  <option value="success">{t('common.success')}</option>
                  <option value="error">{t('common.error')}</option>
                </select>
              </div>
              <div className="flex gap-3">
                <DebouncedInput
                  placeholder={t('dashboard.providerPlaceholder')}
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-monitor-accent/50"
                  value={filters.provider || ''}
                  onChange={(value) => setFilters({ ...filters, provider: value || undefined })}
                />
                <DebouncedInput
                  placeholder={t('dashboard.modelPlaceholder')}
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-monitor-accent/50"
                  value={filters.model || ''}
                  onChange={(value) => setFilters({ ...filters, model: value || undefined })}
                />
              </div>
            </div>

            <TraceList
              traces={traces}
              selectedId={selectedTrace?.requestId ?? null}
              onSelect={selectTrace}
              loading={loading && traces.length === 0}
            />
          </div>
          <div className="lg:col-span-2">
            <TraceDetail
              trace={selectedTrace}
              events={selectedEvents}
              onClose={() => selectTrace(null)}
              loading={loading && selectedTrace !== null && selectedEvents.length === 0}
            />
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="flex justify-center">
        <button
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2 text-sm bg-monitor-accent/20 hover:bg-monitor-accent/30 text-monitor-accent-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-monitor-accent-light/30 border-t-monitor-accent-light rounded-full animate-spin" />
              {t('common.loading')}
            </>
          ) : (
            <>
              <IconRefresh />
              {t('common.refresh')}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
