import { describe, it, expect } from "vitest";
import {
  filterTraces,
  sortByTimeDesc,
  paginate,
  eventToTraceSummary
} from "../src/adapters/filterTraces.js";
import type { MonitoringEvent } from "../src/types.js";

function createEvent(overrides: Partial<MonitoringEvent> = {}): MonitoringEvent {
  return {
    requestId: "req-123",
    provider: "openai",
    model: "gpt-4",
    time: new Date("2026-02-01T10:00:00Z"),
    eventType: "request.end",
    cost: 0.05,
    duration: 500,
    cpuTime: 100,
    allocations: 1024,
    inputTokens: 100,
    outputTokens: 50,
    ...overrides
  };
}

describe("filterTraces", () => {
  const events: MonitoringEvent[] = [
    createEvent({
      requestId: "req-1",
      provider: "openai",
      model: "gpt-4",
      eventType: "request.end"
    }),
    createEvent({
      requestId: "req-2",
      provider: "anthropic",
      model: "claude-3",
      eventType: "request.error"
    }),
    createEvent({
      requestId: "req-3",
      provider: "openai",
      model: "gpt-3.5-turbo",
      eventType: "request.end",
      cost: 0.01
    }),
    // Non-terminal event - should be excluded
    createEvent({ requestId: "req-4", eventType: "request.start" })
  ];

  it("should only include terminal events (request.end or request.error)", () => {
    const result = filterTraces(events);
    expect(result).toHaveLength(3);
    expect(
      result.every((e) => e.eventType === "request.end" || e.eventType === "request.error")
    ).toBe(true);
  });

  it("should filter by requestId (case-insensitive partial match)", () => {
    const result = filterTraces(events, { requestId: "REQ-1" });
    expect(result).toHaveLength(1);
    expect(result[0]!.requestId).toBe("req-1");
  });

  it("should filter by query across requestId, model, and provider", () => {
    // Match by provider
    let result = filterTraces(events, { query: "anthropic" });
    expect(result).toHaveLength(1);
    expect(result[0]!.provider).toBe("anthropic");

    // Match by model
    result = filterTraces(events, { query: "gpt" });
    expect(result).toHaveLength(2);

    // Match by requestId
    result = filterTraces(events, { query: "req-3" });
    expect(result).toHaveLength(1);
  });

  it("should filter by model (case-insensitive partial match)", () => {
    const result = filterTraces(events, { model: "GPT" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.model.toLowerCase().includes("gpt"))).toBe(true);
  });

  it("should filter by provider (case-insensitive partial match)", () => {
    const result = filterTraces(events, { provider: "OPENAI" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.provider === "openai")).toBe(true);
  });

  it("should filter by status success", () => {
    const result = filterTraces(events, { status: "success" });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.eventType === "request.end")).toBe(true);
  });

  it("should filter by status error", () => {
    const result = filterTraces(events, { status: "error" });
    expect(result).toHaveLength(1);
    expect(result[0]!.eventType).toBe("request.error");
  });

  it("should filter by minCost", () => {
    const result = filterTraces(events, { minCost: 0.04 });
    expect(result).toHaveLength(2); // Events with cost >= 0.04 (default 0.05)
  });

  it("should filter by minLatency", () => {
    const result = filterTraces(events, { minLatency: 500 });
    expect(result).toHaveLength(3); // All have duration 500
  });

  it("should filter by date range (from)", () => {
    const eventsWithDates: MonitoringEvent[] = [
      createEvent({ requestId: "old", time: new Date("2026-01-01T10:00:00Z") }),
      createEvent({ requestId: "new", time: new Date("2026-02-01T10:00:00Z") })
    ];
    const result = filterTraces(eventsWithDates, { from: new Date("2026-01-15T00:00:00Z") });
    expect(result).toHaveLength(1);
    expect(result[0]!.requestId).toBe("new");
  });

  it("should filter by date range (to)", () => {
    const eventsWithDates: MonitoringEvent[] = [
      createEvent({ requestId: "old", time: new Date("2026-01-01T10:00:00Z") }),
      createEvent({ requestId: "new", time: new Date("2026-02-01T10:00:00Z") })
    ];
    const result = filterTraces(eventsWithDates, { to: new Date("2026-01-15T00:00:00Z") });
    expect(result).toHaveLength(1);
    expect(result[0]!.requestId).toBe("old");
  });

  it("should combine multiple filters with AND logic", () => {
    const result = filterTraces(events, {
      provider: "openai",
      status: "success"
    });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.provider === "openai" && e.eventType === "request.end")).toBe(
      true
    );
  });

  it("should return empty array when no events match", () => {
    const result = filterTraces(events, { provider: "nonexistent" });
    expect(result).toHaveLength(0);
  });

  it("should return all terminal events when no filters provided", () => {
    const result = filterTraces(events, {});
    expect(result).toHaveLength(3);
  });
});

describe("sortByTimeDesc", () => {
  it("should sort events by time in descending order", () => {
    const events: MonitoringEvent[] = [
      createEvent({ requestId: "oldest", time: new Date("2026-01-01T10:00:00Z") }),
      createEvent({ requestId: "newest", time: new Date("2026-02-01T10:00:00Z") }),
      createEvent({ requestId: "middle", time: new Date("2026-01-15T10:00:00Z") })
    ];

    const result = sortByTimeDesc(events);

    expect(result[0]!.requestId).toBe("newest");
    expect(result[1]!.requestId).toBe("middle");
    expect(result[2]!.requestId).toBe("oldest");
  });

  it("should not mutate the original array", () => {
    const events: MonitoringEvent[] = [
      createEvent({ requestId: "first", time: new Date("2026-01-01T10:00:00Z") }),
      createEvent({ requestId: "second", time: new Date("2026-02-01T10:00:00Z") })
    ];

    const originalFirst = events[0];
    sortByTimeDesc(events);

    expect(events[0]).toBe(originalFirst);
  });
});

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("should return correct page of items", () => {
    expect(paginate(items, 3, 0)).toEqual([1, 2, 3]);
    expect(paginate(items, 3, 3)).toEqual([4, 5, 6]);
    expect(paginate(items, 3, 6)).toEqual([7, 8, 9]);
  });

  it("should handle last page with fewer items", () => {
    expect(paginate(items, 3, 9)).toEqual([10]);
  });

  it("should return empty array when offset exceeds length", () => {
    expect(paginate(items, 3, 15)).toEqual([]);
  });
});

describe("eventToTraceSummary", () => {
  it("should convert success event to trace summary", () => {
    const event = createEvent({
      requestId: "req-123",
      provider: "openai",
      model: "gpt-4",
      time: new Date("2026-02-01T10:00:00Z"),
      duration: 500,
      cost: 0.05,
      eventType: "request.end"
    });

    const summary = eventToTraceSummary(event);

    expect(summary.requestId).toBe("req-123");
    expect(summary.provider).toBe("openai");
    expect(summary.model).toBe("gpt-4");
    expect(summary.duration).toBe(500);
    expect(summary.cost).toBe(0.05);
    expect(summary.status).toBe("success");
    expect(summary.endTime).toEqual(event.time);
  });

  it("should convert error event to trace summary", () => {
    const event = createEvent({ eventType: "request.error" });
    const summary = eventToTraceSummary(event);
    expect(summary.status).toBe("error");
  });

  it("should calculate startTime from endTime and duration", () => {
    const endTime = new Date("2026-02-01T10:00:00Z");
    const event = createEvent({ time: endTime, duration: 1000 });
    const summary = eventToTraceSummary(event);

    expect(summary.startTime.getTime()).toBe(endTime.getTime() - 1000);
  });
});
