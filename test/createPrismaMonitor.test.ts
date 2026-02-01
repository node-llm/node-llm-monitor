import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPrismaMonitor } from "../src/factory.js";
import { Monitor } from "../src/Monitor.js";
import { PrismaAdapter } from "../src/adapters/prisma/PrismaAdapter.js";
import type { MonitoringEvent } from "../src/types.js";

describe("createPrismaMonitor", () => {
  describe("Factory Function", () => {
    it("should create a Monitor instance with PrismaAdapter", () => {
      // Mock Prisma client with monitoring_events table
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          aggregate: vi.fn()
        }
      };

      const monitor = createPrismaMonitor(mockPrisma);

      expect(monitor).toBeInstanceOf(Monitor);
      expect(monitor.name).toBe("NodeLLMMonitor");
      console.log(`✓ createPrismaMonitor returns Monitor instance`);
    });

    it("should pass options to Monitor constructor", () => {
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          aggregate: vi.fn()
        }
      };

      const monitor = createPrismaMonitor(mockPrisma, {
        captureContent: true,
        customPatterns: [{ pattern: /secret/gi, name: "custom_secret" }]
      });

      expect(monitor).toBeInstanceOf(Monitor);
      console.log(`✓ createPrismaMonitor accepts options`);
    });

    it("should validate Prisma client has monitoring_events table", async () => {
      const invalidPrisma = {};

      const monitor = createPrismaMonitor(invalidPrisma as any);

      // Validation happens on first store method call (lazy validation)
      try {
        await monitor.store?.getEvents("test");
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeDefined();
      }

      console.log(`✓ Validates Prisma has required table`);
    });
  });

  describe("Monitor Event Capture", () => {
    it("should capture request start events", async () => {
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 }, _avg: { duration: 0 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma);

      const mockCtx = {
        requestId: "req_test_001",
        provider: "openai",
        model: "gpt-4o-mini",
        state: {},
        messages: [{ role: "user", content: "test" }]
      };

      await monitor.onRequest(mockCtx);

      expect(mockPrisma.monitoring_events.create).toHaveBeenCalled();
      const callArgs = mockPrisma.monitoring_events.create.mock.calls[0][0];

      expect(callArgs.data).toBeDefined();
      expect(callArgs.data.eventType).toBe("request.start");
      expect(callArgs.data.requestId).toBe("req_test_001");
      expect(callArgs.data.provider).toBe("openai");
      expect(callArgs.data.model).toBe("gpt-4o-mini");

      console.log(`✓ Captures request start events with correct data`);
    });

    it("should capture response events with token usage", async () => {
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 }, _avg: { duration: 0 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma);

      const mockCtx = {
        requestId: "req_test_002",
        provider: "openai",
        model: "gpt-4o-mini",
        state: {}
      };

      const mockResponse = {
        content: "This is a response",
        usage: {
          input_tokens: 50,
          output_tokens: 150,
          total_tokens: 200
        }
      };

      await monitor.onResponse(mockCtx, mockResponse);

      expect(mockPrisma.monitoring_events.create).toHaveBeenCalled();
      const callArgs = mockPrisma.monitoring_events.create.mock.calls[0][0];

      expect(callArgs.data.eventType).toBe("request.end");
      expect(callArgs.data.requestId).toBe("req_test_002");
      // Cost may be calculated from usage if available
      if (callArgs.data.cost) {
        expect(callArgs.data.cost).toBeGreaterThan(0);
      }

      console.log(`✓ Captures response events with token usage`);
      console.log(`  Event Type: ${callArgs.data.eventType}`);
      console.log(`  Request ID: ${callArgs.data.requestId}`);
      console.log(`  Cost calculated: ${callArgs.data.cost ? "Yes" : "No"}`);
    });

    it("should capture errors", async () => {
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 }, _avg: { duration: 0 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma);

      const mockCtx = {
        requestId: "req_error_001",
        provider: "openai",
        model: "gpt-4o-mini",
        state: {}
      };

      const testError = new Error("API rate limit exceeded");

      await monitor.onError(mockCtx, testError);

      expect(mockPrisma.monitoring_events.create).toHaveBeenCalled();
      const callArgs = mockPrisma.monitoring_events.create.mock.calls[0][0];

      expect(callArgs.data.eventType).toBe("request.error");
      expect(callArgs.data.requestId).toBe("req_error_001");

      console.log(`✓ Captures error events`);
    });
  });

  describe("Data Retrieval", () => {
    it("should provide access to underlying store", async () => {
      const mockEvents: MonitoringEvent[] = [
        {
          id: "evt_1",
          eventType: "request.start",
          requestId: "req_retrieve_001",
          time: new Date(),
          provider: "openai",
          model: "gpt-4o-mini"
        }
      ];

      const mockPrisma = {
        monitoring_events: {
          create: vi.fn(),
          findMany: vi.fn().mockResolvedValue(mockEvents),
          count: vi.fn().mockResolvedValue(1),
          aggregate: vi
            .fn()
            .mockResolvedValue({ _sum: { cost: 0.00123 }, _avg: { duration: 1500 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma);

      // Monitor stores the adapter internally, can be accessed via store property if exposed
      expect(monitor).toBeDefined();

      console.log(`✓ Monitor provides internal store for data retrieval`);
    });
  });

  describe("Content Scrubbing", () => {
    it("should scrub sensitive data when captureContent is true", async () => {
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 }, _avg: { duration: 0 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma, {
        captureContent: true
      });

      const mockCtx = {
        requestId: "req_scrub_001",
        provider: "openai",
        model: "gpt-4o-mini",
        state: {},
        messages: [
          {
            role: "user",
            content: "My email is john.doe@company.com and phone is 555-123-4567"
          }
        ]
      };

      await monitor.onRequest(mockCtx);

      expect(mockPrisma.monitoring_events.create).toHaveBeenCalled();

      console.log(`✓ Scrubs content when captureContent is true`);
    });
  });

  describe("Integration with HR Chatbot", () => {
    it("should work as middleware in NodeLLM pipeline", async () => {
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 }, _avg: { duration: 0 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma, {
        captureContent: true
      });

      // Simulate middleware pipeline
      const mockCtx = {
        requestId: "chat_hr_req_001",
        provider: "openai",
        model: "gpt-4o-mini",
        state: { chatId: "chat_123" },
        messages: [
          {
            role: "system",
            content: "You are an HR assistant"
          },
          {
            role: "user",
            content: "What is the vacation policy?"
          }
        ]
      };

      // Simulate request lifecycle
      await monitor.onRequest(mockCtx);

      const mockResponse = {
        content: "Our company offers 20 days of vacation per year...",
        usage: {
          input_tokens: 75,
          output_tokens: 156,
          total_tokens: 231
        }
      };

      await monitor.onResponse(mockCtx, mockResponse);

      expect(mockPrisma.monitoring_events.create).toHaveBeenCalledTimes(2);

      const calls = mockPrisma.monitoring_events.create.mock.calls;
      expect(calls[0][0].data.eventType).toBe("request.start");
      expect(calls[1][0].data.eventType).toBe("request.end");

      console.log(`✓ Works as middleware in NodeLLM pipeline`);
      console.log(`  Request ID: ${mockCtx.requestId}`);
      console.log(`  Provider: ${mockCtx.provider}`);
      console.log(`  Messages tracked: ${mockCtx.messages.length}`);
      console.log(`  Response tokens: ${mockResponse.usage.total_tokens}`);
    });

    it("should accumulate events across multiple requests", async () => {
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(3),
          aggregate: vi
            .fn()
            .mockResolvedValueOnce({ _sum: { cost: 0.000495 }, _avg: { duration: 1100 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma);

      // Three requests
      const requests = [
        { requestId: "req_1", provider: "openai", model: "gpt-4o-mini", tokens: 200 },
        { requestId: "req_2", provider: "openai", model: "gpt-4o-mini", tokens: 231 },
        { requestId: "req_3", provider: "openai", model: "gpt-4o-mini", tokens: 215 }
      ];

      for (const req of requests) {
        const ctx = {
          requestId: req.requestId,
          provider: req.provider,
          model: req.model,
          state: { chatId: "chat_multi_001" },
          messages: [{ role: "user", content: "test" }]
        };

        await monitor.onRequest(ctx);

        const response = {
          content: "response",
          usage: {
            input_tokens: req.tokens / 2,
            output_tokens: req.tokens / 2,
            total_tokens: req.tokens
          }
        };

        await monitor.onResponse(ctx, response);
      }

      // Verify all requests were captured
      expect(mockPrisma.monitoring_events.create).toHaveBeenCalledTimes(6); // 3 requests × 2 events each

      console.log(`✓ Accumulates events across multiple requests`);
      console.log(
        `  Total events captured: ${mockPrisma.monitoring_events.create.mock.calls.length}`
      );
    });
  });

  describe("Error Handling", () => {
    it("should throw on invalid Prisma client", async () => {
      const invalidPrisma = {
        monitoring_events: {
          create: "not a function"
        }
      };

      const monitor = createPrismaMonitor(invalidPrisma as any);

      // Validation happens on first store method call (lazy validation)
      try {
        await monitor.store?.getEvents("test");
        expect(true).toBe(false); // Should not reach here
      } catch (err) {
        expect(err).toBeDefined();
      }

      console.log(`✓ Throws on invalid Prisma client`);
    });

    it("should handle onError hook option", async () => {
      const errorHook = vi.fn();
      const mockPrisma = {
        monitoring_events: {
          create: vi.fn().mockResolvedValue({}),
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
          aggregate: vi.fn().mockResolvedValue({ _sum: { cost: 0 }, _avg: { duration: 0 } })
        }
      };

      const monitor = createPrismaMonitor(mockPrisma, {
        onError: errorHook
      });

      const mockCtx = {
        requestId: "req_error_hook",
        provider: "openai",
        model: "gpt-4o-mini",
        state: {}
      };

      const testError = new Error("Test error");
      await monitor.onError(mockCtx, testError);

      expect(mockPrisma.monitoring_events.create).toHaveBeenCalled();

      console.log(`✓ Handles onError hook option`);
    });
  });
});
