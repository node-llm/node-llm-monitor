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

  it("should return correct list of traces", async () => {
    await adapter.saveEvent(createEvent({ requestId: "req-1", eventType: "request.end" }));
    await adapter.saveEvent(createEvent({ requestId: "req-2", eventType: "request.error" }));

    const traces = await adapter.listTraces();
    expect(traces.items).toHaveLength(2);
    expect(traces.items.find((t) => t.requestId === "req-1")!.status).toBe("success");
    expect(traces.items.find((t) => t.requestId === "req-2")!.status).toBe("error");
  });
});
