import { describe, it, expect, vi, beforeEach } from "vitest";
import { NodeLLMSpanProcessor } from "../src/NodeLLMSpanProcessor.js";
import { MonitoringStore, MonitoringEvent } from "@node-llm/monitor";

describe("NodeLLMSpanProcessor", () => {
  let mockStore: MonitoringStore;
  let processor: NodeLLMSpanProcessor;

  beforeEach(() => {
    mockStore = {
      saveEvent: vi.fn().mockResolvedValue(undefined)
    } as any;
    processor = new NodeLLMSpanProcessor(mockStore);
  });

  const createMockSpan = (name: string, overrides = {}) => {
    return {
      name,
      spanContext: () => ({ traceId: "trace-1", spanId: "span-2" }),
      parentSpanId: "parent-0",
      startTime: [1000, 0],
      endTime: [1001, 0],
      status: { code: 1 },
      attributes: {
        "ai.model.id": "gpt-4o",
        "ai.model.provider": "openai",
        "ai.usage.promptTokens": 100,
        "ai.usage.completionTokens": 50,
        ...overrides
      },
      ...overrides
    } as any;
  };

  it("should process top-level AI spans", async () => {
    const span = createMockSpan("ai.generateText");

    processor.onEnd(span);
    await processor.forceFlush();

    expect(mockStore.saveEvent).toHaveBeenCalled();
    const event = (mockStore.saveEvent as any).mock.calls[0][0] as MonitoringEvent;

    expect(event.provider).toBe("openai");
    expect(event.model).toBe("gpt-4o");
    expect(event.eventType).toBe("request.end");
    expect(event.payload.usage.promptTokens).toBe(100);
    expect(event.payload.usage.completionTokens).toBe(50);
  });

  it("should process standard (Non-Vercel) GenAI spans", async () => {
    const span = createMockSpan("gen_ai.chat", {
      attributes: {
        "ai.model.id": undefined, // No Vercel attributes
        "ai.model.provider": undefined,
        "gen_ai.system": "anthropic",
        "gen_ai.request.model": "claude-3-5-sonnet",
        "gen_ai.usage.input_tokens": 150,
        "gen_ai.usage.output_tokens": 75
      }
    });

    processor.onEnd(span);
    await processor.forceFlush();

    expect(mockStore.saveEvent).toHaveBeenCalled();
    const event = (mockStore.saveEvent as any).mock.calls[0][0];

    expect(event.provider).toBe("anthropic");
    expect(event.model).toBe("claude-3-5-sonnet");
    expect(event.payload.usage.promptTokens).toBe(150);
    expect(event.payload.usage.totalTokens).toBe(225);
  });

  it("should ignore non-AI spans", async () => {
    const span = createMockSpan("http.get");

    processor.onEnd(span);
    await processor.forceFlush();

    expect(mockStore.saveEvent).not.toHaveBeenCalled();
  });

  it("should ignore internal (.doGenerate) AI spans", async () => {
    const span = createMockSpan("ai.generateText.doGenerate");

    processor.onEnd(span);
    await processor.forceFlush();

    expect(mockStore.saveEvent).not.toHaveBeenCalled();
  });

  it("should apply custom filter if provided", async () => {
    const filter = (span: any) => span.attributes.isAllowed === true;
    processor = new NodeLLMSpanProcessor(mockStore, { filter });

    const span1 = createMockSpan("ai.generateText", { attributes: { isAllowed: false } });
    const span2 = createMockSpan("ai.generateText", { attributes: { isAllowed: true } });

    processor.onEnd(span1);
    processor.onEnd(span2);
    await processor.forceFlush();

    expect(mockStore.saveEvent).toHaveBeenCalledTimes(1);
  });

  it("should apply custom transform if provided", async () => {
    const transform = (event: MonitoringEvent) => {
      event.payload.customField = "modified";
      return event;
    };
    processor = new NodeLLMSpanProcessor(mockStore, { transform });

    const span = createMockSpan("ai.generateText");
    processor.onEnd(span);
    await processor.forceFlush();

    const event = (mockStore.saveEvent as any).mock.calls[0][0];
    expect(event.payload.customField).toBe("modified");
  });

  it("should capture content only when enabled", async () => {
    // Enabled by default
    const span = createMockSpan("ai.generateText", {
      attributes: { "ai.prompt": "secret message" }
    });

    processor.onEnd(span);
    await processor.forceFlush();
    expect((mockStore.saveEvent as any).mock.calls[0][0].payload.prompt).toBe("secret message");

    // Disabled
    vi.clearAllMocks();
    processor = new NodeLLMSpanProcessor(mockStore, { captureContent: false });
    processor.onEnd(span);
    await processor.forceFlush();
    expect((mockStore.saveEvent as any).mock.calls[0][0].payload.prompt).toBeUndefined();
  });

  it("should handle errors using onError callback", async () => {
    const error = new Error("Database down");
    (mockStore.saveEvent as any).mockRejectedValue(error);

    const onError = vi.fn();
    processor = new NodeLLMSpanProcessor(mockStore, { onError });

    const span = createMockSpan("ai.generateText");
    processor.onEnd(span);

    // We need to wait for the async processSpan to fail
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error, span));
  });

  it("should respect custom sessionIdExtractor", async () => {
    const sessionIdExtractor = (span: any) => "custom-session-id";
    processor = new NodeLLMSpanProcessor(mockStore, { sessionIdExtractor });

    const span = createMockSpan("ai.generateText");
    processor.onEnd(span);
    await processor.forceFlush();

    const event = (mockStore.saveEvent as any).mock.calls[0][0];
    expect(event.sessionId).toBe("custom-session-id");
  });
});
