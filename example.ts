import { Monitor } from "./src/Monitor.js";
import type { MonitoringStore, MonitoringEvent } from "./src/types.js";

// 1. Create a dummy store (in-memory) for testing
const memoryStore = {
  events: [] as MonitoringEvent[],
  async saveEvent(event: MonitoringEvent) {
    this.events.push(event);
    console.log(`[Store] Saved: ${event.eventType} (${event.model})`);
  },
  async getEvents(requestId: string) {
    return this.events.filter((e: MonitoringEvent) => e.requestId === requestId);
  },
  async getStats() {
    return { totalRequests: 0, totalCost: 0, avgDuration: 0, errorRate: 0 };
  },
  async listTraces(options: { limit?: number; offset?: number } = {}) {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;
    // Returning recent ends/errors as summaries
    const items = this.events
      .filter((e: any) => e.eventType === "request.end")
      .map((e: any) => ({
        requestId: e.requestId,
        provider: e.provider,
        model: e.model,
        startTime: new Date(e.time.getTime() - (e.duration || 0)),
        endTime: e.time,
        duration: e.duration,
        cost: e.cost,
        cpuTime: e.cpuTime,
        allocations: e.allocations,
        status: "success" as const
      }));
    return { items, total: items.length, limit, offset };
  }
};

// 2. Initialize the Monitor
const monitor = new Monitor({
  store: memoryStore,
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
  const handled = await dashboard.handleRequest(req, res);
  if (!handled) {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(3333, () => {
  console.log("\n🚀 Monitor Dashboard running at http://localhost:3333/monitor");
});

// 7. Simulate LLM Lifecycle (repeatedly so we see data in dashboard)
async function runSimulation() {
  console.log("--- Starting LLM Simulation Loop ---");
  
  while(true) {
    const ctx: any = {
      requestId: "req_" + Math.random().toString(36).slice(2, 10),
      provider: "openai",
      model: Math.random() > 0.5 ? "gpt-4o" : "gpt-4o-mini",
      state: {},
      messages: [{ role: "user", content: "Hello Monitor!" }]
    };

    await monitor.onRequest(ctx);
    
    // Simulate thinking/delay
    await new Promise(r => setTimeout(r, 200 + Math.random() * 500));

    // Simulate tool call
    if (Math.random() > 0.5) {
      const tool = { id: "call_" + Math.random().toString(36).slice(2, 6), function: { name: "get_weather" } };
      await monitor.onToolCallStart(ctx, tool);
      await new Promise(r => setTimeout(r, 100));
      await monitor.onToolCallEnd(ctx, tool, { temp: 72 });
    }
    
    // Final Response
    const mockResponse = {
      toString: () => "I am monitored!",
      usage: { 
        input_tokens: 10, 
        output_tokens: 5, 
        cost: ctx.model === "gpt-4o" ? 0.00015 : 0.00001 
      }
    };
    
    if (Math.random() > 0.9) {
      await monitor.onError(ctx, new Error("API Connection Failed"));
    } else {
      await monitor.onResponse(ctx, mockResponse);
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

runSimulation();
