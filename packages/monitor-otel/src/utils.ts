/**
 * Utility functions for extracting and mapping OpenTelemetry attributes
 * to NodeLLM Monitor events.
 */

import type {
  OTelReadableSpan,
  AttributeValue,
  OTelAttributes,
  AISpanAttributes,
  AIOperationType
} from "./types.js";

/**
 * Known AI operation span names from Vercel AI SDK and standard GenAI conventions
 */
const AI_OPERATION_PREFIXES = [
  "ai.generateText",
  "ai.streamText",
  "ai.generateObject",
  "ai.streamObject",
  "ai.embed",
  "ai.embedMany",
  "ai.toolCall",
  "gen_ai." // Standard OTel prefix
];

/**
 * Check if a span is an AI-related span (Vercel AI SDK or standard GenAI)
 */
export function isAISpan(span: OTelReadableSpan): boolean {
  const hasAIPrefix = AI_OPERATION_PREFIXES.some((prefix) => span.name.startsWith(prefix));
  const hasAIAttributes =
    span.attributes &&
    (span.attributes["ai.operationId"] ||
      span.attributes["gen_ai.system"] ||
      span.attributes["gen_ai.request.model"]);

  return !!(hasAIPrefix || hasAIAttributes);
}

/**
 * Check if this is a top-level operation span (not a .doGenerate/.doStream child)
 */
export function isTopLevelAISpan(span: OTelReadableSpan): boolean {
  const name = span.name;
  const operationId = span.attributes["ai.operationId"] as string | undefined;

  // Top-level spans don't have .doGenerate, .doStream, or .doEmbed suffix
  const isDoSpan =
    name.includes(".doGenerate") || name.includes(".doStream") || name.includes(".doEmbed");

  // Tool calls are their own top-level spans
  const isToolCall = operationId === "ai.toolCall" || name === "ai.toolCall";

  return !isDoSpan || isToolCall;
}

/**
 * Get the operation type from a span
 */
export function getOperationType(span: OTelReadableSpan): AIOperationType | undefined {
  const operationId = span.attributes["ai.operationId"] as string | undefined;
  if (operationId) {
    return operationId as AIOperationType;
  }

  // Fallback to span name
  for (const prefix of AI_OPERATION_PREFIXES) {
    if (span.name.startsWith(prefix)) {
      return span.name.split(" ")[0] as AIOperationType;
    }
  }

  return undefined;
}

/**
 * Extract a string attribute safely
 */
function getString(attrs: OTelAttributes, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}

/**
 * Extract a number attribute safely
 */
function getNumber(attrs: OTelAttributes, key: string): number | undefined {
  const value = attrs[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Extract all AI-related attributes from a span
 */
export function extractAIAttributes(span: OTelReadableSpan): AISpanAttributes {
  const attrs = span.attributes;

  // Extract custom metadata (ai.telemetry.metadata.*)
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("ai.telemetry.metadata.")) {
      const metaKey = key.replace("ai.telemetry.metadata.", "");
      metadata[metaKey] = value;
    }
  }

  return {
    // Operation info
    operationId: getString(attrs, "ai.operationId"),
    functionId: getString(attrs, "ai.telemetry.functionId") || getString(attrs, "resource.name"),

    // Model info
    modelId: getString(attrs, "ai.model.id"),
    modelProvider: getString(attrs, "ai.model.provider"),

    // Request info
    prompt: getString(attrs, "ai.prompt"),
    promptMessages: getString(attrs, "ai.prompt.messages"),
    promptTools: getString(attrs, "ai.prompt.tools"),

    // Response info
    responseText: getString(attrs, "ai.response.text"),
    responseObject: getString(attrs, "ai.response.object"),
    responseToolCalls: getString(attrs, "ai.response.toolCalls"),
    responseFinishReason: getString(attrs, "ai.response.finishReason"),
    responseId: getString(attrs, "ai.response.id"),
    responseModel: getString(attrs, "ai.response.model"),

    // Usage - AI SDK attributes
    promptTokens: getNumber(attrs, "ai.usage.promptTokens"),
    completionTokens: getNumber(attrs, "ai.usage.completionTokens"),

    // Timing (streaming)
    msToFirstChunk: getNumber(attrs, "ai.response.msToFirstChunk"),
    msToFinish: getNumber(attrs, "ai.response.msToFinish"),
    avgCompletionTokensPerSecond: getNumber(attrs, "ai.response.avgCompletionTokensPerSecond"),

    // Tool calls
    toolCallName: getString(attrs, "ai.toolCall.name"),
    toolCallId: getString(attrs, "ai.toolCall.id"),
    toolCallArgs: getString(attrs, "ai.toolCall.args"),
    toolCallResult: getString(attrs, "ai.toolCall.result"),

    // GenAI semantic conventions (OpenTelemetry standard)
    genAiSystem: getString(attrs, "gen_ai.system"),
    genAiRequestModel: getString(attrs, "gen_ai.request.model"),
    genAiResponseModel: getString(attrs, "gen_ai.response.model"),
    genAiInputTokens: getNumber(attrs, "gen_ai.usage.input_tokens"),
    genAiOutputTokens: getNumber(attrs, "gen_ai.usage.output_tokens"),

    // Custom metadata
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
  };
}

