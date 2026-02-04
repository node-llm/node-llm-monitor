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
  extractTokens
} from "../filterTraces.js";

/**
 * High-performance In-Memory store for development and testing.
 */
export class MemoryAdapter implements MonitoringStore {
  private events: MonitoringEvent[] = [];
  private builder = new TimeSeriesBuilder();

  async saveEvent(event: MonitoringEvent): Promise<void> {
    this.events.push(event);
  }

  async getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats> {
    const from = options?.from;
    const to = options?.to;
    let filtered = this.events;

    if (from) filtered = filtered.filter((e) => new Date(e.time) >= from);
    if (to) filtered = filtered.filter((e) => new Date(e.time) <= to);

    const requestEnds = filtered.filter((e) => e.eventType === "request.end");
    const requestErrors = filtered.filter((e) => e.eventType === "request.error");
    const totalRequests = requestEnds.length + requestErrors.length;

    // Aggregate token counts
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    for (const event of requestEnds) {
      const tokens = extractTokens(event);
      totalPromptTokens += tokens.prompt;
      totalCompletionTokens += tokens.completion;
    }
    const totalTokens = totalPromptTokens + totalCompletionTokens;

    return {
      totalRequests,
      totalCost: requestEnds.reduce((sum, e) => sum + (e.cost || 0), 0),
      avgDuration:
        totalRequests > 0
          ? requestEnds.reduce((sum, e) => sum + (e.duration || 0), 0) /
            Math.max(requestEnds.length, 1)
          : 0,
      errorRate: totalRequests > 0 ? (requestErrors.length / totalRequests) * 100 : 0,
      totalPromptTokens,
      totalCompletionTokens,
      avgTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0
    };
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = options?.to;
    let filtered = this.events.filter((e) => new Date(e.time) >= from);

    if (to) filtered = filtered.filter((e) => new Date(e.time) <= to);

    return {
      totals: await this.getStats(options),
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
