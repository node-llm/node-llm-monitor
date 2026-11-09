import { appendFile, readFile, stat } from "node:fs/promises";
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

interface EventCache {
  events: MonitoringEvent[];
  mtimeMs: number;
  size: number;
}

/**
 * File-based store for local persistence without a database.
 * Stores events as line-delimited JSON.
 */
export class FileAdapter implements MonitoringStore {
  private builder = new TimeSeriesBuilder();
  private cache: EventCache | null = null;

  constructor(private readonly filePath: string = "monitoring.log") {}

  async saveEvent(event: MonitoringEvent): Promise<void> {
    await appendFile(this.filePath, JSON.stringify(event) + "\n");
    // The file changed; force a re-read on the next query.
    this.cache = null;
  }

  private async loadEvents(): Promise<MonitoringEvent[]> {
    let stats;
    try {
      stats = await stat(this.filePath);
    } catch {
      return [];
    }

    if (this.cache && this.cache.mtimeMs === stats.mtimeMs && this.cache.size === stats.size) {
      return this.cache.events;
    }

    const content = await readFile(this.filePath, "utf-8");
    const events = content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    this.cache = { events, mtimeMs: stats.mtimeMs, size: stats.size };
    return events;
  }

  async getStats(options?: StatsFilters): Promise<MonitoringStats> {
    const events = withTags(await this.loadEvents(), options?.tags);
    return computeStats(events, options);
  }

  async getMetrics(options?: StatsFilters): Promise<MetricsData> {
    const events = withTags(await this.loadEvents(), options?.tags);
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = options?.to;
    let filtered = events.filter((e) => new Date(e.time) >= from);
    if (to) filtered = filtered.filter((e) => new Date(e.time) <= to);

    return {
      totals: computeStats(events, options),
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

    const filtered = sortByTimeDesc(filterTraces(events, options));
    const items = paginate(filtered, limit, offset).map(eventToTraceSummary);

    return { items, total: filtered.length, limit, offset };
  }

  async listTags(options?: { from?: Date; to?: Date }): Promise<TagValues> {
    return collectTags(await this.loadEvents(), options);
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    const events = await this.loadEvents();
    return events.filter((e) => e.requestId === requestId);
  }
}
