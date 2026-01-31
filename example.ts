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

// 4. Simulate LLM Lifecycle
async function runSimulation() {
  console.log("--- Starting LLM Simulation ---");
  
  await monitor.onRequest(ctx);
  
  // Simulate a tool call
  const tool = { id: "call_1", function: { name: "get_weather" } };
  await monitor.onToolCallStart(ctx, tool);
  await monitor.onToolCallEnd(ctx, tool, { temp: 72 });
  
  // Final Response
  const mockResponse = {
    toString: () => "I am monitored!",
    usage: { input_tokens: 10, output_tokens: 5, cost: 0.0001 }
  };
  await monitor.onResponse(ctx, mockResponse);
  
  console.log("\n--- Collected Events in Store ---");
  console.table(memoryStore.events.map((e: MonitoringEvent) => ({
    time: e.time.toISOString().split('T')[1],
    type: e.eventType,
    model: e.model,
    cost: e.cost,
    duration: e.duration
  })));
}

runSimulation();
