import type { 
  MonitoringStore, 
  MonitoringEvent, 
  MonitoringStats, 
  MetricsData, 
  PaginatedTraces 
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";

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
    const filtered = from 
      ? this.events.filter(e => new Date(e.time) >= from)
      : this.events;
    
    const requestEnds = filtered.filter(e => e.eventType === "request.end");
    const requestErrors = filtered.filter(e => e.eventType === "request.error");
    const totalRequests = requestEnds.length + requestErrors.length;
    
    return {
      totalRequests,
      totalCost: requestEnds.reduce((sum, e) => sum + (e.cost || 0), 0),
      avgDuration: totalRequests > 0 
        ? requestEnds.reduce((sum, e) => sum + (e.duration || 0), 0) / Math.max(requestEnds.length, 1)
        : 0,
      errorRate: totalRequests > 0 ? (requestErrors.length / totalRequests) * 100 : 0,
    };
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = this.events.filter(e => new Date(e.time) >= from);
    
    return {
      totals: await this.getStats(options),
      byProvider: this.builder.buildProviderStats(filtered),
      timeSeries: this.builder.build(filtered),
    };
  }

  async listTraces(options: { limit?: number; offset?: number } = {}): Promise<PaginatedTraces> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    
    const completed = this.events
      .filter(e => e.eventType === "request.end" || e.eventType === "request.error")
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const items = completed.slice(offset, offset + limit).map(e => ({
      requestId: e.requestId,
      provider: e.provider,
      model: e.model,
      startTime: new Date(new Date(e.time).getTime() - (e.duration || 0)),
      endTime: e.time,
      duration: e.duration,
      cost: e.cost,
      status: e.eventType === "request.end" ? "success" as const : "error" as const,
    } as any));

    return { items, total: completed.length, limit, offset };
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    return this.events.filter(e => e.requestId === requestId);
  }

  /**
   * Helper to clear todos for testing
   */
  clear() {
    this.events = [];
  }
}
