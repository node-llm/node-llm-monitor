import { describe, it, expect } from "vitest";
import {
  isAISpan,
  isTopLevelAISpan,
  getOperationType,
  extractAIAttributes,
  hrTimeToDate,
  calculateDurationMs,
  extractProvider,
  extractModel,
  mapStatusToEventType,
  generateRequestId,
  normalizeModelName,
  normalizeProviderName
} from "../src/utils.js";
import { OTelReadableSpan } from "../src/types.js";

describe("otel utils", () => {
  const mockSpanContext = () => ({
    traceId: "trace-123",
    spanId: "span-456"
  });

  describe("isAISpan", () => {
    it("should identify Vercel AI spans by name", () => {
      const span = { name: "ai.generateText" } as any;
      expect(isAISpan(span)).toBe(true);
    });

    it("should identify spans with ai.operationId attribute", () => {
      const span = {
        name: "custom-operation",
        attributes: { "ai.operationId": "ai.generateText" }
      } as any;
      expect(isAISpan(span)).toBe(true);
    });

    it("should return false for non-AI spans", () => {
      const span = { name: "http.request", attributes: {} } as any;
      expect(isAISpan(span)).toBe(false);
    });
  });

  describe("isTopLevelAISpan", () => {
    it("should return true for top-level AI spans", () => {
      const span = {
        name: "ai.generateText",
        attributes: {}
      } as any;
      expect(isTopLevelAISpan(span)).toBe(true);
    });

    it("should return false for .doGenerate internal spans", () => {
      const span = {
        name: "ai.generateText.doGenerate",
        attributes: {}
      } as any;
      expect(isTopLevelAISpan(span)).toBe(false);
    });

    it("should return true for tool calls even if they look like internal spans", () => {
      const span = {
        name: "ai.toolCall",
        attributes: { "ai.operationId": "ai.toolCall" }
      } as any;
      expect(isTopLevelAISpan(span)).toBe(true);
    });
  });

  describe("extractAIAttributes", () => {
    it("should extract Vercel AI SDK attributes", () => {
      const span = {
        attributes: {
          "ai.model.id": "gpt-4o",
          "ai.model.provider": "openai",
          "ai.usage.promptTokens": 10,
          "ai.usage.completionTokens": 20,
          "ai.prompt": "Hello",
          "ai.response.text": "Hi there"
        }
      } as any;

      const attrs = extractAIAttributes(span);
      expect(attrs.modelId).toBe("gpt-4o");
      expect(attrs.modelProvider).toBe("openai");
      expect(attrs.promptTokens).toBe(10);
      expect(attrs.completionTokens).toBe(20);
      expect(attrs.prompt).toBe("Hello");
      expect(attrs.responseText).toBe("Hi there");
    });

    it("should extract OTel GenAI standard attributes", () => {
      const span = {
        attributes: {
          "gen_ai.request.model": "claude-3",
          "gen_ai.system": "anthropic",
          "gen_ai.usage.input_tokens": 15,
          "gen_ai.usage.output_tokens": 25
        }
      } as any;

      const attrs = extractAIAttributes(span);
      expect(attrs.genAiRequestModel).toBe("claude-3");
      expect(attrs.genAiSystem).toBe("anthropic");
      expect(attrs.genAiInputTokens).toBe(15);
      expect(attrs.genAiOutputTokens).toBe(25);
    });

    it("should extract custom metadata", () => {
      const span = {
        attributes: {
          "ai.telemetry.metadata.userId": "user-1",
          "ai.telemetry.metadata.env": "prod"
        }
      } as any;

      const attrs = extractAIAttributes(span);
      expect(attrs.metadata).toEqual({
        userId: "user-1",
        env: "prod"
      });
    });
  });

  describe("hrTimeToDate", () => {
    it("should convert OTel hrTime to Date", () => {
      const now = Date.now();
      const seconds = Math.floor(now / 1000);
      const nanos = (now % 1000) * 1_000_000;

      const date = hrTimeToDate([seconds, nanos]);
      expect(date.getTime()).toBe(now);
    });
  });

  describe("calculateDurationMs", () => {
    it("should calculate duration between start and end times", () => {
      const start: [number, number] = [1000, 0];
      const end: [number, number] = [1001, 500_000_000]; // 1.5 seconds later

      expect(calculateDurationMs(start, end)).toBe(1500);
    });
  });

  describe("extractProvider", () => {
    it("should infer provider from model ID if not explicitly provided", () => {
      expect(extractProvider({ modelId: "gpt-4o" })).toBe("openai");
      expect(extractProvider({ modelId: "claude-3" })).toBe("anthropic");
      expect(extractProvider({ modelId: "gemini-pro" })).toBe("google");
      expect(extractProvider({ modelId: "deepseek-chat" })).toBe("deepseek");
    });

    it("should use explicit provider if available", () => {
      expect(extractProvider({ modelProvider: "custom-provider", modelId: "gpt-4" })).toBe(
        "custom-provider"
      );
    });

    it("should normalize Vercel AI SDK provider formats", () => {
      expect(extractProvider({ modelProvider: "openai.responses" })).toBe("openai");
      expect(extractProvider({ modelProvider: "anthropic.messages" })).toBe("anthropic");
      expect(extractProvider({ modelProvider: "google.generativeai" })).toBe("google");
    });

    it("should normalize genAiSystem provider formats", () => {
      expect(extractProvider({ genAiSystem: "openai.chat" })).toBe("openai");
      expect(extractProvider({ genAiSystem: "anthropic.messages" })).toBe("anthropic");
    });
  });

  describe("normalizeProviderName", () => {
    it("should strip operation suffixes from provider names", () => {
      expect(normalizeProviderName("openai.responses")).toBe("openai");
      expect(normalizeProviderName("openai.chat")).toBe("openai");
      expect(normalizeProviderName("anthropic.messages")).toBe("anthropic");
      expect(normalizeProviderName("google.generativeai")).toBe("google");
      expect(normalizeProviderName("google.vertex")).toBe("google");
    });

    it("should pass through standard provider names unchanged", () => {
      expect(normalizeProviderName("openai")).toBe("openai");
      expect(normalizeProviderName("anthropic")).toBe("anthropic");
      expect(normalizeProviderName("google")).toBe("google");
      expect(normalizeProviderName("custom-provider")).toBe("custom-provider");
    });

    it("should handle edge cases", () => {
      expect(normalizeProviderName("")).toBe("");
      expect(normalizeProviderName("unknown")).toBe("unknown");
    });
  });

  describe("mapStatusToEventType", () => {
    it("should map OTel status to NodeLLM event types", () => {
      expect(mapStatusToEventType(1, "ai.generateText")).toBe("request.end");
      expect(mapStatusToEventType(2, "ai.generateText")).toBe("request.error");
      expect(mapStatusToEventType(1, "ai.toolCall")).toBe("tool.end");
      expect(mapStatusToEventType(2, "ai.toolCall")).toBe("tool.error");
    });
  });

  describe("generateRequestId", () => {
    it("should generate a request ID from trace and span context", () => {
      const span = {
        spanContext: () => ({
          traceId: "00112233445566778899aabbccddeeff",
          spanId: "1122334455667788"
        })
      } as any;
      expect(generateRequestId(span)).toBe("otel_00112233_11223344");
    });
  });

  describe("normalizeModelName", () => {
    it("should normalize Vercel AI SDK openai.responses format", () => {
      expect(normalizeModelName("openai.responses/gpt-4o-mini")).toBe("gpt-4o-mini");
      expect(normalizeModelName("openai.responses/gpt-4o")).toBe("gpt-4o");
      expect(normalizeModelName("openai.chat/gpt-3.5-turbo")).toBe("gpt-3.5-turbo");
    });

    it("should normalize Vercel AI SDK anthropic format", () => {
      expect(normalizeModelName("anthropic.messages/claude-3-5-sonnet-20241022")).toBe(
        "claude-3-5-sonnet-20241022"
      );
      expect(normalizeModelName("anthropic.messages/claude-3-opus")).toBe("claude-3-opus");
    });

    it("should normalize Vercel AI SDK google format", () => {
      expect(normalizeModelName("google.generativeai/gemini-1.5-pro")).toBe("gemini-1.5-pro");
      expect(normalizeModelName("google.vertex/gemini-pro")).toBe("gemini-pro");
    });

    it("should pass through standard model names unchanged", () => {
      expect(normalizeModelName("gpt-4o-mini")).toBe("gpt-4o-mini");
      expect(normalizeModelName("claude-3-5-sonnet")).toBe("claude-3-5-sonnet");
      expect(normalizeModelName("gemini-pro")).toBe("gemini-pro");
    });

    it("should handle edge cases", () => {
      expect(normalizeModelName("unknown")).toBe("unknown");
      expect(normalizeModelName("")).toBe("");
      expect(normalizeModelName("provider/")).toBe("provider/"); // returns original when last part is empty
    });
  });

  describe("extractModel", () => {
    it("should extract and normalize model from response model", () => {
      expect(extractModel({ responseModel: "openai.responses/gpt-4o-mini" })).toBe("gpt-4o-mini");
    });

    it("should extract and normalize model from modelId", () => {
      expect(extractModel({ modelId: "anthropic.messages/claude-3-5-sonnet" })).toBe(
        "claude-3-5-sonnet"
      );
    });

    it("should use genAi response model as fallback", () => {
      expect(extractModel({ genAiResponseModel: "gpt-4" })).toBe("gpt-4");
    });

    it("should use genAi request model as fallback", () => {
      expect(extractModel({ genAiRequestModel: "claude-3" })).toBe("claude-3");
    });

    it("should return unknown when no model is present", () => {
      expect(extractModel({})).toBe("unknown");
    });

    it("should prefer responseModel over modelId", () => {
      expect(
        extractModel({
          responseModel: "openai.responses/gpt-4o",
          modelId: "gpt-3.5-turbo"
        })
      ).toBe("gpt-4o");
    });
  });
});
