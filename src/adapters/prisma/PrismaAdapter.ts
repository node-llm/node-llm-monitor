import type { 
  MonitoringStore, 
  MonitoringEvent, 
  MonitoringStats, 
  TraceSummary,
  PaginatedTraces,
  MetricsData
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";

export class PrismaAdapter implements MonitoringStore {
  constructor(
    private readonly prisma: any,
    private readonly tableName: string = "monitoring_events"
  ) {
    this.validatePrismaClient();
  }

  async saveEvent(event: MonitoringEvent): Promise<void> {
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
    return this.model.findMany({
      where: { requestId },
      orderBy: { time: "asc" }
    });
  }

  async getStats(options: { from?: Date; to?: Date } = {}): Promise<MonitoringStats> {
    const timeFilter: any = {};
    if (options.from) timeFilter.gte = options.from;
    if (options.to) timeFilter.lte = options.to;

    const where = Object.keys(timeFilter).length > 0 ? { time: timeFilter } : {};

    const [totalRequests, totalCostData, avgDurationData, errorCount] = await Promise.all([
      this.model.count({ where: { ...where, eventType: { in: ["request.end", "request.error"] } } }),
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

  async listTraces(options: { limit?: number; offset?: number } = {}): Promise<PaginatedTraces> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const [items, total] = await Promise.all([
      this.model.findMany({
        where: {
          eventType: { in: ["request.end", "request.error"] }
        },
        orderBy: { time: "desc" },
        take: limit,
        skip: offset
      }),
      this.model.count({
        where: { eventType: { in: ["request.end", "request.error"] } }
      })
    ]);

    const summaries: TraceSummary[] = items.map((e: any) => ({
      requestId: e.requestId,
      provider: e.provider,
      model: e.model,
      startTime: new Date(e.time.getTime() - (e.duration || 0)),
      endTime: e.time,
      duration: e.duration,
      cost: e.cost,
      cpuTime: e.cpuTime,
      allocations: e.allocations,
      status: e.eventType === "request.end" ? "success" : "error"
    }));

    return { items: summaries, total, limit, offset };
  }

  /**
   * Accessor for the dynamic Prisma model to ensure defensive table access.
   */
  private get model() {
    return this.prisma[this.tableName];
  }

  private validatePrismaClient() {
    if (!this.prisma || typeof this.prisma[this.tableName]?.create !== 'function') {
      throw new Error(
        `[PrismaAdapter] Critical: Prisma model '${this.tableName}' not found or incorrectly generated.`
      );
    }
  }
}
