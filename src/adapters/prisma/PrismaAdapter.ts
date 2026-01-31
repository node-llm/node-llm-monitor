import type { MonitoringStore, MonitoringEvent } from "../../types.js";

/**
 * Prisma adapter for NodeLLM Monitor.
 * Expects a model named 'llm_monitoring_events' (or similar) in your schema.
 */
export class PrismaAdapter implements MonitoringStore {
  constructor(
    private prisma: any,
    private tableName: string = "llm_monitoring_events"
  ) {}

  async saveEvent(event: MonitoringEvent): Promise<void> {
    await this.prisma[this.tableName].create({
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
        payload: event.payload || {},
        createdAt: event.createdAt,
        provider: event.provider,
        model: event.model
      }
    });
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    return this.prisma[this.tableName].findMany({
      where: { requestId },
      orderBy: { time: "asc" }
    });
  }

  async getStats(options: { from?: Date; to?: Date } = {}): Promise<any> {
    const where: any = {};
    if (options.from || options.to) {
      where.time = {};
      if (options.from) where.time.gte = options.from;
      if (options.to) where.time.lte = options.to;
    }

    const [totalRequests, totalCostData, avgDurationData, errorCount] = await Promise.all([
      this.prisma[this.tableName].count({ where: { ...where, eventType: "request.start" } }),
      this.prisma[this.tableName].aggregate({ where, _sum: { cost: true } }),
      this.prisma[this.tableName].aggregate({ where, _avg: { duration: true } }),
      this.prisma[this.tableName].count({ where: { ...where, eventType: "request.error" } })
    ]);

    return {
      totalRequests,
      totalCost: totalCostData._sum.cost || 0,
      avgDuration: avgDurationData._avg.duration || 0,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
  }

  async listTraces(options: { limit?: number; offset?: number } = {}): Promise<any[]> {
    const events = await this.prisma[this.tableName].findMany({
      where: {
        eventType: { in: ["request.end", "request.error"] }
      },
      orderBy: { time: "desc" },
      take: options.limit || 50,
      skip: options.offset || 0
    });

    return events.map((e: any) => ({
      requestId: e.requestId,
      provider: e.provider,
      model: e.model,
      startTime: new Date(e.time.getTime() - (e.duration || 0)),
      endTime: e.time,
      duration: e.duration,
      cost: e.cost,
      status: e.eventType === "request.end" ? "success" : "error"
    }));
  }
}
