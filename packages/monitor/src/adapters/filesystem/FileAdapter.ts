import { appendFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type {
  MonitoringStore,
  MonitoringEvent,
  MonitoringStats,
  MetricsData,
  PaginatedTraces,
  TraceFilters
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";

/**
 * File-based store for local persistence without a database.
 * Stores events as line-delimited JSON.
 */
export class FileAdapter implements MonitoringStore {
  private builder = new TimeSeriesBuilder();

  constructor(private readonly filePath: string = "monitoring.log") {}

  async saveEvent(event: MonitoringEvent): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(event) + "\n");
  }

  private async loadEvents(): Promise<MonitoringEvent[]> {
    if (!existsSync(this.filePath)) return [];
    const content = await readFile(this.filePath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  }

  async getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats> {
    const events = await this.loadEvents();
    const from = options?.from;
    const to = options?.to;
    let filtered = events;

    if (from) filtered = filtered.filter((e) => new Date(e.time) >= from);
    if (to) filtered = filtered.filter((e) => new Date(e.time) <= to);

    const requestEnds = filtered.filter((e) => e.eventType === "request.end");
    const requestErrors = filtered.filter((e) => e.eventType === "request.error");
    const totalRequests = requestEnds.length + requestErrors.length;

    return {
      totalRequests,
      totalCost: requestEnds.reduce((sum, e) => sum + (e.cost || 0), 0),
      avgDuration:
        totalRequests > 0
          ? requestEnds.reduce((sum, e) => sum + (e.duration || 0), 0) /
            Math.max(requestEnds.length, 1)
          : 0,
      errorRate: totalRequests > 0 ? (requestErrors.length / totalRequests) * 100 : 0
    };
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const events = await this.loadEvents();
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = options?.to;
    let filtered = events.filter((e) => new Date(e.time) >= from);
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
    const events = await this.loadEvents();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    let filtered = events.filter(
      (e) => e.eventType === "request.end" || e.eventType === "request.error"
    );

    if (options.requestId) {
      filtered = filtered.filter((e) => e.requestId === options.requestId);
    }
    if (options.model) {
      filtered = filtered.filter((e) => e.model === options.model);
    }
    if (options.provider) {
      filtered = filtered.filter((e) => e.provider === options.provider);
    }
    if (options.minCost !== undefined) {
      filtered = filtered.filter((e) => (e.cost || 0) >= options.minCost!);
    }
    if (options.minLatency !== undefined) {
      filtered = filtered.filter((e) => (e.duration || 0) >= options.minLatency!);
    }
    if (options.status === "success") {
      filtered = filtered.filter((e) => e.eventType === "request.end");
    } else if (options.status === "error") {
      filtered = filtered.filter((e) => e.eventType === "request.error");
    }
    if (options.from) {
      filtered = filtered.filter((e) => new Date(e.time) >= options.from!);
    }
    if (options.to) {
      filtered = filtered.filter((e) => new Date(e.time) <= options.to!);
    }

    filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const items = filtered.slice(offset, offset + limit).map(
      (e) =>
        ({
          requestId: e.requestId,
          provider: e.provider,
          model: e.model,
          startTime: new Date(new Date(e.time).getTime() - (e.duration || 0)),
          endTime: e.time,
          duration: e.duration,
          cost: e.cost,
          cpuTime: e.cpuTime,
          allocations: e.allocations,
          status: e.eventType === "request.end" ? ("success" as const) : ("error" as const)
        }) as any
    );

    return { items, total: filtered.length, limit, offset };
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    const events = await this.loadEvents();
    return events.filter((e) => e.requestId === requestId);
  }
}
