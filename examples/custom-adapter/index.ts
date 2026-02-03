import { Monitor } from "@node-llm/monitor";
import type { 
  MonitoringStore, 
  MonitoringEvent, 
  MetricsData, 
  MonitoringStats,
  PaginatedTraces,
  TraceFilters,
  TraceSummary
} from "@node-llm/monitor";
import { TimeSeriesBuilder } from "@node-llm/monitor";
import { createServer } from "node:http";
import { MonitorDashboard } from "@node-llm/monitor/ui";
import "dotenv/config";

/**
 * Custom Simple Adapter (In-Memory for Demo)
 * 
 * This demonstrates how to build a custom adapter that supports filtering.
 * In a real production system, this would interact with Knex, pg, TypeORM,
 * or even a remote telemetry service.
 */
class SimpleLogStore implements MonitoringStore {
  private events: MonitoringEvent[] = [];
  private builder = new TimeSeriesBuilder();

  async saveEvent(event: MonitoringEvent) {
    this.events.push(event);
    console.log(`[CustomStore] Event tracked: ${event.eventType} on ${event.model}`);
  }

  async getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats> {
    const from = options?.from;
    const filtered = from 
      ? this.events.filter(e => new Date(e.time) >= from)
      : this.events;
    
    const requestEnds = filtered.filter(e => e.eventType === "request.end");
    const requestErrors = filtered.filter(e => e.eventType === "request.error");
    const totalRequests = requestEnds.length + requestErrors.length;
    
    return {
      totalRequests,
      totalCost: requestEnds.reduce((sum, e) => sum + (e.cost || 0), 0),
      avgDuration: totalRequests > 0 
        ? requestEnds.reduce((sum, e) => sum + (e.duration || 0), 0) / Math.max(requestEnds.length, 1)
        : 0,
      errorRate: totalRequests > 0 ? (requestErrors.length / totalRequests) * 100 : 0,
    };
  }

  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filtered = this.events.filter(e => new Date(e.time) >= from);
    
    return {
      totals: await this.getStats(options),
      byProvider: this.builder.buildProviderStats(filtered),
      timeSeries: this.builder.build(filtered),
    };
  }

  async listTraces(options: { limit?: number; offset?: number } & TraceFilters = {}): Promise<PaginatedTraces> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Start with terminal events only
    let filtered = this.events.filter(
      e => e.eventType === "request.end" || e.eventType === "request.error"
    );

    // Apply filters - case-insensitive partial matching
    if (options.requestId) {
      const search = options.requestId.toLowerCase();
      filtered = filtered.filter(e => e.requestId.toLowerCase().includes(search));
    }

    if (options.query) {
      const search = options.query.toLowerCase();
      filtered = filtered.filter(e => 
        e.requestId.toLowerCase().includes(search) ||
        e.model.toLowerCase().includes(search) ||
        e.provider.toLowerCase().includes(search)
      );
    }

    if (options.provider) {
      const search = options.provider.toLowerCase();
      filtered = filtered.filter(e => e.provider.toLowerCase().includes(search));
    }

    if (options.model) {
      const search = options.model.toLowerCase();
      filtered = filtered.filter(e => e.model.toLowerCase().includes(search));
    }

    if (options.status) {
      const eventType = options.status === "success" ? "request.end" : "request.error";
      filtered = filtered.filter(e => e.eventType === eventType);
    }

    if (options.minCost !== undefined) {
      filtered = filtered.filter(e => (e.cost || 0) >= options.minCost!);
    }

    if (options.minLatency !== undefined) {
      filtered = filtered.filter(e => (e.duration || 0) >= options.minLatency!);
    }

    if (options.from) {
      filtered = filtered.filter(e => new Date(e.time) >= options.from!);
    }

    if (options.to) {
      filtered = filtered.filter(e => new Date(e.time) <= options.to!);
    }

    // Sort by time descending
    filtered.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const items: TraceSummary[] = filtered.slice(offset, offset + limit).map(e => ({
      requestId: e.requestId,
      provider: e.provider,
      model: e.model,
      startTime: new Date(new Date(e.time).getTime() - (e.duration || 0)),
      endTime: e.time,
      duration: e.duration,
      cost: e.cost,
      status: e.eventType === "request.end" ? "success" : "error",
    }));

    return { items, total: filtered.length, limit, offset };
  }

  async getEvents(requestId: string): Promise<MonitoringEvent[]> {
    return this.events.filter(e => e.requestId === requestId);
  }
}

// --- SETUP ---

const myCustomStore = new SimpleLogStore();

const monitor = new Monitor({
  store: myCustomStore,
  captureContent: true
});

const dashboard = new MonitorDashboard(myCustomStore);

const server = createServer(async (req, res) => {
  const handled = await dashboard.handleRequest(
    { url: req.url, headers: req.headers, method: req.method },
    res as any
  );
  if (!handled) {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(3333, () => {
  console.log("\n🚀 Custom Adapter Demo running at http://localhost:3333/monitor");
});

// --- SIMULATION ---

async function simulate() {
  console.log("Simulating requests to custom adapter...");
  
  while(true) {
    const ctx = {
      requestId: "custom_" + Math.random().toString(36).slice(2, 8),
      provider: "mock-llm",
      model: "brain-v1",
      state: {} // Required for metrics tracking
    };

    await monitor.onRequest(ctx as any);
    await new Promise(r => setTimeout(r, 100 + Math.random() * 400));
    
    await monitor.onResponse(ctx as any, {
      usage: { input_tokens: 10, output_tokens: 20, cost: 0.001 },
      toString: () => "Mock response"
    });

    await new Promise(r => setTimeout(r, 2000));
  }
}

simulate();
