#!/usr/bin/env node
/**
 * Test that documentation examples actually work.
 * This runs real code snippets from the README/docs
 */

import assert from "node:assert";
import {
  Monitor,
  MemoryAdapter,
  PrismaAdapter,
  FileAdapter,
  createPrismaMonitor,
  createFileMonitor,
  TimeSeriesBuilder
} from "../dist/index.js";
import {
  MonitorDashboard,
  createMonitorMiddleware,
  createMonitoringRouter
} from "../dist/ui/index.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

console.log("\n📝 Testing README examples...\n");

// =============================================================================
// README: Monitor.memory() - Quick Setup
// =============================================================================
test("Monitor.memory() creates a monitor instance", () => {
  const monitor = Monitor.memory();
  assert(monitor instanceof Monitor, "Should return Monitor instance");
  assert(monitor.name === "NodeLLMMonitor", "Should have correct name");
});

test("Monitor.memory() accepts options", () => {
  const monitor = Monitor.memory({ captureContent: true });
  assert(monitor instanceof Monitor, "Should return Monitor instance with options");
});

// =============================================================================
// README: createFileMonitor() factory
// =============================================================================
test("createFileMonitor() creates a monitor with FileAdapter", () => {
  const monitor = createFileMonitor("./test-output.log");
  assert(monitor instanceof Monitor, "Should return Monitor instance");
});

// =============================================================================
// README: Adapter classes exist
// =============================================================================
test("PrismaAdapter class exists and is a function", () => {
  assert(typeof PrismaAdapter === "function", "PrismaAdapter should be a class");
});

test("FileAdapter class exists and is a function", () => {
  assert(typeof FileAdapter === "function", "FileAdapter should be a class");
});

test("createPrismaMonitor factory exists", () => {
  assert(typeof createPrismaMonitor === "function", "createPrismaMonitor should be a function");
});

// =============================================================================
// README: Manual Monitor construction
// =============================================================================
test("new Monitor({ store }) accepts MemoryAdapter", () => {
  const store = new MemoryAdapter();
  const monitor = new Monitor({ store });
  assert(monitor instanceof Monitor, "Should create Monitor with MemoryAdapter");
});

test("new Monitor({ store, captureContent, scrubbing })", () => {
  const store = new MemoryAdapter();
  const monitor = new Monitor({
    store,
    captureContent: true,
    scrubbing: { pii: true, secrets: true }
  });
  assert(monitor instanceof Monitor, "Should create Monitor with full options");
});

// =============================================================================
// README: MonitorDashboard
// =============================================================================
test("MonitorDashboard accepts store and options", () => {
  const store = new MemoryAdapter();
  const dashboard = new MonitorDashboard(store, { basePath: "/monitor" });
  assert(typeof dashboard.middleware === "function", "Should have middleware()");
  assert(typeof dashboard.handleRequest === "function", "Should have handleRequest()");
});

test("MonitorDashboard.middleware() returns a function", () => {
  const store = new MemoryAdapter();
  const dashboard = new MonitorDashboard(store);
  const middleware = dashboard.middleware();
  assert(typeof middleware === "function", "middleware() should return a function");
});

// =============================================================================
// README: monitor.api() shorthand
// =============================================================================
test("monitor.api() returns middleware function", () => {
  const monitor = Monitor.memory();
  const middleware = monitor.api({ basePath: "/monitor" });
  assert(typeof middleware === "function", "Should return middleware function");
});

// =============================================================================
// README: createMonitorMiddleware factory
// =============================================================================
test("createMonitorMiddleware() returns middleware function", () => {
  const store = new MemoryAdapter();
  const middleware = createMonitorMiddleware(store, { basePath: "/monitor" });
  assert(typeof middleware === "function", "Should return middleware function");
});

// =============================================================================
// README: createMonitoringRouter for Next.js
// =============================================================================
test("createMonitoringRouter() returns GET and POST handlers", () => {
  const store = new MemoryAdapter();
  const { GET, POST } = createMonitoringRouter(store, { basePath: "/api/monitor" });
  assert(typeof GET === "function", "Should have GET handler");
  assert(typeof POST === "function", "Should have POST handler");
});

// =============================================================================
// README: Enrichment methods
// =============================================================================
test("Monitor.enrichWithEnvironment() returns enriched payload", () => {
  const monitor = Monitor.memory();
  const payload = monitor.enrichWithEnvironment(
    {},
    {
      serviceName: "test-api",
      environment: "production"
    }
  );
  assert(payload.environment.serviceName === "test-api", "Should have serviceName");
  assert(payload.environment.environment === "production", "Should have environment");
  assert(payload.environment.nodeVersion, "Should have nodeVersion");
});

