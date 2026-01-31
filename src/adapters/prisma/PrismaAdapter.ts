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
        requestId: event.requestId,
        timestamp: event.timestamp,
        eventType: event.eventType,
        provider: event.provider,
        model: event.model,
        payload: event.payload || {}
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
