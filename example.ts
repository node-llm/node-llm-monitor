import { Monitor } from "./src/Monitor.js";
import type { MonitoringStore, MonitoringEvent, MetricsData, ProviderStats, TimeSeriesPoint } from "./src/types.js";

// 1. Create a full-featured in-memory store for testing
const memoryStore = {
  events: [] as MonitoringEvent[],
  
  async saveEvent(event: MonitoringEvent) {
    this.events.push(event);
    console.log(`[Store] Saved: ${event.eventType} (${event.model})`);
  },
  
  async getEvents(requestId: string) {
    return this.events.filter((e: MonitoringEvent) => e.requestId === requestId);
  },
  
  async getStats(options?: { from?: Date; to?: Date }) {
    const from = options?.from;
    const filteredEvents = from 
      ? this.events.filter(e => new Date(e.time) >= from)
      : this.events;
    
    const requestEnds = filteredEvents.filter(e => e.eventType === "request.end");
    const requestErrors = filteredEvents.filter(e => e.eventType === "request.error");
    const totalRequests = requestEnds.length + requestErrors.length;
    
    return {
      totalRequests,
      totalCost: requestEnds.reduce((sum, e) => sum + (e.cost || 0), 0),
      avgDuration: totalRequests > 0 
        ? requestEnds.reduce((sum, e) => sum + (e.duration || 0), 0) / Math.max(requestEnds.length, 1)
        : 0,
      errorRate: totalRequests > 0 ? (requestErrors.length / totalRequests) * 100 : 0,
    };
  },
  
  async getMetrics(options?: { from?: Date; to?: Date }): Promise<MetricsData> {
    const from = options?.from || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const filteredEvents = this.events.filter(e => new Date(e.time) >= from);
    
    // Get totals
    const totals = await this.getStats(options);
    
    // Group by provider/model
    type ProviderStatsInternal = ProviderStats & { _totalDuration: number };
    const providerMap = new Map<string, ProviderStatsInternal>();
    for (const event of filteredEvents) {
      if (event.eventType === "request.end" || event.eventType === "request.error") {
        const key = `${event.provider}/${event.model}`;
        const existing = providerMap.get(key) || {
          provider: event.provider,
          model: event.model,
          requests: 0,
          cost: 0,
          avgDuration: 0,
          errorCount: 0,
          _totalDuration: 0,
        };
        
        existing.requests++;
        existing.cost += event.cost || 0;
        existing._totalDuration += event.duration || 0;
        if (event.eventType === "request.error") existing.errorCount++;
        existing.avgDuration = existing._totalDuration / existing.requests;
        
        providerMap.set(key, existing);
      }
    }
    
    // Build time series (group by 5-minute buckets)
    const bucketSize = 5 * 60 * 1000; // 5 minutes
    const timeSeriesMap = new Map<number, { requests: number; cost: number; duration: number; errors: number; count: number }>();
    
    for (const event of filteredEvents) {
      if (event.eventType === "request.end" || event.eventType === "request.error") {
        const bucket = Math.floor(new Date(event.time).getTime() / bucketSize) * bucketSize;
        const existing = timeSeriesMap.get(bucket) || { requests: 0, cost: 0, duration: 0, errors: 0, count: 0 };
        
        existing.requests++;
        existing.cost += event.cost || 0;
        existing.duration += event.duration || 0;
        existing.count++;
        if (event.eventType === "request.error") existing.errors++;
        
        timeSeriesMap.set(bucket, existing);
      }
    }
    
    // Convert to arrays sorted by timestamp
    const sortedBuckets = Array.from(timeSeriesMap.entries()).sort((a, b) => a[0] - b[0]);
    
    return {
      totals,
      byProvider: Array.from(providerMap.values()).map(({ _totalDuration, ...p }) => p as ProviderStats),
      timeSeries: {
        requests: sortedBuckets.map(([ts, d]) => ({ timestamp: ts, value: d.requests })),
        cost: sortedBuckets.map(([ts, d]) => ({ timestamp: ts, value: d.cost })),
        duration: sortedBuckets.map(([ts, d]) => ({ timestamp: ts, value: d.count > 0 ? d.duration / d.count : 0 })),
        errors: sortedBuckets.map(([ts, d]) => ({ timestamp: ts, value: d.errors })),
      },
    };
  },
  
  async listTraces(options: { limit?: number; offset?: number } = {}) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    
    // Get request.end and request.error events as traces
    const completedEvents = this.events
      .filter((e: MonitoringEvent) => e.eventType === "request.end" || e.eventType === "request.error")
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    
    const items = completedEvents
      .slice(offset, offset + limit)
      .map((e: MonitoringEvent) => ({
        requestId: e.requestId,
        provider: e.provider,
        model: e.model,
        startTime: new Date(new Date(e.time).getTime() - (e.duration || 0)),
        endTime: e.time,
        duration: e.duration,
        cost: e.cost,
        cpuTime: e.cpuTime,
        allocations: e.allocations,
        status: e.eventType === "request.end" ? "success" as const : "error" as const,
      }));
    
    return { items, total: completedEvents.length, limit, offset };
  }
};

