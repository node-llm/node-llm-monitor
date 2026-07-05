import type {
  MonitoringStore,
  MonitoringEvent,
  MonitoringStats,
  MetricsData,
  PaginatedTraces,
  TraceFilters
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";
import {
  filterTraces,
  sortByTimeDesc,
  paginate,
  eventToTraceSummary,
  computeStats
} from "../filterTraces.js";

export interface MemoryAdapterOptions {
  /**
   * Maximum number of events kept in memory. Oldest events are dropped
   * once the limit is exceeded, preventing unbounded growth in
   * long-running processes. Default: 10000.
   */
  maxEvents?: number;
}

/** Events are trimmed in batches to avoid an O(n) copy on every save. */
const TRIM_BATCH = 500;

/**
 * High-performance In-Memory store for development and testing.
 */
export class MemoryAdapter implements MonitoringStore {
  private events: MonitoringEvent[] = [];
  private builder = new TimeSeriesBuilder();
  private readonly maxEvents: number;

  constructor(options: MemoryAdapterOptions = {}) {
    this.maxEvents = options.maxEvents ?? 10000;
  }

  async saveEvent(event: MonitoringEvent): Promise<void> {
    this.events.push(event);
    if (this.events.length >= this.maxEvents + TRIM_BATCH) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  async getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats> {
    return computeStats(this.events, options);
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = options?.to;
    let filtered = this.events.filter((e) => new Date(e.time) >= from);

    if (to) filtered = filtered.filter((e) => new Date(e.time) <= to);

    return {
      totals: computeStats(this.events, options),
      byProvider: this.builder.buildProviderStats(filtered),
      timeSeries: this.builder.build(filtered)
    };
  }

  async listTraces(
    options: { limit?: number; offset?: number } & TraceFilters = {}
  ): Promise<PaginatedTraces> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const filtered = sortByTimeDesc(filterTraces(this.events, options));
    const items = paginate(filtered, limit, offset).map(eventToTraceSummary);

    return { items, total: filtered.length, limit, offset };
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    return this.events.filter((e) => e.requestId === requestId);
  }

  /**
   * Helper to clear todos for testing
   */
  clear() {
    this.events = [];
  }
}
