// Types shared between dashboard and server
// These mirror the types in src/types.ts

export type EventType =
  | 'request.start'
  | 'request.end'
  | 'request.error'
  | 'tool.start'
  | 'tool.end'
  | 'tool.error';

export interface MonitoringEvent {
  id: string;
  eventType: string;
  requestId: string;
  sessionId?: string;
  transactionId?: string;
  time: Date | string;
  duration?: number;
  cost?: number;
  cpuTime?: number;
  gcTime?: number;
  allocations?: number;
  payload: Record<string, any>;
  createdAt: Date | string;
  provider: string;
  model: string;
}

export interface MonitoringStats {
  totalRequests: number;
  totalCost: number;
  avgDuration: number;
  errorRate: number;
}

export interface ProviderStats {
  provider: string;
  model: string;
  requests: number;
  cost: number;
  avgDuration: number;
  errorCount: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface MetricsData {
  totals: MonitoringStats;
  byProvider: ProviderStats[];
  timeSeries: {
    requests: TimeSeriesPoint[];
    cost: TimeSeriesPoint[];
    duration: TimeSeriesPoint[];
    errors: TimeSeriesPoint[];
  };
}

export interface TraceSummary {
  requestId: string;
  provider: string;
  model: string;
  startTime: Date | string;
  endTime?: Date | string;
  duration?: number;
  cost?: number;
  cpuTime?: number;
  allocations?: number;
  status: 'success' | 'error' | 'running';
}

export interface PaginatedTraces {
  items: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

export type TimeRange = '1h' | '24h' | '7d' | '30d' | 'custom';
