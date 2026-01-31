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
      orderBy: { timestamp: "asc" }
    });
  }
}