// 2. Initialize the Monitor
const monitor = new Monitor({
  store: memoryStore as MonitoringStore,
  captureContent: true // Let's see the prompts
});

// 3. Mock NodeLLM Middleware Context
const ctx = {
  requestId: "req_" + Date.now(),
  provider: "openai",
  model: "gpt-4o",
  state: {},
  messages: [{ role: "user", content: "Hello Monitor!" }]
};

import { createServer } from "node:http";
import { MonitorDashboard } from "./src/ui/index.js";

// 5. Create Dashboard instance
const dashboard = new MonitorDashboard(memoryStore as any);

// 6. Start a lightweight server for the dashboard
const server = createServer(async (req, res) => {
  // Adapt Node's IncomingMessage to MonitorRequest
  const handled = await dashboard.handleRequest(
    { url: req.url ?? "", headers: req.headers as Record<string, string | undefined>, method: req.method ?? "GET" },
    res
  );
  if (!handled) {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(3333, () => {
  console.log("\n🚀 Monitor Dashboard running at http://localhost:3333/monitor");
});

// 7. Simulate LLM Lifecycle (repeatedly so we see data in dashboard)
const PROVIDERS = [
  { provider: "openai", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"], costMultiplier: 1 },
  { provider: "anthropic", models: ["claude-3-5-sonnet", "claude-3-haiku"], costMultiplier: 0.8 },
  { provider: "google", models: ["gemini-1.5-pro", "gemini-1.5-flash"], costMultiplier: 0.5 },
];

const TOOLS = ["get_weather", "search_web", "read_file", "write_code", "analyze_data"];

async function runSimulation() {
  console.log("--- Starting LLM Simulation Loop ---");
  
  while(true) {
    // Pick random provider and model
    const providerConfig = PROVIDERS[Math.floor(Math.random() * PROVIDERS.length)]!;
    const model = providerConfig.models[Math.floor(Math.random() * providerConfig.models.length)]!;
    
    const ctx: any = {
      requestId: "req_" + Math.random().toString(36).slice(2, 10),
      provider: providerConfig.provider,
      model,
      state: {},
      messages: [{ role: "user", content: "Hello Monitor!" }]
    };

    await monitor.onRequest(ctx);
    
    // Simulate thinking/delay (variable latency)
    const baseLatency = 200 + Math.random() * 800;
    await new Promise(r => setTimeout(r, baseLatency));

    // Simulate tool calls (0-3 tools)
    const numTools = Math.floor(Math.random() * 4);
    for (let i = 0; i < numTools; i++) {
      const toolName = TOOLS[Math.floor(Math.random() * TOOLS.length)];
      const tool = { id: "call_" + Math.random().toString(36).slice(2, 6), function: { name: toolName } };
      await monitor.onToolCallStart(ctx, tool);
      await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
      
      if (Math.random() > 0.95) {
        await monitor.onToolCallError(ctx, tool, new Error("Tool execution failed"));
      } else {
        await monitor.onToolCallEnd(ctx, tool, { result: "success" });
      }
    }
    
    // Final Response
    const inputTokens = 50 + Math.floor(Math.random() * 500);
    const outputTokens = 20 + Math.floor(Math.random() * 200);
    const baseCost = (inputTokens * 0.000001 + outputTokens * 0.000002) * providerConfig.costMultiplier;
    
    const mockResponse = {
      toString: () => "I am monitored!",
      usage: { 
        input_tokens: inputTokens, 
        output_tokens: outputTokens, 
        cost: baseCost
      }
    };
    
    // 10% error rate
    if (Math.random() > 0.9) {
      const errors = ["API Connection Failed", "Rate limit exceeded", "Context length exceeded", "Invalid API key"];
      await monitor.onError(ctx, new Error(errors[Math.floor(Math.random() * errors.length)]));
    } else {
      await monitor.onResponse(ctx, mockResponse);
    }

    // Random delay between requests (500ms - 3s)
    await new Promise(r => setTimeout(r, 500 + Math.random() * 2500));
  }
}

runSimulation();
