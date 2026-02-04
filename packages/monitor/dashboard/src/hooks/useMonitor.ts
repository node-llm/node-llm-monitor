import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../api";
import type { TraceSummary, MonitoringEvent, MetricsData, TimeRange, TraceFilters } from "../types";
import { getTimeRangeDate } from "../components/TimeRangeFilter";

interface UseMonitorOptions {
  /** Polling interval in milliseconds. Set to 0 to disable. */
  pollInterval?: number;
  /** Number of traces to fetch */
  limit?: number;
  /** Initial time range */
  initialTimeRange?: TimeRange;
}

interface UseMonitorReturn {
  metrics: MetricsData | null;
  traces: TraceSummary[];
  selectedTrace: TraceSummary | null;
  selectedEvents: MonitoringEvent[];
  loading: boolean;
  error: Error | null;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  filters: TraceFilters;
  setFilters: (filters: TraceFilters) => void;
  selectTrace: (trace: TraceSummary | null) => void;
  refresh: () => Promise<void>;
}

const DEFAULT_METRICS: MetricsData = {
  totals: {
    totalRequests: 0,
    totalCost: 0,
    avgDuration: 0,
    errorRate: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    avgTokensPerRequest: 0
  },
  byProvider: [],
  timeSeries: {
    requests: [],
    cost: [],
    duration: [],
    errors: [],
    promptTokens: [],
    completionTokens: []
  }
};

export function useMonitor(options: UseMonitorOptions = {}): UseMonitorReturn {
  const { pollInterval = 5000, limit = 50, initialTimeRange = "24h" } = options;

  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceSummary | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<MonitoringEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [filters, setFilters] = useState<TraceFilters>({});

  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const from = getTimeRangeDate(timeRange);
      const [metricsData, tracesData] = await Promise.all([
        api.getMetrics({ from }),
        api.getTraces({ limit, from, ...filters })
      ]);

      if (mountedRef.current) {
        setMetrics(metricsData);
        setTraces(tracesData.items);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error("Failed to fetch data"));
        // Use functional update to avoid stale closure
        setMetrics((prev) => prev || DEFAULT_METRICS);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [limit, timeRange, filters]);

  const selectTrace = useCallback(async (trace: TraceSummary | null) => {
    setSelectedTrace(trace);

    if (!trace) {
      setSelectedEvents([]);
      return;
    }

    setEventsLoading(true);
    try {
      const events = await api.getEvents(trace.requestId);
      if (mountedRef.current) {
        setSelectedEvents(events);
      }
    } catch (err) {
      console.error("Failed to fetch events:", err);
      if (mountedRef.current) {
        setSelectedEvents([]);
      }
    } finally {
      if (mountedRef.current) {
        setEventsLoading(false);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchData();
  }, [fetchData]);

  // Time range change handler
  const handleTimeRangeChange = useCallback((range: TimeRange) => {
    setTimeRange(range);
    setLoading(true);
  }, []);

  const handleFiltersChange = useCallback((newFilters: TraceFilters) => {
    setFilters(newFilters);
    setLoading(true);
  }, []);

  // Initial fetch and refetch on time range change
  useEffect(() => {
    mountedRef.current = true;
    fetchData();

    return () => {
      mountedRef.current = false;
      api.cleanup(); // Cancel pending requests
    };
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;

    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval, fetchData]);

  return {
    metrics,
    traces,
    selectedTrace,
    selectedEvents,
    loading: loading || eventsLoading,
    error,
    timeRange,
    setTimeRange: handleTimeRangeChange,
    filters,
    setFilters: handleFiltersChange,
    selectTrace,
    refresh
  };
}
