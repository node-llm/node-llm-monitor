import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FileAdapter } from "../src/adapters/filesystem/FileAdapter.js";
import { unlinkSync, existsSync } from "node:fs";
import type { MonitoringEvent } from "../src/types.js";

describe("FileAdapter", () => {
  const TEST_FILE = "test-monitoring.log";
  let adapter: FileAdapter;

  const createEvent = (overrides: Partial<MonitoringEvent> = {}): MonitoringEvent => ({
    id: Math.random().toString(36),
    eventType: "request.end",
    requestId: "req-123",
    time: new Date(),
    duration: 100,
    cost: 0.01,
    payload: {},
    createdAt: new Date(),
    provider: "openai",
    model: "gpt-4",
    ...overrides
  });

  beforeEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
    adapter = new FileAdapter(TEST_FILE);
  });

  afterEach(() => {
    if (existsSync(TEST_FILE)) unlinkSync(TEST_FILE);
  });

  it("should persist events to a file and read them back", async () => {
    const event = createEvent();
    await adapter.saveEvent(event);

    // Create a NEW adapter instance to verify persistence
    const newAdapter = new FileAdapter(TEST_FILE);
    const events = await newAdapter.getEvents(event.requestId);

    expect(events).toHaveLength(1);
    // Note: Dates coming back from JSON are strings, but the adapter should handle/is expected to handle comparison
    expect(events[0]!.requestId).toBe(event.requestId);
  });

  it("should calculate aggregate stats from file", async () => {
    await adapter.saveEvent(createEvent({ eventType: "request.end", cost: 0.1, duration: 100 }));
    await adapter.saveEvent(createEvent({ eventType: "request.end", cost: 0.2, duration: 200 }));

    const stats = await adapter.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalCost).toBeCloseTo(0.3);
    expect(stats.avgDuration).toBe(150);
  });

  it("should handle empty file gracefully", async () => {
    const stats = await adapter.getStats();
    expect(stats.totalRequests).toBe(0);

    const traces = await adapter.listTraces();
    expect(traces.items).toHaveLength(0);
  });

  it("should filter traces by criteria", async () => {
    // Setup generic trace
    await adapter.saveEvent(
      createEvent({
        requestId: "req-1",
        provider: "openai",
        model: "gpt-4",
        cost: 0.1,
        duration: 100
      })
    );
    // Setup different trace
    await adapter.saveEvent(
      createEvent({
        requestId: "req-2",
        provider: "anthropic",
        model: "claude-2",
        cost: 0.5,
        duration: 500,
        eventType: "request.error"
      })
    );

    // Filter by Request ID
    let traces = await adapter.listTraces({ requestId: "req-1" });
    expect(traces.items).toHaveLength(1);
    expect(traces.items[0]!.requestId).toBe("req-1");

    // Filter by Provider
    traces = await adapter.listTraces({ provider: "anthropic" });
    expect(traces.items).toHaveLength(1);
    expect(traces.items[0]!.provider).toBe("anthropic");

    // Filter by Status
    traces = await adapter.listTraces({ status: "success" });
    expect(traces.items).toHaveLength(1);
    expect(traces.items[0]!.requestId).toBe("req-1");

    traces = await adapter.listTraces({ status: "error" });
    expect(traces.items).toHaveLength(1);
    expect(traces.items[0]!.requestId).toBe("req-2");

    // Filter by Min Cost
    traces = await adapter.listTraces({ minCost: 0.4 });
    expect(traces.items).toHaveLength(1);
    expect(traces.items[0]!.requestId).toBe("req-2");

    // partial/case-insensitive match (NEW)
    traces = await adapter.listTraces({ model: "GPT" });
    expect(traces.items).toHaveLength(1);
    expect(traces.items[0]!.model).toBe("gpt-4");

    traces = await adapter.listTraces({ requestId: "REQ-" });
    expect(traces.items).toHaveLength(2);
  });

  it("should return correct list of traces", async () => {
    await adapter.saveEvent(createEvent({ requestId: "req-1", eventType: "request.end" }));
    await adapter.saveEvent(createEvent({ requestId: "req-2", eventType: "request.error" }));

    const traces = await adapter.listTraces();
    expect(traces.items).toHaveLength(2);
    expect(traces.items.find((t) => t.requestId === "req-1")!.status).toBe("success");
    expect(traces.items.find((t) => t.requestId === "req-2")!.status).toBe("error");
  });
});
