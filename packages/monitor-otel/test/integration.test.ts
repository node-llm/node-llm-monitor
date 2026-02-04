/**
 * Integration tests for NodeLLMSpanProcessor
 *
 * These tests use recorded span fixtures from Vercel AI SDK
 * to verify the processor handles real-world span data correctly.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NodeLLMSpanProcessor } from "../src/NodeLLMSpanProcessor.js";
import { MemoryAdapter, type MonitoringEvent } from "@node-llm/monitor";
import {
  openaiGenerateText,
  openaiStreamText,
  openaiGenerateObject,
  anthropicGenerateText,
  anthropicGenAiFormat,
  geminiGenerateText,
  toolCallWeather,
  toolCallDatabase,
  errorRateLimit,
  errorContextLength,
  internalDoGenerate,
  httpRequest,
  openaiEmbed,
  openaiEmbedMany,
  allValidSpans,
  filteredOutSpans
} from "./fixtures/vercel-ai-spans.js";

/**
 * Helper to get trace summaries from listTraces result
 */
async function getTraceSummaries(store: MemoryAdapter, options = {}) {
  const result = await store.listTraces(options);
  return result.items;
}

/**
 * Helper to get full event by requestId
 */
async function getFullEvent(
  store: MemoryAdapter,
  requestId: string
): Promise<MonitoringEvent | undefined> {
  const events = await store.getEvents(requestId);
  return events[0];
}

/**
 * Helper to get the first full event from the store
 */
async function getFirstEvent(store: MemoryAdapter): Promise<MonitoringEvent | undefined> {
  const traces = await getTraceSummaries(store);
  if (traces.length === 0) return undefined;
  return getFullEvent(store, traces[0].requestId);
}

