import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrismaAdapter } from "../src/adapters/prisma/PrismaAdapter.js";
import type { MonitoringEvent } from "../src/types.js";

describe("PrismaAdapter", () => {
  let mockPrisma: any;
  let adapter: PrismaAdapter;

  const createEvent = (overrides: Partial<MonitoringEvent> = {}): MonitoringEvent => ({
    id: "evt-123",
    eventType: "request.end",
    requestId: "req-123",
    time: new Date(),
    duration: 100,
    cost: 0.01,
    cpuTime: 50,
    allocations: 1024,
    payload: {},
    createdAt: new Date(),
    provider: "openai",
    model: "gpt-4",
    ...overrides
  });

  beforeEach(() => {
    mockPrisma = {
      monitoring_events: {
        create: vi.fn().mockResolvedValue({}),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        aggregate: vi.fn().mockResolvedValue({ _sum: {}, _avg: {} }),
        groupBy: vi.fn().mockResolvedValue([])
      }
    };

    adapter = new PrismaAdapter(mockPrisma);
  });

  describe("constructor", () => {
    it("should validate Prisma client on first use", async () => {
      const adapter = new PrismaAdapter({});

      // Validation happens on first method call (lazy validation)
      try {
        await adapter.getEvents("test");
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect((err as Error).message).toContain("Prisma model 'monitoring_events' not found");
      }
    });

    it("should accept custom table name", () => {
      const customPrisma = {
        custom_events: {
          create: vi.fn()
        }
      };

      expect(() => new PrismaAdapter(customPrisma, "custom_events")).not.toThrow();
    });
  });

  describe("saveEvent", () => {
    it("should save event to database", async () => {
      const event = createEvent();

      await adapter.saveEvent(event);

      expect(mockPrisma.monitoring_events.create).toHaveBeenCalledWith({
        data: {
          id: event.id,
          eventType: event.eventType,
          requestId: event.requestId,
          sessionId: event.sessionId,
          transactionId: event.transactionId,
          time: event.time,
          duration: event.duration,
          cost: event.cost,
          cpuTime: event.cpuTime,
          gcTime: event.gcTime,
          allocations: event.allocations,
          payload: event.payload,
          createdAt: event.createdAt,
          provider: event.provider,
          model: event.model
        }
      });
    });
  });

  describe("getEvents", () => {
    it("should fetch events by requestId", async () => {
      const events = [createEvent(), createEvent()];
      mockPrisma.monitoring_events.findMany.mockResolvedValue(events);

      const result = await adapter.getEvents("req-123");

      expect(mockPrisma.monitoring_events.findMany).toHaveBeenCalledWith({
        where: { requestId: "req-123" },
        orderBy: { time: "asc" }
      });
      expect(result).toEqual(events);
    });
  });

  describe("getStats", () => {
    it("should return aggregated statistics", async () => {
      mockPrisma.monitoring_events.count
        .mockResolvedValueOnce(100) // totalRequests
        .mockResolvedValueOnce(10); // errorCount

      mockPrisma.monitoring_events.aggregate
        .mockResolvedValueOnce({ _sum: { cost: 5.5 } }) // totalCost
        .mockResolvedValueOnce({ _avg: { duration: 250 } }); // avgDuration

      const result = await adapter.getStats();

      expect(result).toEqual({
        totalRequests: 100,
        totalCost: 5.5,
        avgDuration: 250,
        errorRate: 10
      });
    });

    it("should handle time range filters", async () => {
      const from = new Date("2024-01-01");
      const to = new Date("2024-01-31");

      mockPrisma.monitoring_events.count.mockResolvedValue(0);
      mockPrisma.monitoring_events.aggregate.mockResolvedValue({
        _sum: {},
        _avg: {}
      });

      await adapter.getStats({ from, to });

      expect(mockPrisma.monitoring_events.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            time: { gte: from, lte: to }
          })
        })
      );
    });

    it("should handle missing data gracefully", async () => {
      mockPrisma.monitoring_events.count.mockResolvedValue(0);
      mockPrisma.monitoring_events.aggregate.mockResolvedValue({
        _sum: { cost: null },
        _avg: { duration: null }
      });

      const result = await adapter.getStats();

      expect(result.totalCost).toBe(0);
      expect(result.avgDuration).toBe(0);
      expect(result.errorRate).toBe(0);
    });
  });

  describe("getMetrics", () => {
    it("should return full metrics data with time series", async () => {
      const baseTime = new Date("2024-01-01T10:00:00Z");
      const events = [
        createEvent({
          time: baseTime,
          provider: "openai",
          model: "gpt-4",
          cost: 0.01,
          duration: 100
        }),
        createEvent({
          time: new Date(baseTime.getTime() + 6 * 60 * 1000),
          provider: "anthropic",
          model: "claude-3",
          cost: 0.02,
          duration: 200
        })
      ];

      mockPrisma.monitoring_events.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
      mockPrisma.monitoring_events.aggregate
        .mockResolvedValueOnce({ _sum: { cost: 0.03 } })
        .mockResolvedValueOnce({ _avg: { duration: 150 } });
      mockPrisma.monitoring_events.findMany.mockResolvedValue(events);

      const result = await adapter.getMetrics();

      expect(result.totals).toEqual({
        totalRequests: 2,
        totalCost: 0.03,
        avgDuration: 150,
        errorRate: 0
      });

      expect(result.byProvider).toHaveLength(2);
      expect(result.byProvider[0]!.provider).toBe("openai");
      expect(result.byProvider[1]!.provider).toBe("anthropic");

      expect(result.timeSeries.requests).toHaveLength(2);
      expect(result.timeSeries.cost).toHaveLength(2);
      expect(result.timeSeries.duration).toHaveLength(2);
      expect(result.timeSeries.errors).toHaveLength(2);
    });

    it("should apply time range filters", async () => {
      const from = new Date("2024-01-01");

      mockPrisma.monitoring_events.count.mockResolvedValue(0);
      mockPrisma.monitoring_events.aggregate.mockResolvedValue({
        _sum: {},
        _avg: {}
      });
      mockPrisma.monitoring_events.findMany.mockResolvedValue([]);

      await adapter.getMetrics({ from });

      expect(mockPrisma.monitoring_events.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            time: { gte: from }
          })
        })
      );
    });

    it("should handle empty event list", async () => {
      mockPrisma.monitoring_events.count.mockResolvedValue(0);
      mockPrisma.monitoring_events.aggregate.mockResolvedValue({
        _sum: {},
        _avg: {}
      });
      mockPrisma.monitoring_events.findMany.mockResolvedValue([]);

      const result = await adapter.getMetrics();

      expect(result.byProvider).toEqual([]);
      expect(result.timeSeries.requests).toEqual([]);
    });
  });

  describe("listTraces", () => {
    it("should return paginated traces", async () => {
      const events = [
        createEvent({ eventType: "request.end", duration: 100 }),
        createEvent({ eventType: "request.error", duration: 200 })
      ];

      mockPrisma.monitoring_events.findMany.mockResolvedValue(events);
      mockPrisma.monitoring_events.count.mockResolvedValue(2);

      const result = await adapter.listTraces({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
      expect(result.items[0]!.status).toBe("success");
      expect(result.items[1]!.status).toBe("error");
    });

    it("should use default pagination values", async () => {
      mockPrisma.monitoring_events.findMany.mockResolvedValue([]);
      mockPrisma.monitoring_events.count.mockResolvedValue(0);

      const result = await adapter.listTraces();

      expect(mockPrisma.monitoring_events.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0
        })
      );
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it("should construct correct where clause for filters", async () => {
      mockPrisma.monitoring_events.findMany.mockResolvedValue([]);
      mockPrisma.monitoring_events.count.mockResolvedValue(0);

      const filters = {
        requestId: "req-1",
        model: "gpt-4",
        provider: "openai",
        status: "error" as const,
        minCost: 0.5,
        minLatency: 1000,
        from: new Date("2024-01-01"),
        to: new Date("2024-01-02")
      };

      await adapter.listTraces(filters);

      expect(mockPrisma.monitoring_events.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            requestId: "req-1",
            model: "gpt-4",
            provider: "openai",
            eventType: "request.error",
            cost: { gte: 0.5 },
            duration: { gte: 1000 },
            time: { gte: filters.from, lte: filters.to }
          })
        })
      );
    });
  });
});
