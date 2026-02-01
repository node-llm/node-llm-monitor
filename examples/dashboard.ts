import { Monitor } from "../src/Monitor.js";
import type { MonitoringStore, MonitoringEvent, MetricsData } from "../src/types.js";
import { TimeSeriesBuilder } from "../src/aggregation/TimeSeriesBuilder.js";
import { createServer } from "node:http";
import { MonitorDashboard } from "../src/ui/index.js";

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
    
    // Use TimeSeriesBuilder for aggregation
    const builder = new TimeSeriesBuilder();
    const totals = await this.getStats(options);
    const byProvider = builder.buildProviderStats(filteredEvents);
    const timeSeries = builder.build(filteredEvents);
    
    return {
      totals,
      byProvider,
      timeSeries,
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

// 3. Create Dashboard instance
const dashboard = new MonitorDashboard(memoryStore as any);

// 4. Start a lightweight server for the dashboard
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

// 5. Simulate LLM Lifecycle
const PROVIDERS = [
  { provider: "openai", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"], costMultiplier: 1 },
  { provider: "anthropic", models: ["claude-3-5-sonnet", "claude-3-haiku"], costMultiplier: 0.8 },
  { provider: "google", models: ["gemini-1.5-pro", "gemini-1.5-flash"], costMultiplier: 0.5 },
];

const TOOLS = ["get_weather", "search_web", "read_file", "write_code", "analyze_data"];

async function runSimulation() {
  console.log("--- Starting LLM Simulation Loop ---");
  console.log("This demo includes enhanced metadata (retries, environment, timing breakdowns)");
  
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

    // --- ENHANCED METADATA DEMO ---
    // Start with a base payload
    let payload: any = { messages: ctx.messages };
    
    // 1. Add Environment Context
    payload = monitor.enrichWithEnvironment(payload, {
      serviceName: "example-service",
      environment: "development",
      region: "us-east-1"
    });

    // 2. Add Request Details
    payload = monitor.enrichWithRequestMetadata(payload, {
      streaming: Math.random() > 0.5,
      requestSizeBytes: 150 + Math.floor(Math.random() * 200),
      templateId: "welcome-prompt",
      promptVersion: "1.0.2"
    });

    // 3. Randomly add Retry Context (20% chance)
    if (Math.random() > 0.8) {
      payload = monitor.enrichWithRetry(payload, {
        retryCount: 1,
        retryReason: "timeout"
      });
    }

    // Pass the enriched payload to onRequest (which will be saved in request.start)
    await monitor.onRequest({ ...ctx, messages: payload });
    
    // Simulate thinking/delay (variable latency)
    const baseLatency = 200 + Math.random() * 800;
    await new Promise(r => setTimeout(r, baseLatency));

    // Simulate tool calls (0-3 tools)
    const numTools = Math.floor(Math.random() * 4);
    let toolTimeTotal = 0;
    for (let i = 0; i < numTools; i++) {
      const toolName = TOOLS[Math.floor(Math.random() * TOOLS.length)];
      const tool = { id: "call_" + Math.random().toString(36).slice(2, 6), function: { name: toolName } };
      await monitor.onToolCallStart(ctx, tool);
      
      const toolDuration = 50 + Math.random() * 150;
      toolTimeTotal += toolDuration;
      await new Promise(r => setTimeout(r, toolDuration));
      
      if (Math.random() > 0.95) {
        await monitor.onToolCallError(ctx, tool, new Error("Tool execution failed"));
      } else {
        await monitor.onToolCallEnd(ctx, tool, { result: "success" });
      }
    }
    
    // Final Response Details
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

    // 4. Add Timing Breakdown for the response event
    let responsePayload: any = { 
      result: mockResponse.toString(),
      usage: mockResponse.usage 
    };
    
    responsePayload = monitor.enrichWithTiming(responsePayload, {
      queueTime: Math.random() * 5,
      networkTime: 20 + Math.random() * 50,
      providerLatency: baseLatency,
      toolTimeTotal,
      timeToFirstToken: payload.request?.streaming ? 150 + Math.random() * 100 : undefined
    });
    
    // 10% error rate
    if (Math.random() > 0.9) {
      const errors = ["API Connection Failed", "Rate limit exceeded", "Context length exceeded", "Invalid API key"];
      await monitor.onError(ctx, new Error(errors[Math.floor(Math.random() * errors.length)]));
    } else {
      // Pass the enriched response payload
      await monitor.onResponse(ctx, mockResponse);
      // Note: In real usage, you'd manually merge the enriched payload if needed, 
      // but here we just show how it would look in the store.
    }

    // Random delay between requests (500ms - 3s)
    await new Promise(r => setTimeout(r, 500 + Math.random() * 2500));
  }
}

runSimulation();
