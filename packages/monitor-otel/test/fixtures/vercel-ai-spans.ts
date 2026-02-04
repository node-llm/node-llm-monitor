/**
 * Recorded span fixtures from Vercel AI SDK
 *
 * These represent real-world span data captured from various
 * Vercel AI SDK operations for integration testing.
 */

import type { OTelReadableSpan } from "../../src/types.js";

/**
 * Helper to create a mock span with realistic structure
 */
function createSpanFixture(
  name: string,
  attributes: Record<string, unknown>,
  overrides: Partial<{
    traceId: string;
    spanId: string;
    parentSpanId: string;
    startTime: [number, number];
    endTime: [number, number];
    statusCode: number;
    statusMessage: string;
  }> = {}
): OTelReadableSpan {
  const {
    traceId = "a1b2c3d4e5f6789012345678901234ab",
    spanId = "12345678abcdef01",
    parentSpanId,
    startTime = [1706918400, 0], // 2024-02-03 00:00:00
    endTime = [1706918401, 500000000], // 1.5s later
    statusCode = 1,
    statusMessage
  } = overrides;

  return {
    name,
    spanContext: () => ({ traceId, spanId }),
    parentSpanId,
    startTime,
    endTime,
    status: { code: statusCode, message: statusMessage },
    attributes
  } as OTelReadableSpan;
}

// ============================================================================
// OpenAI Spans
// ============================================================================

/**
 * ai.generateText with OpenAI gpt-4o-mini
 * Recorded from: generateText({ model: openai("gpt-4o-mini"), prompt: "Hello" })
 */
export const openaiGenerateText = createSpanFixture(
  "ai.generateText",
  {
    "ai.operationId": "ai.generateText",
    "ai.model.id": "gpt-4o-mini",
    "ai.model.provider": "openai.responses",
    "ai.usage.promptTokens": 12,
    "ai.usage.completionTokens": 28,
    "ai.prompt": "Hello, how are you?",
    "ai.response.text": "I'm doing well, thank you for asking! How can I help you today?",
    "ai.response.finishReason": "stop",
    "ai.telemetry.functionId": "chat-completion"
  },
  {
    traceId: "openai-trace-001",
    spanId: "openai-span-001"
  }
);

/**
 * ai.streamText with OpenAI gpt-4o
 * Includes streaming metrics
 */
export const openaiStreamText = createSpanFixture(
  "ai.streamText",
  {
    "ai.operationId": "ai.streamText",
    "ai.model.id": "gpt-4o",
    "ai.model.provider": "openai.chat",
    "ai.usage.promptTokens": 156,
    "ai.usage.completionTokens": 423,
    "ai.prompt.messages": JSON.stringify([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Explain quantum computing in simple terms." }
    ]),
    "ai.response.text": "Quantum computing is a type of computation...",
    "ai.response.finishReason": "stop",
    "ai.response.msToFirstChunk": 145,
    "ai.response.msToFinish": 2340,
    "ai.response.avgCompletionTokensPerSecond": 180.5,
    "ai.telemetry.metadata.userId": "user-123",
    "ai.telemetry.metadata.environment": "production"
  },
  {
    traceId: "openai-trace-002",
    spanId: "openai-span-002",
    startTime: [1706918500, 0],
    endTime: [1706918502, 340000000]
  }
);

/**
 * ai.generateObject with OpenAI - structured output
 */
export const openaiGenerateObject = createSpanFixture(
  "ai.generateObject",
  {
    "ai.operationId": "ai.generateObject",
    "ai.model.id": "gpt-4o-mini",
    "ai.model.provider": "openai.responses",
    "ai.usage.promptTokens": 89,
    "ai.usage.completionTokens": 156,
    "ai.prompt": "Extract the person's name and age from: John Smith is 32 years old.",
    "ai.response.object": JSON.stringify({ name: "John Smith", age: 32 }),
    "ai.response.finishReason": "stop"
  },
  {
    traceId: "openai-trace-003",
    spanId: "openai-span-003"
  }
);

// ============================================================================
// Anthropic Spans
// ============================================================================

/**
 * ai.generateText with Anthropic Claude
 */
export const anthropicGenerateText = createSpanFixture(
  "ai.generateText",
  {
    "ai.operationId": "ai.generateText",
    "ai.model.id": "claude-3-5-sonnet-20241022",
    "ai.model.provider": "anthropic.messages",
    "ai.usage.promptTokens": 45,
    "ai.usage.completionTokens": 312,
    "ai.prompt": "Write a haiku about programming.",
    "ai.response.text": "Code flows like water\nBugs emerge from the shadows\nDebug, test, repeat",
    "ai.response.finishReason": "end_turn"
  },
  {
    traceId: "anthropic-trace-001",
    spanId: "anthropic-span-001"
  }
);

/**
 * ai.streamText with Anthropic Claude (using genAi attributes)
 */
export const anthropicGenAiFormat = createSpanFixture(
  "gen_ai.chat",
  {
    "gen_ai.system": "anthropic",
    "gen_ai.request.model": "claude-3-opus",
    "gen_ai.usage.input_tokens": 234,
    "gen_ai.usage.output_tokens": 567
  },
  {
    traceId: "anthropic-trace-002",
    spanId: "anthropic-span-002"
  }
);

// ============================================================================
// Google Gemini Spans
// ============================================================================

/**
 * ai.generateText with Google Gemini
 */
