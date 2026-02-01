import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { api } from "../dashboard/src/api/client";

describe("API Client", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    api.cleanup();
  });

  describe("request deduplication", () => {
    it("should use unique keys for different endpoints", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      await Promise.all([api.getStats(), api.getMetrics(), api.getTraces()]);

      // Each endpoint should be called once
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should use different keys for different requestIds in getEvents", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      await Promise.all([api.getEvents("req-1"), api.getEvents("req-2")]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("cleanup", () => {
    it("should provide cleanup method", () => {
      expect(typeof api.cleanup).toBe("function");
      expect(() => api.cleanup()).not.toThrow();
    });
  });

  describe("error handling", () => {
    it("should throw ApiError on HTTP error", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found"
      });

      await expect(api.getStats()).rejects.toThrow("HTTP 404: Not Found");
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      await expect(api.getStats()).rejects.toThrow("Network error");
    });
  });

  describe("query parameters", () => {
    it("should include time range in query params", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ totalRequests: 0 })
      });

      const from = new Date("2024-01-01T00:00:00.000Z");
      await api.getStats({ from });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("from=2024-01-01T00%3A00%3A00.000Z");
    });

    it("should include pagination params for traces", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [], total: 0, limit: 10, offset: 20 })
      });

      await api.getTraces({ limit: 10, offset: 20 });

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("limit=10");
      expect(callUrl).toContain("offset=20");
    });

    it("should encode requestId in getEvents", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([])
      });

      await api.getEvents("req/123");

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("requestId=req%2F123");
    });
  });

  describe("AbortController integration", () => {
    it("should pass AbortSignal to fetch", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      await api.getStats();

      const fetchOptions = (global.fetch as any).mock.calls[0][1];
      expect(fetchOptions).toHaveProperty("signal");
      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
    });
  });
});
