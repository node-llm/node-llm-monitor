import type { MonitoringStats, PaginatedTraces, MonitoringEvent, MetricsData } from '../types';

const API_BASE = './api';


class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private controllers = new Map<string, AbortController>();

  async fetchJson<T>(url: string, key: string): Promise<T> {
    // Cancel previous request for this key
    this.controllers.get(key)?.abort();
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      
      if (!response.ok) {
        throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    } catch (error) {
      // Don't throw on abort - it's expected behavior
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw error;
    } finally {
      this.controllers.delete(key);
    }
  }

  cleanup() {
    // Cancel all pending requests
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
  }
}

const client = new ApiClient();

export const api = {
  /**
   * Get monitoring stats (total requests, cost, avg duration, error rate)
   */
  async getStats(options?: { from?: Date }): Promise<MonitoringStats> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from.toISOString());
    const query = params.toString();
    return client.fetchJson<MonitoringStats>(`${API_BASE}/stats${query ? `?${query}` : ''}`, 'stats');
  },

  /**
   * Get full metrics data including time series and provider breakdown
   */
  async getMetrics(options?: { from?: Date }): Promise<MetricsData> {
    const params = new URLSearchParams();
    if (options?.from) params.set('from', options.from.toISOString());
    const query = params.toString();
    return client.fetchJson<MetricsData>(`${API_BASE}/metrics${query ? `?${query}` : ''}`, 'metrics');
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
    return client.fetchJson<PaginatedTraces>(`${API_BASE}/traces${query ? `?${query}` : ''}`, 'traces');
  },

  /**
   * Get events for a specific request
   */
  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    return client.fetchJson<MonitoringEvent[]>(`${API_BASE}/events?requestId=${encodeURIComponent(requestId)}`, `events-${requestId}`);
  },

  /**
   * Cleanup all pending requests (call on unmount)
   */
  cleanup() {
    client.cleanup();
  }
};
