import { describe, it, expect, vi } from "vitest";
import { Monitor } from "../src/Monitor.js";
import type { MonitoringStore } from "../src/types.js";

describe("Monitor Middleware", () => {
  it("should capture events and send them to the store", async () => {
    const saveEvent = vi.fn().mockResolvedValue(undefined);
    const store: MonitoringStore = {
      saveEvent,
      getEvents: vi.fn()
    };

    const monitor = new Monitor({ store });
    const ctx = {
      requestId: "req-123",
      provider: "openai",
      model: "gpt-4",
      state: {}
    };

    await monitor.onRequest(ctx);
    
    expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "req-123",
      eventType: "request.start",
      provider: "openai"
    }));
  });

  it("should respect captureContent: false (default)", async () => {
    const saveEvent = vi.fn().mockResolvedValue(undefined);
    const store: MonitoringStore = { saveEvent, getEvents: vi.fn() };
    const monitor = new Monitor({ store });

    const ctx = { requestId: "r", provider: "p", model: "m", state: {} };
    const result = { 
      content: "Sensitive Info", 
      usage: { total_tokens: 10 },
      toString: () => "Sensitive Info" 
    };

    await monitor.onResponse(ctx, result);

    const call = saveEvent.mock.calls[0]![0];
    expect(call.payload.result).toBeUndefined();
    expect(call.payload.usage.total_tokens).toBe(10);
  });
});