export const geminiGenerateText = createSpanFixture(
  "ai.generateText",
  {
    "ai.operationId": "ai.generateText",
    "ai.model.id": "gemini-1.5-pro",
    "ai.model.provider": "google.generativeai",
    "ai.usage.promptTokens": 78,
    "ai.usage.completionTokens": 245,
    "ai.prompt": "What is the capital of France?",
    "ai.response.text": "The capital of France is Paris...",
    "ai.response.finishReason": "STOP"
  },
  {
    traceId: "google-trace-001",
    spanId: "google-span-001"
  }
);

// ============================================================================
// Tool Call Spans
// ============================================================================

/**
 * ai.toolCall span - weather tool
 */
export const toolCallWeather = createSpanFixture(
  "ai.toolCall",
  {
    "ai.operationId": "ai.toolCall",
    "ai.toolCall.name": "getWeather",
    "ai.toolCall.id": "call_abc123",
    "ai.toolCall.args": JSON.stringify({ city: "London", units: "celsius" }),
    "ai.toolCall.result": JSON.stringify({ temperature: 18, condition: "cloudy" })
  },
  {
    traceId: "tool-trace-001",
    spanId: "tool-span-001",
    parentSpanId: "parent-span-001"
  }
);

/**
 * ai.toolCall span - database query
 */
export const toolCallDatabase = createSpanFixture(
  "ai.toolCall",
  {
    "ai.operationId": "ai.toolCall",
    "ai.toolCall.name": "queryDatabase",
    "ai.toolCall.id": "call_def456",
    "ai.toolCall.args": JSON.stringify({ query: "SELECT * FROM users WHERE active = true" }),
    "ai.toolCall.result": JSON.stringify({ rows: 42, duration: "12ms" })
  },
  {
    traceId: "tool-trace-002",
    spanId: "tool-span-002",
    parentSpanId: "parent-span-002"
  }
);

// ============================================================================
// Error Spans
// ============================================================================

/**
 * ai.generateText with rate limit error
 */
export const errorRateLimit = createSpanFixture(
  "ai.generateText",
  {
    "ai.operationId": "ai.generateText",
    "ai.model.id": "gpt-4o",
    "ai.model.provider": "openai.responses",
    "ai.prompt": "This request will fail"
  },
  {
    traceId: "error-trace-001",
    spanId: "error-span-001",
    statusCode: 2,
    statusMessage: "Rate limit exceeded. Please retry after 60 seconds."
  }
);

/**
 * ai.generateText with context length error
 */
export const errorContextLength = createSpanFixture(
  "ai.generateText",
  {
    "ai.operationId": "ai.generateText",
    "ai.model.id": "gpt-4o-mini",
    "ai.model.provider": "openai.chat",
    "ai.prompt": "Very long prompt that exceeds context..."
  },
  {
    traceId: "error-trace-002",
    spanId: "error-span-002",
    statusCode: 2,
    statusMessage: "This model's maximum context length is 128000 tokens."
  }
);

// ============================================================================
// Internal Spans (should be filtered out)
// ============================================================================

/**
 * Internal .doGenerate span (should NOT be processed)
 */
export const internalDoGenerate = createSpanFixture(
  "ai.generateText.doGenerate",
  {
    "ai.model.id": "gpt-4o-mini",
    "ai.model.provider": "openai.responses",
    "ai.usage.promptTokens": 12,
    "ai.usage.completionTokens": 28
  },
  {
    traceId: "internal-trace-001",
    spanId: "internal-span-001",
    parentSpanId: "parent-span-001"
  }
);

/**
 * HTTP span (should NOT be processed)
 */
export const httpRequest = createSpanFixture(
  "HTTP POST",
  {
    "http.method": "POST",
    "http.url": "https://api.openai.com/v1/chat/completions",
    "http.status_code": 200
  },
  {
    traceId: "http-trace-001",
    spanId: "http-span-001"
  }
);

// ============================================================================
// Embedding Spans
// ============================================================================

/**
 * ai.embed span
 */
export const openaiEmbed = createSpanFixture(
  "ai.embed",
  {
    "ai.operationId": "ai.embed",
    "ai.model.id": "text-embedding-3-small",
    "ai.model.provider": "openai.embedding",
    "ai.usage.promptTokens": 8
  },
  {
    traceId: "embed-trace-001",
    spanId: "embed-span-001"
  }
);

/**
 * ai.embedMany span
 */
export const openaiEmbedMany = createSpanFixture(
  "ai.embedMany",
  {
    "ai.operationId": "ai.embedMany",
    "ai.model.id": "text-embedding-3-large",
    "ai.model.provider": "openai.embedding",
    "ai.usage.promptTokens": 156
  },
  {
    traceId: "embed-trace-002",
    spanId: "embed-span-002"
  }
);

// ============================================================================
// Export all fixtures for easy iteration
// ============================================================================

/**
 * Valid spans that should be processed (excludes tool calls which need special handling)
 */
export const allValidSpans = [
  openaiGenerateText,
  openaiStreamText,
  openaiGenerateObject,
  anthropicGenerateText,
  anthropicGenAiFormat,
  geminiGenerateText,
  openaiEmbed,
  openaiEmbedMany
];

/**
 * Tool call spans - these are separate as they may need special handling
 */
export const toolCallSpans = [toolCallWeather, toolCallDatabase];

export const errorSpans = [errorRateLimit, errorContextLength];

export const filteredOutSpans = [internalDoGenerate, httpRequest];
