import type { 
  MonitoringStore, 
  MonitoringEvent, 
  MonitoringStats, 
  MetricsData, 
  PaginatedTraces 
} from "../../types.js";
import { TimeSeriesBuilder } from "../../aggregation/TimeSeriesBuilder.js";

/**
 * Mongoose Adapter for NodeLLM Monitor.
 * 
 * Example Mongoose Schema:
 * 
 * const MonitoringEventSchema = new Schema({
 *   id: { type: String, required: true, unique: true },
 *   eventType: { type: String, required: true, index: true },
 *   requestId: { type: String, required: true, index: true },
 *   sessionId: { type: String, index: true },
 *   transactionId: { type: String, index: true },
 *   time: { type: Date, default: Date.now, index: true },
 *   duration: Number,
 *   cost: Number,
 *   cpuTime: Number,
 *   gcTime: Number,
 *   allocations: Number,
 *   payload: { type: Schema.Types.Mixed, required: true },
 *   createdAt: { type: Date, default: Date.now },
 *   provider: String,
 *   model: String,
 * });
 * 
 * const MonitoringEvent = model('MonitoringEvent', MonitoringEventSchema);
 */
export class MongooseAdapter implements MonitoringStore {
  private builder = new TimeSeriesBuilder();

  constructor(private readonly model: any) {
    if (!model) {
      throw new Error("MongooseAdapter requires a Mongoose model.");
    }
  }

  async saveEvent(event: MonitoringEvent): Promise<void> {
    await this.model.create(event);
  }

  async getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats> {
    const query = this.buildQuery(options);
    
    // Aggregate for total requests and errors
    const [totalRequests, errorCount] = await Promise.all([
      this.model.countDocuments(query),
      this.model.countDocuments({ ...query, eventType: "request.error" })
    ]);

    // Aggregate for cost and duration
    const aggregation = await this.model.aggregate([
      { $match: { ...query, eventType: "request.end" } },
      {
        $group: {
          _id: null,
          totalCost: { $sum: "$cost" },
          totalDuration: { $sum: "$duration" },
          count: { $sum: 1 }
        }
      }
    ]);

    const stats = aggregation[0] || { totalCost: 0, totalDuration: 0, count: 0 };
    
    return {
      totalRequests,
      totalCost: stats.totalCost || 0,
      avgDuration: stats.count > 0 ? stats.totalDuration / stats.count : 0,
      errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0
    };
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const query = this.buildQuery({ from, to: options?.to } as any);
    const events = await this.model.find(query).lean();

    return {
      totals: await this.getStats(options),
      byProvider: this.builder.buildProviderStats(events),
      timeSeries: this.builder.build(events),
    };
  }

  async listTraces(options: { limit?: number; offset?: number } = {}): Promise<PaginatedTraces> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    const query = { eventType: { $in: ["request.end", "request.error"] } };
    
    const [items, total] = await Promise.all([
      this.model.find(query)
        .sort({ time: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.model.countDocuments(query)
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
    return await this.model.find({ requestId }).sort({ time: 1 }).lean();
  }

  private buildQuery(options?: { from?: Date; to?: Date }) {
    const query: any = {};
    if (options?.from || options?.to) {
      query.time = {};
      if (options.from) query.time.$gte = options.from;
      if (options.to) query.time.$lte = options.to;
    }
    return query;
  }
}
