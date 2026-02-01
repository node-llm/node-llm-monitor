import { describe, it, expect } from "vitest";
import { TimeSeriesBuilder } from "../src/aggregation/TimeSeriesBuilder.js";
import type { MonitoringEvent } from "../src/types.js";

describe("TimeSeriesBuilder", () => {
  const createEvent = (
    overrides: Partial<MonitoringEvent> = {}
  ): MonitoringEvent => ({
    id: "evt-" + Math.random(),
    eventType: "request.end",
    requestId: "req-123",
    time: new Date(),
    createdAt: new Date(),
    provider: "openai",
    model: "gpt-4",
    payload: {},
    ...overrides,
  });

  describe("build", () => {
    it("should create empty time series for no events", () => {
      const builder = new TimeSeriesBuilder();
      const result = builder.build([]);

      expect(result.requests).toEqual([]);
      expect(result.cost).toEqual([]);
      expect(result.duration).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it("should aggregate events into 5-minute buckets", () => {
      const builder = new TimeSeriesBuilder(5 * 60 * 1000);
      const baseTime = new Date("2024-01-01T10:00:00Z");

      const events = [
        createEvent({
          time: new Date(baseTime.getTime()),
          duration: 100,
          cost: 0.01,
        }),
        createEvent({
          time: new Date(baseTime.getTime() + 2 * 60 * 1000), // +2 min
          duration: 200,
          cost: 0.02,
        }),
        createEvent({
          time: new Date(baseTime.getTime() + 6 * 60 * 1000), // +6 min (new bucket)
          duration: 300,
          cost: 0.03,
        }),
      ];

      const result = builder.build(events);

      expect(result.requests).toHaveLength(2);
      expect(result.requests[0]!.value).toBe(2); // First bucket has 2 requests
      expect(result.requests[1]!.value).toBe(1); // Second bucket has 1 request
    });

    it("should calculate average duration per bucket", () => {
      const builder = new TimeSeriesBuilder(5 * 60 * 1000);
      const baseTime = new Date("2024-01-01T10:00:00Z");

      const events = [
        createEvent({ time: baseTime, duration: 100 }),
        createEvent({ time: baseTime, duration: 200 }),
      ];

      const result = builder.build(events);

      expect(result.duration[0]!.value).toBe(150); // (100 + 200) / 2
    });

    it("should count errors separately", () => {
      const builder = new TimeSeriesBuilder(5 * 60 * 1000);
      const baseTime = new Date("2024-01-01T10:00:00Z");

      const events = [
        createEvent({ time: baseTime, eventType: "request.end" }),
        createEvent({ time: baseTime, eventType: "request.error" }),
        createEvent({ time: baseTime, eventType: "request.error" }),
      ];

      const result = builder.build(events);

      expect(result.requests[0]!.value).toBe(3);
      expect(result.errors[0]!.value).toBe(2);
    });

    it("should sum costs per bucket", () => {
      const builder = new TimeSeriesBuilder(5 * 60 * 1000);
      const baseTime = new Date("2024-01-01T10:00:00Z");

      const events = [
        createEvent({ time: baseTime, cost: 0.01 }),
        createEvent({ time: baseTime, cost: 0.02 }),
        createEvent({ time: baseTime, cost: 0.03 }),
      ];

      const result = builder.build(events);

      expect(result.cost[0]!.value).toBe(0.06);
    });

    it("should handle events with missing cost/duration", () => {
      const builder = new TimeSeriesBuilder(5 * 60 * 1000);
      const baseTime = new Date("2024-01-01T10:00:00Z");

      const events = [
        createEvent({ time: baseTime, cost: undefined, duration: undefined }),
      ];

      const result = builder.build(events);

      expect(result.cost[0]!.value).toBe(0);
      expect(result.duration[0]!.value).toBe(0);
    });

    it("should ignore non-terminal events", () => {
      const builder = new TimeSeriesBuilder(5 * 60 * 1000);
      const baseTime = new Date("2024-01-01T10:00:00Z");

      const events = [
        createEvent({ time: baseTime, eventType: "request.start" }),
        createEvent({ time: baseTime, eventType: "tool.start" }),
        createEvent({ time: baseTime, eventType: "request.end" }),
      ];

      const result = builder.build(events);

      expect(result.requests[0]!.value).toBe(1); // Only request.end counted
    });
  });

  describe("buildProviderStats", () => {
    it("should aggregate by provider and model", () => {
      const builder = new TimeSeriesBuilder();

      const events = [
        createEvent({ provider: "openai", model: "gpt-4", cost: 0.01, duration: 100 }),
        createEvent({ provider: "openai", model: "gpt-4", cost: 0.02, duration: 200 }),
        createEvent({ provider: "anthropic", model: "claude-3", cost: 0.03, duration: 150 }),
      ];

      const result = builder.buildProviderStats(events);

      expect(result).toHaveLength(2);

      const openai = result.find((s) => s.provider === "openai");
      expect(openai).toBeDefined();
      expect(openai!.requests).toBe(2);
      expect(openai!.cost).toBe(0.03);
      expect(openai!.avgDuration).toBe(150); // (100 + 200) / 2

      const anthropic = result.find((s) => s.provider === "anthropic");
      expect(anthropic).toBeDefined();
      expect(anthropic!.requests).toBe(1);
      expect(anthropic!.cost).toBe(0.03);
    });

    it("should count errors per provider", () => {
      const builder = new TimeSeriesBuilder();

      const events = [
        createEvent({ provider: "openai", model: "gpt-4", eventType: "request.end" }),
        createEvent({ provider: "openai", model: "gpt-4", eventType: "request.error" }),
        createEvent({ provider: "openai", model: "gpt-4", eventType: "request.error" }),
      ];

      const result = builder.buildProviderStats(events);

      expect(result[0]!.errorCount).toBe(2);
      expect(result[0]!.requests).toBe(3);
    });

    it("should return empty array for no events", () => {
      const builder = new TimeSeriesBuilder();
      const result = builder.buildProviderStats([]);

      expect(result).toEqual([]);
    });

    it("should not expose internal _totalDuration field", () => {
      const builder = new TimeSeriesBuilder();

      const events = [
        createEvent({ provider: "openai", model: "gpt-4", duration: 100 }),
      ];

      const result = builder.buildProviderStats(events);

      expect(result[0]).not.toHaveProperty("_totalDuration");
    });
  });
});
