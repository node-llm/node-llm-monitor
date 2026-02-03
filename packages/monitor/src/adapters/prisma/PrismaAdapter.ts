import type {
  MonitoringStore,
  MonitoringEvent,
  MonitoringStats,
  TraceSummary,
  PaginatedTraces,
  MetricsData,
  TraceFilters
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";

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

  return where;
}

/**
 * Converts a Prisma event record to a TraceSummary.
 */
function prismaEventToTraceSummary(event: any): TraceSummary {
  return {
    requestId: event.requestId,
    provider: event.provider,
    model: event.model,
    startTime: new Date(event.time.getTime() - (event.duration || 0)),
    endTime: event.time,
    duration: event.duration,
    cost: event.cost,
    cpuTime: event.cpuTime,
    allocations: event.allocations,
    status: event.eventType === "request.end" ? "success" : "error"
  };
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
        model: event.model
      }
    });
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    this.ensureValidated();
    return this.model.findMany({
      where: { requestId },
      orderBy: { time: "asc" }
    });
  }

  async getStats(options: { from?: Date; to?: Date } = {}): Promise<MonitoringStats> {
    this.ensureValidated();
    const timeFilter: any = {};
    if (options.from) timeFilter.gte = options.from;
    if (options.to) timeFilter.lte = options.to;

    const where = Object.keys(timeFilter).length > 0 ? { time: timeFilter } : {};

    const [totalRequests, totalCostData, avgDurationData, errorCount] = await Promise.all([
      this.model.count({
        where: { ...where, eventType: { in: ["request.end", "request.error"] } }
      }),
      this.model.aggregate({ where, _sum: { cost: true } }),
      this.model.aggregate({ where, _avg: { duration: true } }),
      this.model.count({ where: { ...where, eventType: "request.error" } })
    ]);

    return {
      totalRequests,
      totalCost: totalCostData._sum.cost || 0,
      avgDuration: avgDurationData._avg.duration || 0,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
  }

  async getMetrics(options: { from?: Date; to?: Date } = {}): Promise<MetricsData> {
    this.ensureValidated();
    const timeFilter: any = {};
    if (options.from) timeFilter.gte = options.from;
    if (options.to) timeFilter.lte = options.to;

    const where = Object.keys(timeFilter).length > 0 ? { time: timeFilter } : {};

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