/**
 * Convert OTel high-resolution time [seconds, nanoseconds] to Date
 */
export function hrTimeToDate(hrTime: [number, number]): Date {
  const [seconds, nanoseconds] = hrTime;
  return new Date(seconds * 1000 + nanoseconds / 1_000_000);
}

/**
 * Calculate duration in milliseconds from OTel times
 */
export function calculateDurationMs(
  startTime: [number, number],
  endTime: [number, number]
): number {
  const startMs = startTime[0] * 1000 + startTime[1] / 1_000_000;
  const endMs = endTime[0] * 1000 + endTime[1] / 1_000_000;
  return Math.round(endMs - startMs);
}

/**
 * Extract provider from model ID or attributes
 * Handles Vercel AI SDK format (e.g., "openai.responses" -> "openai")
 * Examples:
 *   - "openai" from ai.model.provider
 *   - "openai" from "gpt-4o-mini"
 *   - "anthropic" from "claude-3-5-sonnet"
 */
export function extractProvider(attrs: AISpanAttributes): string {
  // Direct provider attribute
  if (attrs.modelProvider) {
    return normalizeProviderName(attrs.modelProvider);
  }

  // GenAI system
  if (attrs.genAiSystem) {
    return normalizeProviderName(attrs.genAiSystem);
  }

  // Infer from model ID
  const modelId = attrs.modelId || attrs.genAiRequestModel || "";

  if (modelId.startsWith("gpt-") || modelId.includes("openai")) {
    return "openai";
  }
  if (modelId.startsWith("claude-") || modelId.includes("anthropic")) {
    return "anthropic";
  }
  if (modelId.startsWith("gemini-") || modelId.includes("google")) {
    return "google";
  }
  if (modelId.startsWith("deepseek-")) {
    return "deepseek";
  }
  if (modelId.includes("llama") || modelId.includes("mistral")) {
    return "meta";
  }

  return "unknown";
}

/**
 * Normalize provider name by stripping operation suffixes
 * Examples:
 *   - "openai.responses" -> "openai"
 *   - "anthropic.messages" -> "anthropic"
 *   - "google.generativeai" -> "google"
 *   - "openai" -> "openai" (unchanged)
 */
export function normalizeProviderName(provider: string): string {
  if (provider.includes(".")) {
    return provider.split(".")[0] || provider;
  }
  return provider;
}

/**
 * Extract model name from attributes
 * Handles various formats including:
 *   - "gpt-4o-mini" (standard)
 *   - "openai.responses/gpt-4o-mini" (Vercel AI SDK format)
 */
export function extractModel(attrs: AISpanAttributes): string {
  const rawModel =
    attrs.responseModel ||
    attrs.modelId ||
    attrs.genAiResponseModel ||
    attrs.genAiRequestModel ||
    "unknown";

  return normalizeModelName(rawModel);
}

/**
 * Normalize model name by stripping provider prefixes
 * Examples:
 *   - "openai.responses/gpt-4o-mini" -> "gpt-4o-mini"
 *   - "anthropic.messages/claude-3-5-sonnet" -> "claude-3-5-sonnet"
 *   - "gpt-4o-mini" -> "gpt-4o-mini" (unchanged)
 */
export function normalizeModelName(model: string): string {
  if (model.includes("/")) {
    const parts = model.split("/");
    return parts[parts.length - 1] || model;
  }
  return model;
}

/**
 * Map span status code to event type
 */
export function mapStatusToEventType(statusCode: number, operationType?: AIOperationType): string {
  // OTel status codes: 0=UNSET, 1=OK, 2=ERROR
  const isError = statusCode === 2;

  if (operationType?.includes("toolCall")) {
    return isError ? "tool.error" : "tool.end";
  }

  return isError ? "request.error" : "request.end";
}

/**
 * Generate a deterministic request ID from trace/span IDs
 */
export function generateRequestId(span: OTelReadableSpan): string {
  const ctx = span.spanContext();
  // Use trace ID + span ID for uniqueness
  return `otel_${ctx.traceId.slice(0, 8)}_${ctx.spanId.slice(0, 8)}`;
}

/**
 * Extract session ID from span attributes
 */
export function extractSessionId(span: OTelReadableSpan): string | undefined {
  const attrs = span.attributes;

  // Check common session ID locations
  return (
    getString(attrs, "ai.telemetry.metadata.sessionId") ||
    getString(attrs, "ai.telemetry.metadata.session_id") ||
    getString(attrs, "session.id") ||
    getString(attrs, "sessionId")
  );
}

/**
 * Parse JSON string attributes safely
 */
export function parseJsonAttribute<T>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return undefined;
  }
}