describe("NodeLLMSpanProcessor Integration", () => {
  let store: MemoryAdapter;
  let processor: NodeLLMSpanProcessor;

  beforeEach(() => {
    store = new MemoryAdapter();
    processor = new NodeLLMSpanProcessor(store);
  });

  describe("Provider Normalization", () => {
    it("should normalize openai.responses to openai", async () => {
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces).toHaveLength(1);
      expect(traces[0].provider).toBe("openai");
    });

    it("should normalize openai.chat to openai", async () => {
      processor.onEnd(openaiStreamText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].provider).toBe("openai");
    });

    it("should normalize anthropic.messages to anthropic", async () => {
      processor.onEnd(anthropicGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].provider).toBe("anthropic");
    });

    it("should normalize google.generativeai to google", async () => {
      processor.onEnd(geminiGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].provider).toBe("google");
    });
  });

  describe("Model Extraction", () => {
    it("should extract correct model from OpenAI spans", async () => {
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].model).toBe("gpt-4o-mini");
    });

    it("should extract correct model from Anthropic spans", async () => {
      processor.onEnd(anthropicGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].model).toBe("claude-3-5-sonnet-20241022");
    });

    it("should extract correct model from genAi format spans", async () => {
      processor.onEnd(anthropicGenAiFormat);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].model).toBe("claude-3-opus");
    });
  });

  describe("Token Usage", () => {
    it("should extract prompt and completion tokens from Vercel AI SDK format", async () => {
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.usage).toEqual({
        promptTokens: 12,
        completionTokens: 28,
        totalTokens: 40
      });
    });

    it("should extract tokens from genAi format", async () => {
      processor.onEnd(anthropicGenAiFormat);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.usage).toEqual({
        promptTokens: 234,
        completionTokens: 567,
        totalTokens: 801
      });
    });
  });

  describe("Streaming Metrics", () => {
    it("should capture streaming metrics from streamText spans", async () => {
      processor.onEnd(openaiStreamText);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.msToFirstChunk).toBe(145);
      expect(event!.payload.msToFinish).toBe(2340);
      expect(event!.payload.avgCompletionTokensPerSecond).toBe(180.5);
    });
  });

  describe("Custom Metadata", () => {
    it("should extract telemetry metadata", async () => {
      processor.onEnd(openaiStreamText);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.metadata).toEqual({
        userId: "user-123",
        environment: "production"
      });
    });
  });

  describe("Content Capture", () => {
    it("should capture prompt and response when enabled", async () => {
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.prompt).toBe("Hello, how are you?");
      expect(event!.payload.result).toBe(
        "I'm doing well, thank you for asking! How can I help you today?"
      );
    });

    it("should capture structured object responses", async () => {
      processor.onEnd(openaiGenerateObject);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.object).toEqual({ name: "John Smith", age: 32 });
    });

    it("should NOT capture content when disabled", async () => {
      processor = new NodeLLMSpanProcessor(store, { captureContent: false });
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.prompt).toBeUndefined();
      expect(event!.payload.result).toBeUndefined();
    });
  });

  describe("Tool Calls", () => {
    // Tool calls are tested in NodeLLMSpanProcessor.test.ts with mocks
    // These tests verify tool calls work with MemoryAdapter
    it("should process tool call spans", async () => {
      // Use mock store since tool calls don't have model info for TraceSummary
      const mockStore = {
        saveEvent: vi.fn().mockResolvedValue(undefined)
      } as any;
      const toolProcessor = new NodeLLMSpanProcessor(mockStore);

      toolProcessor.onEnd(toolCallWeather);
      await toolProcessor.forceFlush();

      expect(mockStore.saveEvent).toHaveBeenCalled();
      const event = mockStore.saveEvent.mock.calls[0][0];
      expect(event.eventType).toBe("tool.end");
      expect(event.payload.tool.name).toBe("getWeather");
    });

    it("should capture tool args and result", async () => {
      const mockStore = {
        saveEvent: vi.fn().mockResolvedValue(undefined)
      } as any;
      const toolProcessor = new NodeLLMSpanProcessor(mockStore);

      toolProcessor.onEnd(toolCallWeather);
      await toolProcessor.forceFlush();

      const event = mockStore.saveEvent.mock.calls[0][0];
      expect(event.payload.tool).toEqual({
        name: "getWeather",
        id: "call_abc123",
        args: { city: "London", units: "celsius" },
        result: { temperature: 18, condition: "cloudy" }
      });
    });

    it("should handle multiple tool calls", async () => {
      const mockStore = {
        saveEvent: vi.fn().mockResolvedValue(undefined)
      } as any;
      const toolProcessor = new NodeLLMSpanProcessor(mockStore);

      toolProcessor.onEnd(toolCallWeather);
      toolProcessor.onEnd(toolCallDatabase);
      await toolProcessor.forceFlush();

      expect(mockStore.saveEvent).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should capture error spans with request.error event type", async () => {
      processor.onEnd(errorRateLimit);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.eventType).toBe("request.error");
      expect(event!.payload.error).toBe("Rate limit exceeded. Please retry after 60 seconds.");
    });

    it("should capture context length errors", async () => {
      processor.onEnd(errorContextLength);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.eventType).toBe("request.error");
      expect(event!.payload.error).toContain("maximum context length");
    });
  });

  describe("Span Filtering", () => {
    it("should filter out internal .doGenerate spans", async () => {
      processor.onEnd(internalDoGenerate);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces).toHaveLength(0);
    });

    it("should filter out HTTP spans", async () => {
      processor.onEnd(httpRequest);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces).toHaveLength(0);
    });

    it("should process all valid spans and filter out invalid ones", async () => {
      // Process all spans
      for (const span of allValidSpans) {
        processor.onEnd(span);
      }
      for (const span of filteredOutSpans) {
        processor.onEnd(span);
      }
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces).toHaveLength(allValidSpans.length);
    });
  });

  describe("OTel Trace Context", () => {
    it("should preserve OTel trace and span IDs", async () => {
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const event = await getFirstEvent(store);
      expect(event).toBeDefined();
      expect(event!.payload.otel).toEqual({
        traceId: "openai-trace-001",
        spanId: "openai-span-001",
        parentSpanId: undefined
      });
    });

    it("should include parent span ID for child spans", async () => {
      // Use mock store for tool call which has parent span
      const mockStore = {
        saveEvent: vi.fn().mockResolvedValue(undefined)
      } as any;
      const toolProcessor = new NodeLLMSpanProcessor(mockStore);

      toolProcessor.onEnd(toolCallWeather);
      await toolProcessor.forceFlush();

      const event = mockStore.saveEvent.mock.calls[0][0];
      expect(event.payload.otel.parentSpanId).toBe("parent-span-001");
    });
  });

  describe("Embedding Operations", () => {
    it("should process ai.embed spans", async () => {
      processor.onEnd(openaiEmbed);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].model).toBe("text-embedding-3-small");

      const event = await getFirstEvent(store);
      expect(event!.payload.operationType).toBe("ai.embed");
    });

    it("should process ai.embedMany spans", async () => {
      processor.onEnd(openaiEmbedMany);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].model).toBe("text-embedding-3-large");

      const event = await getFirstEvent(store);
      expect(event!.payload.operationType).toBe("ai.embedMany");
    });
  });

  describe("Cost Estimation", () => {
    it("should estimate cost for OpenAI gpt-4o-mini", async () => {
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      // Cost should be calculated based on token counts
      expect(traces[0].cost).toBeGreaterThan(0);
      expect(typeof traces[0].cost).toBe("number");
    });

    it("should estimate cost for Anthropic Claude", async () => {
      processor.onEnd(anthropicGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      expect(traces[0].cost).toBeGreaterThan(0);
    });
  });

  describe("Duration Calculation", () => {
    it("should calculate duration from start/end times", async () => {
      processor.onEnd(openaiGenerateText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      // Start: [1706918400, 0], End: [1706918401, 500000000] = 1500ms
      expect(traces[0].duration).toBe(1500);
    });

    it("should calculate correct duration for streaming spans", async () => {
      processor.onEnd(openaiStreamText);
      await processor.forceFlush();

      const traces = await getTraceSummaries(store);
      // Start: [1706918500, 0], End: [1706918502, 340000000] = 2340ms
      expect(traces[0].duration).toBe(2340);
    });
  });

  describe("Concurrent Processing", () => {
    it("should handle many spans concurrently", async () => {
      const spanCount = 100;

      for (let i = 0; i < spanCount; i++) {
        processor.onEnd({
          ...openaiGenerateText,
          spanContext: () => ({ traceId: `trace-${i}`, spanId: `span-${i}` })
        } as any);
      }

      await processor.forceFlush();

      const traces = await getTraceSummaries(store, { limit: 200 });
      expect(traces).toHaveLength(spanCount);
    });
  });
});
