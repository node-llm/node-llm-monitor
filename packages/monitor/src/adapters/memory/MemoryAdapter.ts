import type {
  MonitoringStore,
  MonitoringEvent,
  MonitoringStats,
  MetricsData,
  PaginatedTraces,
  TraceFilters,
  StatsFilters,
  TagValues
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";
import {
  filterTraces,
  sortByTimeDesc,
  paginate,
  eventToTraceSummary,
  computeStats,
  withTags,
  collectTags
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

  async getStats(options?: StatsFilters): Promise<MonitoringStats> {
    return computeStats(withTags(this.events, options?.tags), options);
  }

  async getMetrics(options?: StatsFilters): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = options?.to;
    const tagged = withTags(this.events, options?.tags);
    let filtered = tagged.filter((e) => new Date(e.time) >= from);

    if (to) filtered = filtered.filter((e) => new Date(e.time) <= to);

    return {
      totals: computeStats(tagged, options),
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

  async listTags(options?: { from?: Date; to?: Date }): Promise<TagValues> {
    return collectTags(this.events, options);
  }

  /**
   * Helper to clear todos for testing
   */
  clear() {
    this.events = [];
  }
}
