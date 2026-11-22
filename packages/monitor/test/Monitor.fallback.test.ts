import { describe, it, expect } from "vitest";
import { Monitor } from "../src/Monitor.js";

const ctx = () => ({ requestId: "r1", provider: "openai", model: "gpt-4.1", state: {} });

async function eventsFor(monitor: Monitor) {
  return monitor.getStore().getEvents!("r1");
}

describe("Monitor fallbacks and tool search", () => {
  it("records a request.fallback event", async () => {
    const monitor = Monitor.memory();
    const error = Object.assign(new Error("rate limited"), { name: "RateLimitError" });

    await monitor.onFallback(ctx(), {
      error,
      from: { model: "gpt-4.1", provider: "openai" },
      to: { model: "claude-haiku-4-5", provider: "anthropic" },
      attempt: 1
    });

    const [event] = await eventsFor(monitor);
    expect(event!.eventType).toBe("request.fallback");
    expect(event!.payload).toEqual({
      attempt: 1,
      from: { model: "gpt-4.1", provider: "openai" },
      to: { model: "claude-haiku-4-5", provider: "anthropic" },
      errorType: "RateLimitError",
      error: "rate limited"
    });
  });

  it("records which tools a tool_search loaded, even with content capture off", async () => {
    const monitor = Monitor.memory();
    const call = { id: "c1", type: "function", function: { name: "tool_search", arguments: "{}" } };

    await monitor.onToolCallEnd(
      ctx(),
      call,
      JSON.stringify({
        loaded: ["issue_refund"],
        tools: [{ name: "issue_refund", description: "x" }]
      })
    );

    const [event] = await eventsFor(monitor);
    expect(event!.payload.loadedTools).toEqual(["issue_refund"]);
    expect(event!.payload.result).toBeUndefined();
  });

  it("adds no loadedTools for other tools", async () => {
    const monitor = Monitor.memory();
    const call = { id: "c1", type: "function", function: { name: "lookup", arguments: "{}" } };
    await monitor.onToolCallEnd(ctx(), call, '{"loaded":["x"]}');

    const [event] = await eventsFor(monitor);
    expect(event!.payload.loadedTools).toBeUndefined();
  });
});
