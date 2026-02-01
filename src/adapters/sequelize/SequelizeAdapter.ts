import type { 
  MonitoringStore, 
  MonitoringEvent, 
  MonitoringStats, 
  MetricsData, 
  PaginatedTraces 
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";

/**
 * Sequelize Adapter for NodeLLM Monitor.
 * 
 * Example Sequelize Model Definition:
 * 
 * const MonitoringEvent = sequelize.define('monitoring_events', {
 *   id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
 *   eventType: { type: DataTypes.STRING, allowNull: false },
 *   requestId: { type: DataTypes.STRING, allowNull: false, index: true },
 *   sessionId: { type: DataTypes.STRING, index: true },
 *   transactionId: { type: DataTypes.STRING, index: true },
 *   time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, index: true },
 *   duration: DataTypes.INTEGER,
 *   cost: DataTypes.DOUBLE,
 *   cpuTime: DataTypes.DOUBLE,
 *   gcTime: DataTypes.DOUBLE,
 *   allocations: DataTypes.INTEGER,
 *   payload: { type: DataTypes.JSON, allowNull: false },
 *   createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
 *   provider: DataTypes.STRING,
 *   model: DataTypes.STRING,
 * });
 */
export class SequelizeAdapter implements MonitoringStore {
  private builder = new TimeSeriesBuilder();

  constructor(private readonly model: any) {
    if (!model) {
      throw new Error("SequelizeAdapter requires a Sequelize model instance.");
    }
  }

  async saveEvent(event: MonitoringEvent): Promise<void> {
    await this.model.create(event);
  }

  async getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats> {
    const where = this.buildWhereClause(options);
    const { Op } = require("sequelize");

    // Aggregate for total requests and errors
    const [totalRequests, errorCount] = await Promise.all([
      this.model.count({ where }),
      this.model.count({ where: { ...where, eventType: "request.error" } })
    ]);

    // Aggregate for cost and duration
    // Note: Sequelize.fn might be cleaner but requires access to the Sequelize instance.
    // We'll use findMany/reduce here for broad database compatibility,
    // or you could pass Sequelize.sequelize to the constructor for raw aggregations.
    const completed = await this.model.findAll({
      where: { ...where, eventType: "request.end" },
      attributes: ["cost", "duration"],
      raw: true
    });

    const totalCost = completed.reduce((sum: number, e: any) => sum + (Number(e.cost) || 0), 0);
    const totalDuration = completed.reduce((sum: number, e: any) => sum + (Number(e.duration) || 0), 0);
    
    return {
      totalRequests,
      totalCost,
      avgDuration: completed.length > 0 ? totalDuration / completed.length : 0,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where = this.buildWhereClause({ from, to: options?.to } as any);
    const events = await this.model.findAll({ where, raw: true });

    return {
      totals: await this.getStats(options),
      byProvider: this.builder.buildProviderStats(events),
      timeSeries: this.builder.build(events),
    };
  }

  async listTraces(options: { limit?: number; offset?: number } = {}): Promise<PaginatedTraces> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    const { Op } = require("sequelize");

    const where = { eventType: { [Op.in]: ["request.end", "request.error"] } };
    
    const [items, total] = await Promise.all([
      this.model.findAll({
        where,
        order: [["time", "DESC"]],
        limit,
        offset,
        raw: true
      }),
      this.model.count({ where })
    ]);

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
    return await this.model.findAll({ 
      where: { requestId }, 
      order: [["time", "ASC"]],
      raw: true 
    });
  }

  private buildWhereClause(options?: { from?: Date; to?: Date }) {
    if (!options?.from && !options?.to) return {};
    const { Op } = require("sequelize");
    const where: any = { time: {} };
    if (options?.from) where.time[Op.gte] = options.from;
    if (options?.to) where.time[Op.lte] = options.to;
    return where;
  }
}
