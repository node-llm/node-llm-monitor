import { describe, it, expect, beforeEach } from "vitest";
import { MemoryAdapter } from "../src/adapters/memory/MemoryAdapter.js";
import type { MonitoringEvent } from "../src/types.js";

describe("MemoryAdapter", () => {
  let adapter: MemoryAdapter;

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
    adapter = new MemoryAdapter();
  });

  it("should save and retrieve events", async () => {
    const event = createEvent();
    await adapter.saveEvent(event);

    const events = await adapter.getEvents(event.requestId);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(event);
  });

  it("should calculate correct aggregate stats", async () => {
    await adapter.saveEvent(createEvent({ eventType: "request.end", cost: 0.1, duration: 100 }));
    await adapter.saveEvent(createEvent({ eventType: "request.end", cost: 0.2, duration: 200 }));
    await adapter.saveEvent(createEvent({ eventType: "request.error", requestId: "req-err" }));

    const stats = await adapter.getStats();
    expect(stats.totalRequests).toBe(3);
    expect(stats.totalCost).toBeCloseTo(0.3);
    expect(stats.avgDuration).toBe(150);
    expect(stats.errorRate).toBeCloseTo(33.33);
  });

  it("should filter stats by time range", async () => {
    const now = Date.now();
    await adapter.saveEvent(createEvent({ time: new Date(now - 2000), eventType: "request.end" }));
    await adapter.saveEvent(createEvent({ time: new Date(now), eventType: "request.end" }));

    const statsAll = await adapter.getStats();
    expect(statsAll.totalRequests).toBe(2);

    const statsRecent = await adapter.getStats({ from: new Date(now - 500) });
    expect(statsRecent.totalRequests).toBe(1);
  });

  it("should return correct traces list with pagination", async () => {
    for (let i = 0; i < 10; i++) {
      await adapter.saveEvent(
        createEvent({
          requestId: `req-${i}`,
          eventType: i % 2 === 0 ? "request.end" : "request.error",
          time: new Date(Date.now() + i * 10) // Ensure stable sorting
        })
      );
    }

    const traces = await adapter.listTraces({ limit: 5, offset: 0 });
    expect(traces.items).toHaveLength(5);
    expect(traces.total).toBe(10);
    expect(traces.items[0]!.status).toBe("error"); // Sorted by time (latest first)
  });

  it("should return time-series metrics", async () => {
    await adapter.saveEvent(createEvent());
    const metrics = await adapter.getMetrics();

    expect(metrics.totals.totalRequests).toBe(1);
    expect(metrics.timeSeries.requests.length).toBeGreaterThan(0);
    expect(metrics.byProvider).toHaveLength(1);
  });
});
