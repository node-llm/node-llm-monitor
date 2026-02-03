import { useState } from 'react';
import { useMonitor } from '../hooks/useMonitor';
import { 
  StatCard, 
  TraceList, 
  TraceDetail, 
  MetricsChart, 
  ProviderTable,
  TimeRangeFilter,
  DebouncedInput
} from '../components';

type View = 'metrics' | 'traces';

export function Dashboard() {
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
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              view === 'metrics'
                ? 'bg-monitor-accent text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            📊 Metrics
          </button>
          <button
            onClick={() => setView('traces')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              view === 'traces'
                ? 'bg-monitor-accent text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            🔍 Traces
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
            <span className={autoRefresh ? 'animate-pulse' : ''}>🔄</span>
            <span className="hidden sm:inline">{autoRefresh ? 'Auto' : 'Manual'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="glass rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-400">⚠️</span>
            <p className="text-sm text-red-300">{error.message}</p>
          </div>
          <button 
            onClick={refresh}
            className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid - Always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Requests"
          value={stats?.totalRequests ?? 0}
          icon="📊"
          color="default"
        />
        <StatCard
          label="Total Cost"
          value={`$${(stats?.totalCost ?? 0).toFixed(4)}`}
          icon="💰"
          color="warning"
        />
        <StatCard
          label="Avg Response Time"
          value={`${(stats?.avgDuration ?? 0).toFixed(0)}ms`}
          icon="⏱"
          color="default"
        />
        <StatCard
          label="Error Rate"
          value={`${(stats?.errorRate ?? 0).toFixed(1)}%`}
          icon="⚠️"
          color={stats && stats.errorRate > 5 ? 'error' : 'success'}
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
              title="Requests"
              data={metrics?.timeSeries.requests ?? []}
              color="#6366f1"
              unit=""
            />
            <MetricsChart
              title="Cost"
              data={metrics?.timeSeries.cost ?? []}
              color="#f59e0b"
              formatter={(v) => `$${v.toFixed(4)}`}
              unit=""
            />
            <MetricsChart
              title="Response Time"
              data={metrics?.timeSeries.duration ?? []}
              color="#22c55e"
              formatter={(v) => v.toFixed(0)}
              unit="ms"
            />
            <MetricsChart
              title="Errors"
              data={metrics?.timeSeries.errors ?? []}
              color="#ef4444"
              unit=""
            />
          </div>
        </>
      ) : (
        /* Traces View */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            
            {/* Filter Bar */}
            <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-4 rounded-xl space-y-3">
              <div className="flex gap-3">
                <DebouncedInput
                  placeholder="Search (ID, Model, Provider)..."
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-monitor-accent/50"
                  value={filters.query || ''}
                  onChange={(value) => setFilters({ ...filters, query: value || undefined })}
                />
                <select
                  className="px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-monitor-accent/50"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: (e.target.value as any) || undefined })}
                >
                  <option value="">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
              </div>
              <div className="flex gap-3">
                <DebouncedInput
                  placeholder="Provider (e.g. openai)..."
                  className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-monitor-accent/50"
                  value={filters.provider || ''}
                  onChange={(value) => setFilters({ ...filters, provider: value || undefined })}
                />
                <DebouncedInput
                  placeholder="Model (e.g. gpt-4)..."
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
              Loading...
            </>
          ) : (
            <>
              <span>🔄</span>
              Refresh
            </>
          )}
        </button>
      </div>
    </div>
  );
}
