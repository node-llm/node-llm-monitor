import type { 
  MonitoringStore, 
  MonitoringEvent, 
  MonitoringStats, 
  MetricsData, 
  PaginatedTraces 
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";

/**
 * Drizzle Adapter for NodeLLM Monitor.
 * 
 * To use this, you must have a drizzle table defined that matches the monitoring_events schema.
 * 
 * Example Drizzle Schema (PostgreSQL):
 * 
 * export const monitoringEvents = pgTable("monitoring_events", {
 *   id: uuid("id").primaryKey().defaultRandom(),
 *   eventType: text("eventType").notNull(),
 *   requestId: text("requestId").notNull(),
 *   sessionId: text("sessionId"),
 *   transactionId: text("transactionId"),
 *   time: timestamp("time").defaultNow().notNull(),
 *   duration: integer("duration"),
 *   cost: doublePrecision("cost"),
 *   cpuTime: doublePrecision("cpuTime"),
 *   gcTime: doublePrecision("gcTime"),
 *   allocations: integer("allocations"),
 *   payload: jsonb("payload").notNull().$type<Record<string, any>>(),
 *   createdAt: timestamp("createdAt").defaultNow().notNull(),
 *   provider: text("provider").notNull(),
 *   model: text("model").notNull(),
 * });
 */
export class DrizzleAdapter implements MonitoringStore {
  private builder = new TimeSeriesBuilder();

  constructor(
    private readonly db: any,
    private readonly table: any
  ) {
    if (!db || !table) {
      throw new Error("DrizzleAdapter requires a db instance and a table reference.");
    }
  }

  async saveEvent(event: MonitoringEvent): Promise<void> {
    await this.db.insert(this.table).values({
      ...event,
      payload: event.payload
    });
  }

  async getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats> {
    // Note: This is an unoptimized implementation using findMany for generic database support.
    // In a real high-throughput production environment, we'd use raw SQL count/sum.
    const events = await this.db.select().from(this.table).where(
      options?.from ? this.getDrizzleWhereClause(options.from, options.to) : undefined
    );

    const requestEnds = events.filter((e: any) => e.eventType === "request.end");
    const requestErrors = events.filter((e: any) => e.eventType === "request.error");
    const totalRequests = requestEnds.length + requestErrors.length;

    return {
      totalRequests,
      totalCost: requestEnds.reduce((sum: number, e: any) => sum + (Number(e.cost) || 0), 0),
      avgDuration: totalRequests > 0 
        ? requestEnds.reduce((sum: number, e: any) => sum + (Number(e.duration) || 0), 0) / Math.max(requestEnds.length, 1)
        : 0,
      errorRate: totalRequests > 0 ? (requestErrors.length / totalRequests) * 100 : 0,
    };
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await this.db.select().from(this.table).where(
        this.getDrizzleWhereClause(from, options?.to)
    );

    return {
      totals: await this.getStats(options),
      byProvider: this.builder.buildProviderStats(events),
      timeSeries: this.builder.build(events),
    };
  }

  async listTraces(options: { limit?: number; offset?: number } = {}): Promise<PaginatedTraces> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Fetch traces (completed requests)
    const items = await this.db.select().from(this.table)
      .where(this.getCompletedRequestsClause())
      .limit(limit)
      .offset(offset)
      .orderBy(this.table.time, "desc");

    const totalRes = await this.db.select({ count: this.db.fn.count() }).from(this.table).where(this.getCompletedRequestsClause());
    const total = Number(totalRes[0]?.count || 0);

    return {
      items: items.map((e: any) => ({
        requestId: e.requestId,
        provider: e.provider,
        model: e.model,
        startTime: new Date(new Date(e.time).getTime() - (e.duration || 0)),
        endTime: e.time,
        duration: e.duration,
        cost: e.cost,
        status: e.eventType === "request.end" ? "success" as const : "error" as const,
      } as any)),
      total,
      limit,
      offset
    };
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    return await this.db.select().from(this.table).where(this.getRequestIdClause(requestId));
  }

  private getDrizzleWhereClause(from: Date, to?: Date) {
    const { and, gte, lte } = require("drizzle-orm");
    const conditions = [gte(this.table.time, from)];
    if (to) conditions.push(lte(this.table.time, to));
    return and(...conditions);
  }

  private getCompletedRequestsClause() {
    const { or, eq } = require("drizzle-orm");
    return or(eq(this.table.eventType, "request.end"), eq(this.table.eventType, "request.error"));
  }

  private getRequestIdClause(requestId: string) {
    const { eq } = require("drizzle-orm");
    return eq(this.table.requestId, requestId);
  }
}
