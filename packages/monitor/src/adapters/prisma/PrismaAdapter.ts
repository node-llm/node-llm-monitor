import type {
  MonitoringStore,
  MonitoringEvent,
  MonitoringStats,
  TraceSummary,
  PaginatedTraces,
  MetricsData,
  TraceFilters,
  StatsFilters,
  TagValues
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";
import { extractTokenUsage } from "../tokenExtraction.js";

/**
 * A filter on the JSON tags column: every given tag must match. Needs migration 003 (tags column);
 * stores that never filter or save tags work without it.
 */
function tagsWhere(tags?: Record<string, string>): Record<string, any> {
  const entries = Object.entries(tags ?? {});
  if (entries.length === 0) return {};
  return { AND: entries.map(([key, value]) => ({ tags: { path: [key], equals: value } })) };
}

/** How many recent calls listTags reads to find tag values. */
const TAG_SCAN_LIMIT = 5000;

/**
 * Builds Prisma WHERE clause from trace filters.
 * Keeps filtering logic centralized and easier to maintain.
 */
function buildPrismaWhereClause(options: TraceFilters): Record<string, any> {
  const where: Record<string, any> = {
    eventType: { in: ["request.end", "request.error"] }
  };

  // Text search filters - case-insensitive partial matching
  if (options.requestId) {
    where.requestId = { contains: options.requestId, mode: "insensitive" };
  }

  if (options.query) {
    where.OR = [
      { requestId: { contains: options.query, mode: "insensitive" } },
      { model: { contains: options.query, mode: "insensitive" } },
      { provider: { contains: options.query, mode: "insensitive" } }
    ];
  }

  if (options.model) {
    where.model = { contains: options.model, mode: "insensitive" };
  }

  if (options.provider) {
    where.provider = { contains: options.provider, mode: "insensitive" };
  }

  // Status filter - overrides eventType
  if (options.status) {
    where.eventType = options.status.toLowerCase() === "success" ? "request.end" : "request.error";
  }

  // Numeric threshold filters
  if (options.minCost !== undefined) {
    where.cost = { gte: options.minCost };
  }

  if (options.minLatency !== undefined) {
    where.duration = { gte: options.minLatency };
  }

  // Date range filters
  if (options.from || options.to) {
    where.time = {};
    if (options.from) where.time.gte = options.from;
    if (options.to) where.time.lte = options.to;
  }

  return { ...where, ...tagsWhere(options.tags) };
}

/**
 * Converts a Prisma event record to a TraceSummary.
 */
function prismaEventToTraceSummary(event: any): TraceSummary {
  const tokens = extractTokenUsage(event.payload);
  const summary: TraceSummary = {
    requestId: event.requestId,
    provider: event.provider,
    model: event.model,
    startTime: new Date(event.time.getTime() - (event.duration || 0)),
    endTime: event.time,
    duration: event.duration,
    cost: event.cost,
    cpuTime: event.cpuTime,
    allocations: event.allocations,
    status: event.eventType === "request.end" ? "success" : "error",
    correctionRounds: event.correctionRounds
  };

  // Only set token properties if they have values
  if (tokens.prompt > 0) summary.promptTokens = tokens.prompt;
  if (tokens.completion > 0) summary.completionTokens = tokens.completion;
  if (tokens.cached > 0) summary.cachedTokens = tokens.cached;
  if (tokens.cacheCreation > 0) summary.cacheCreationTokens = tokens.cacheCreation;
  if (tokens.reasoning > 0) summary.reasoningTokens = tokens.reasoning;
  if (tokens.image > 0) summary.imageTokens = tokens.image;

  return summary;
}

export class PrismaAdapter implements MonitoringStore {
  private validated = false;

  constructor(
    private readonly prisma: any,
    private readonly tableName: string = "monitoring_events"
  ) {
    // Defer validation to first use (lazy validation)
    // This allows schemas to load asynchronously in frameworks like Next.js
  }

  private ensureValidated() {
    if (!this.validated) {
      if (!this.prisma || typeof this.prisma[this.tableName]?.create !== "function") {
        throw new Error(
          `[PrismaAdapter] Critical: Prisma model '${this.tableName}' not found or incorrectly generated.`
        );
      }
      this.validated = true;
    }
  }

  async saveEvent(event: MonitoringEvent): Promise<void> {
    this.ensureValidated();
    await this.model.create({
      data: {
        id: event.id,
        eventType: event.eventType,
        requestId: event.requestId,
        sessionId: event.sessionId,
        transactionId: event.transactionId,
        time: event.time,
        duration: event.duration,
        cost: event.cost,
        cpuTime: event.cpuTime,
        gcTime: event.gcTime,
        allocations: event.allocations,
        payload: event.payload,
        createdAt: event.createdAt,
        provider: event.provider,
        model: event.model,
        correctionRounds: event.correctionRounds,
        // Only when there are tags, so tables from before migration 003 keep working.
        ...(event.tags ? { tags: event.tags } : {})
      }
    });
  }

  async listTags(options: { from?: Date; to?: Date } = {}): Promise<TagValues> {
    this.ensureValidated();
    const time: any = {};
    if (options.from) time.gte = options.from;
    if (options.to) time.lte = options.to;
    const rows: Array<{ tags: Record<string, string> | null }> = await this.model.findMany({
      where: {
        ...(Object.keys(time).length ? { time } : {}),
        eventType: "request.end",
        NOT: { tags: { equals: null } }
      },
      select: { tags: true },
      orderBy: { time: "desc" },
      take: TAG_SCAN_LIMIT
    });
    const found = new Map<string, Set<string>>();
    for (const { tags } of rows) {
      for (const [key, value] of Object.entries(tags ?? {})) {
        if (!found.has(key)) found.set(key, new Set());
        found.get(key)!.add(String(value));
      }
    }
    return Object.fromEntries([...found].map(([key, values]) => [key, [...values].sort()]));
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    this.ensureValidated();
    return this.model.findMany({
      where: { requestId },
      orderBy: { time: "asc" }
    });
  }

  async getStats(options: StatsFilters = {}): Promise<MonitoringStats> {
    this.ensureValidated();
    const timeFilter: any = {};
    if (options.from) timeFilter.gte = options.from;
    if (options.to) timeFilter.lte = options.to;

    const where = {
      ...(Object.keys(timeFilter).length > 0 ? { time: timeFilter } : {}),
      ...tagsWhere(options.tags)
    };

    // Fetch events to calculate token counts (stored in JSON payload)
    const [
      totalRequests,
      totalCostData,
      avgDurationData,
      errorCount,
      successEvents,
      totalSelfCorrections
    ] = await Promise.all([
      this.model.count({
        where: { ...where, eventType: { in: ["request.end", "request.error"] } }
      }),
      this.model.aggregate({ where, _sum: { cost: true } }),
      this.model.aggregate({ where, _avg: { duration: true } }),
      this.model.count({ where: { ...where, eventType: "request.error" } }),
      this.model.findMany({
        where: { ...where, eventType: "request.end" },
        select: { payload: true }
      }),
      this.model
        .count({
          where: { ...where, eventType: "request.end", correctionRounds: { gt: 0 } }
        })
        .catch(() => 0) // Graceful degradation if column doesn't exist yet
    ]);

    // Aggregate token counts from payload
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    for (const event of successEvents) {
      const tokens = extractTokenUsage(event.payload);
      totalPromptTokens += tokens.prompt;
      totalCompletionTokens += tokens.completion;
    }
    const totalTokens = totalPromptTokens + totalCompletionTokens;

    return {
      totalRequests,
      totalCost: totalCostData._sum.cost || 0,
      avgDuration: avgDurationData._avg.duration || 0,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
      totalPromptTokens,
      totalCompletionTokens,
      avgTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
      totalSelfCorrections
    };
  }

  async getMetrics(options: StatsFilters = {}): Promise<MetricsData> {
    this.ensureValidated();
    // Default to the last 24h (matching MemoryAdapter/FileAdapter) so the
    // time-series query stays bounded instead of scanning the whole table.
    const timeFilter: any = {
      gte: options.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
    };
    if (options.to) timeFilter.lte = options.to;

    const where = { time: timeFilter, ...tagsWhere(options.tags) };

    const [totals, events] = await Promise.all([
      this.getStats(options),
      this.model.findMany({
        where: {
          ...where,
          eventType: { in: ["request.end", "request.error"] }
        },
        orderBy: { time: "asc" }
      })
    ]);

    const builder = new TimeSeriesBuilder();
    const byProvider = builder.buildProviderStats(events);
    const timeSeries = builder.build(events);

    return {
      totals,
      byProvider,
      timeSeries
    };
  }

  async listTraces(
    options: { limit?: number; offset?: number } & TraceFilters = {}
  ): Promise<PaginatedTraces> {
    this.ensureValidated();
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const where = buildPrismaWhereClause(options);

    const [items, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy: { time: "desc" },
        take: limit,
        skip: offset
      }),
      this.model.count({ where })
    ]);

    return {
      items: items.map(prismaEventToTraceSummary),
      total,
      limit,
      offset
    };
  }

  /**
   * Accessor for the dynamic Prisma model to ensure defensive table access.
   */
  private get model() {
    return this.prisma[this.tableName];
  }
}
