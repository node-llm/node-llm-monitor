import type { MonitoringStats, PaginatedTraces, MonitoringEvent, MetricsData } from '../types';

const API_BASE = '/api/monitor';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

export const api = {
  /**
   * Get monitoring stats (total requests, cost, avg duration, error rate)
   */
  async getStats(options?: { from?: Date }): Promise<MonitoringStats> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from.toISOString());
    const query = params.toString();
    return fetchJson<MonitoringStats>(`${API_BASE}/stats${query ? `?${query}` : ''}`);
  },

  /**
   * Get full metrics data including time series and provider breakdown
   */
  async getMetrics(options?: { from?: Date }): Promise<MetricsData> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from.toISOString());
    const query = params.toString();
    return fetchJson<MetricsData>(`${API_BASE}/metrics${query ? `?${query}` : ''}`);
  },

  /**
   * Get paginated list of traces
   */
  async getTraces(options: { limit?: number; offset?: number; from?: Date } = {}): Promise<PaginatedTraces> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    if (options.from) params.set('from', options.from.toISOString());
    
    const query = params.toString();
    return fetchJson<PaginatedTraces>(`${API_BASE}/traces${query ? `?${query}` : ''}`);
  },

  /**
   * Get events for a specific request
   */
  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    return fetchJson<MonitoringEvent[]>(`${API_BASE}/events?requestId=${encodeURIComponent(requestId)}`);
  },
};
