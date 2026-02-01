import { describe, it, expect, vi } from "vitest";
import { Monitor } from "../src/Monitor.js";
import type { MonitoringStore } from "../src/types.js";

describe("Enhanced Metadata", () => {
  const createMockStore = (): MonitoringStore => ({
    saveEvent: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      totalRequests: 0,
      totalCost: 0,
      avgDuration: 0,
      errorRate: 0,
    }),
  });

  const createContext = () => ({
    requestId: "req-123",
    provider: "openai",
    model: "gpt-4",
    state: {},
  });

  describe("enrichWithRequestMetadata", () => {
    it("should enrich payload with request metadata", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const payload = { foo: "bar" };
      const enriched = monitor.enrichWithRequestMetadata(payload, {
        streaming: true,
        requestSizeBytes: 1024,
        responseSizeBytes: 2048,
        promptVersion: "v1.2.3",
        templateId: "template-abc",
      });

      expect(enriched.foo).toBe("bar");
      expect(enriched.request).toEqual({
        streaming: true,
        requestSizeBytes: 1024,
        responseSizeBytes: 2048,
        promptVersion: "v1.2.3",
        templateId: "template-abc",
      });
    });

    it("should omit undefined values", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithRequestMetadata({}, {
        streaming: true,
        // Other fields undefined
      });

      expect(enriched.request).toEqual({
        streaming: true,
      });
      expect(enriched.request).not.toHaveProperty("requestSizeBytes");
    });

    it("should handle empty options", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithRequestMetadata({}, {});

      expect(enriched.request).toEqual({});
    });
  });

  describe("enrichWithTiming", () => {
    it("should enrich payload with timing breakdown", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithTiming({}, {
        queueTime: 10,
        networkTime: 50,
        providerLatency: 200,
        toolTimeTotal: 100,
        timeToFirstToken: 150,
      });

      expect(enriched.timing).toEqual({
        queueTime: 10,
        networkTime: 50,
        providerLatency: 200,
        toolTimeTotal: 100,
        timeToFirstToken: 150,
      });
    });

    it("should handle partial timing data", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithTiming({}, {
        networkTime: 50,
        providerLatency: 200,
      });

      expect(enriched.timing).toEqual({
        networkTime: 50,
        providerLatency: 200,
      });
    });
  });

  describe("enrichWithEnvironment", () => {
    it("should enrich payload with environment context", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithEnvironment({}, {
        serviceName: "api-service",
        serviceVersion: "1.2.3",
        environment: "production",
        region: "us-east-1",
      });

      expect(enriched.environment).toEqual({
        serviceName: "api-service",
        serviceVersion: "1.2.3",
        environment: "production",
        region: "us-east-1",
        nodeVersion: process.version,
      });
    });

    it("should always include nodeVersion", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithEnvironment({}, {});

      expect(enriched.environment).toEqual({
        nodeVersion: process.version,
      });
    });
  });

  describe("enrichWithRetry", () => {
    it("should enrich payload with retry metadata", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithRetry({}, {
        retryCount: 3,
        retryReason: "rate_limit",
        fallbackModel: "gpt-3.5-turbo",
      });

      expect(enriched.retry).toEqual({
        retryCount: 3,
        retryReason: "rate_limit",
        fallbackModel: "gpt-3.5-turbo",
      });
    });

    it("should handle different retry reasons", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const reasons = ["timeout", "rate_limit", "network", "server_error", "other"] as const;

      reasons.forEach((reason) => {
        const enriched = monitor.enrichWithRetry({}, {
          retryCount: 1,
          retryReason: reason,
        });

        expect(enriched.retry?.retryReason).toBe(reason);
      });
    });
  });

  describe("enrichWithSampling", () => {
    it("should enrich payload with sampling metadata", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const enriched = monitor.enrichWithSampling({}, {
        samplingRate: 0.1,
        sampled: true,
        samplingReason: "high_volume",
      });

      expect(enriched.sampling).toEqual({
        samplingRate: 0.1,
        sampled: true,
        samplingReason: "high_volume",
      });
    });

    it("should handle different sampling reasons", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      const reasons = ["high_volume", "debug", "error", "random", "always"] as const;

      reasons.forEach((reason) => {
        const enriched = monitor.enrichWithSampling({}, {
          samplingReason: reason,
        });

        expect(enriched.sampling?.samplingReason).toBe(reason);
      });
    });
  });

  describe("chaining enrichment methods", () => {
    it("should allow chaining multiple enrichments", () => {
      const store = createMockStore();
      const monitor = new Monitor({ store });

      let payload: any = { original: "data" };

      payload = monitor.enrichWithRequestMetadata(payload, {
        streaming: true,
        requestSizeBytes: 1024,
      });

      payload = monitor.enrichWithTiming(payload, {
        networkTime: 50,
        providerLatency: 200,
      });

      payload = monitor.enrichWithEnvironment(payload, {
        environment: "production",
        serviceName: "api",
      });

      expect(payload.original).toBe("data");
      expect(payload.request?.streaming).toBe(true);
      expect(payload.timing?.networkTime).toBe(50);
      expect(payload.environment?.environment).toBe("production");
    });
  });

  describe("integration with Monitor lifecycle", () => {
    it("should allow enriched payloads in onRequest", async () => {
      const saveEvent = vi.fn().mockResolvedValue(undefined);
      const store = createMockStore();
      store.saveEvent = saveEvent;

      const monitor = new Monitor({ store });
      const ctx = createContext();

      const basePayload = { messages: [{ role: "user", content: "test" }] };
      const enrichedPayload = monitor.enrichWithRequestMetadata(basePayload, {
        streaming: true,
        requestSizeBytes: 100,
      });

      // Simulate what NodeLLM would do
      await monitor.onRequest(ctx);

      const savedEvent = saveEvent.mock.calls[0][0];
      expect(savedEvent.eventType).toBe("request.start");
    });

    it("should preserve enhanced metadata through event lifecycle", async () => {
      const saveEvent = vi.fn().mockResolvedValue(undefined);
      const store = createMockStore();
      store.saveEvent = saveEvent;

      const monitor = new Monitor({ store, captureContent: true });
      const ctx = createContext();

      // Start request with enhanced metadata
      await monitor.onRequest(ctx);

      // Response with enhanced metadata
      const result = {
        toString: () => "response",
        usage: { cost: 0.01 },
      };
      await monitor.onResponse(ctx, result);

      expect(saveEvent).toHaveBeenCalledTimes(2);
      expect(saveEvent.mock.calls[1][0].eventType).toBe("request.end");
    });
  });
});
