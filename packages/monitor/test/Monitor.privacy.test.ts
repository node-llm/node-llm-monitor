import { describe, it, expect } from "vitest";
import { Monitor } from "../src/Monitor.js";

const ctx = () => ({ requestId: "r1", provider: "openai", model: "gpt-4.1", state: {} });
const toolCall = {
  id: "c1",
  type: "function",
  function: { name: "lookup_patient", arguments: '{"email":"jane@example.com"}' }
};

async function eventsFor(monitor: Monitor) {
  return monitor.getStore().getEvents!("r1");
}

describe("Monitor privacy", () => {
  it("does not store tool arguments when content capture is off", async () => {
    const monitor = Monitor.memory();
    await monitor.onToolCallStart(ctx(), toolCall);

    const [event] = await eventsFor(monitor);
    expect(event!.payload.toolCall).toEqual({
      id: "c1",
      type: "function",
      function: { name: "lookup_patient", arguments: undefined }
    });
    expect(JSON.stringify(event)).not.toContain("jane@example.com");
  });

  it("scrubs tool arguments and results when content capture is on", async () => {
    const monitor = Monitor.memory({ captureContent: true });
    await monitor.onToolCallStart(ctx(), toolCall);
    await monitor.onToolCallEnd(ctx(), toolCall, "Found jane@example.com");

    const events = await eventsFor(monitor);
    const text = JSON.stringify(events);
    expect(text).not.toContain("jane@example.com");
    expect(events[0]!.payload.toolCall.function.name).toBe("lookup_patient");
    expect(events[1]!.payload.result).toBeDefined();
  });

  it("keeps error stacks only when content capture is on", async () => {
    const off = Monitor.memory();
    await off.onError(ctx(), new Error("boom"));
    expect((await eventsFor(off))[0]!.payload.stack).toBeUndefined();
    expect((await eventsFor(off))[0]!.payload.error).toBe("boom");

    const on = Monitor.memory({ captureContent: true });
    await on.onError(ctx(), new Error("boom"));
    expect((await eventsFor(on))[0]!.payload.stack).toContain("Error: boom");
  });
});

describe("Monitor served model", () => {
  it("records the model and provider that answered after a fallback", async () => {
    const monitor = Monitor.memory();
    const c = ctx();
    await monitor.onRequest(c);
    await monitor.onResponse(c, {
      toString: () => "hi",
      model: "claude-haiku-4-5",
      provider: "anthropic",
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
    });

    const end = (await eventsFor(monitor)).find((e) => e.eventType === "request.end")!;
    expect(end.model).toBe("claude-haiku-4-5");
    expect(end.provider).toBe("anthropic");
    expect(c.model).toBe("gpt-4.1"); // shared context left unchanged
  });
});