test("Monitor.enrichWithTiming() returns enriched payload", () => {
  const monitor = Monitor.memory();
  const payload = monitor.enrichWithTiming(
    {},
    {
      queueTime: 5,
      networkTime: 45,
      providerLatency: 850
    }
  );
  assert(payload.timing.queueTime === 5, "Should have queueTime");
  assert(payload.timing.networkTime === 45, "Should have networkTime");
});

test("Monitor.enrichWithRetry() returns enriched payload", () => {
  const monitor = Monitor.memory();
  const payload = monitor.enrichWithRetry(
    {},
    {
      retryCount: 3,
      retryReason: "rate_limit"
    }
  );
  assert(payload.retry.retryCount === 3, "Should have retryCount");
  assert(payload.retry.retryReason === "rate_limit", "Should have retryReason");
});

test("Monitor.enrichWithSampling() returns enriched payload", () => {
  const monitor = Monitor.memory();
  const payload = monitor.enrichWithSampling(
    {},
    {
      samplingRate: 0.1,
      sampled: true,
      samplingReason: "random"
    }
  );
  assert(payload.sampling.samplingRate === 0.1, "Should have samplingRate");
});

test("Monitor.enrichWithRequestMetadata() returns enriched payload", () => {
  const monitor = Monitor.memory();
  const payload = monitor.enrichWithRequestMetadata(
    {},
    {
      streaming: true,
      requestSizeBytes: 1024
    }
  );
  assert(payload.request.streaming === true, "Should have streaming");
  assert(payload.request.requestSizeBytes === 1024, "Should have requestSizeBytes");
});

// =============================================================================
// README: TimeSeriesBuilder
// =============================================================================
test("TimeSeriesBuilder constructs with bucket size", () => {
  const builder = new TimeSeriesBuilder(5 * 60 * 1000);
  assert(builder instanceof TimeSeriesBuilder, "Should create instance");
});

test("TimeSeriesBuilder.build() returns time series data", () => {
  const builder = new TimeSeriesBuilder(5 * 60 * 1000);
  const events = [{ eventType: "request.end", time: new Date(), cost: 0.01, duration: 100 }];
  const result = builder.build(events);
  assert(Array.isArray(result.requests), "Should have requests array");
  assert(Array.isArray(result.cost), "Should have cost array");
  assert(Array.isArray(result.duration), "Should have duration array");
  assert(Array.isArray(result.errors), "Should have errors array");
});

test("TimeSeriesBuilder.buildProviderStats() returns provider stats", () => {
  const builder = new TimeSeriesBuilder();
  const events = [
    {
      eventType: "request.end",
      time: new Date(),
      provider: "openai",
      model: "gpt-4",
      cost: 0.01,
      duration: 100
    }
  ];
  const result = builder.buildProviderStats(events);
  assert(Array.isArray(result), "Should return array");
  assert(result[0].provider === "openai", "Should have provider");
  assert(result[0].model === "gpt-4", "Should have model");
});

// =============================================================================
// README: MemoryAdapter methods
// =============================================================================
await testAsync("MemoryAdapter.saveEvent() stores events", async () => {
  const store = new MemoryAdapter();
  await store.saveEvent({
    id: "test-1",
    eventType: "request.end",
    requestId: "req-1",
    time: new Date(),
    createdAt: new Date(),
    provider: "openai",
    model: "gpt-4",
    payload: {}
  });
  const stats = await store.getStats();
  assert(stats.totalRequests >= 1, "Should have at least 1 request");
});

await testAsync("MemoryAdapter.getStats() returns stats", async () => {
  const store = new MemoryAdapter();
  const stats = await store.getStats();
  assert(typeof stats.totalRequests === "number", "Should have totalRequests");
  assert(typeof stats.totalCost === "number", "Should have totalCost");
  assert(typeof stats.avgDuration === "number", "Should have avgDuration");
  assert(typeof stats.errorRate === "number", "Should have errorRate");
});

await testAsync("MemoryAdapter.getMetrics() returns metrics", async () => {
  const store = new MemoryAdapter();
  const metrics = await store.getMetrics();
  assert(metrics.totals, "Should have totals");
  assert(Array.isArray(metrics.byProvider), "Should have byProvider array");
  assert(metrics.timeSeries, "Should have timeSeries");
});

// =============================================================================
// Summary
// =============================================================================
console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${"=".repeat(60)}\n`);

if (failed > 0) {
  console.error("❌ Some documentation examples are broken!\n");
  process.exit(1);
} else {
  console.log("✅ All documentation examples work correctly!\n");
}

// Cleanup test file
import { unlinkSync, existsSync } from "node:fs";
if (existsSync("./test-output.log")) {
  unlinkSync("./test-output.log");
}
