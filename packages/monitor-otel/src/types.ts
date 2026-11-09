/**
 * OpenTelemetry Types for NodeLLM Monitor
 *
 * These interfaces mirror the OpenTelemetry API to avoid hard dependencies.
 * Users must provide their own @opentelemetry/api and @opentelemetry/sdk-trace-base.
 */

import type {
  Attributes,
  AttributeValue as OTelAttributeValue,
  Context,
  Span,
  SpanStatus
} from "@opentelemetry/api";
import type { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base";

/**
 * Minimal Span interface matching OpenTelemetry ReadableSpan
 */
export type OTelReadableSpan = ReadableSpan;
export type OTelSpan = Span;
export type OTelContext = Context;
export type OTelAttributes = Attributes;
export type AttributeValue = OTelAttributeValue;

export interface SpanEvent {
  name: string;
  time: [number, number];
  attributes?: Attributes;
}

/**
 * SpanProcessor interface matching OpenTelemetry SDK
 */
export type OTelSpanProcessor = SpanProcessor;

/**
 * Vercel AI SDK span operation types
 */
export type AIOperationType =
  | "ai.generateText"
  | "ai.generateText.doGenerate"
  | "ai.streamText"
  | "ai.streamText.doStream"
  | "ai.generateObject"
  | "ai.generateObject.doGenerate"
  | "ai.streamObject"
  | "ai.streamObject.doStream"
  | "ai.embed"
  | "ai.embed.doEmbed"
  | "ai.embedMany"
  | "ai.embedMany.doEmbed"
  | "ai.toolCall";

/**
 * Extracted AI attributes from OTel span
 */
export interface AISpanAttributes {
  // Operation info
  operationId?: string | undefined;
  functionId?: string | undefined;

  // Model info
  modelId?: string | undefined;
  modelProvider?: string | undefined;

  // Request info
  prompt?: string | undefined;
  promptMessages?: string | undefined;
  promptTools?: string | undefined;

  // Response info
  responseText?: string | undefined;
  responseObject?: string | undefined;
  responseToolCalls?: string | undefined;
  responseFinishReason?: string | undefined;
  responseId?: string | undefined;
  responseModel?: string | undefined;

  // Usage
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  totalTokens?: number | undefined;
  // Cache/reasoning usage (forward-compatible AI SDK attributes - not yet
  cachedInputTokens?: number | undefined;
  reasoningTokens?: number | undefined;

  // Timing (streaming)
  msToFirstChunk?: number | undefined;
  msToFinish?: number | undefined;
  avgCompletionTokensPerSecond?: number | undefined;

  // Tool calls
  toolCallName?: string | undefined;
  toolCallId?: string | undefined;
  toolCallArgs?: string | undefined;
  toolCallResult?: string | undefined;

  // GenAI semantic conventions
  genAiSystem?: string | undefined;
  genAiRequestModel?: string | undefined;
  genAiResponseModel?: string | undefined;
  genAiInputTokens?: number | undefined;
  genAiOutputTokens?: number | undefined;
  genAiCacheReadInputTokens?: number | undefined;
  genAiCacheCreationInputTokens?: number | undefined;
  genAiReasoningOutputTokens?: number | undefined;

  // Custom metadata
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Configuration for the NodeLLM SpanProcessor
 */
export interface NodeLLMSpanProcessorOptions {
  /**
   * Whether to capture prompt/response content.
   * Default: true (respects Vercel AI SDK's recordInputs/recordOutputs settings)
   */
  captureContent?: boolean;

  /**
   * Filter function to decide which spans to process.
   * Return true to process, false to skip.
   * Default: processes all ai.* spans
   */
  filter?: (span: OTelReadableSpan) => boolean;

  /**
   * Custom transform function to modify the monitoring event before saving.
   */
  transform?: (
    event: import("@node-llm/monitor").MonitoringEvent,
    span: OTelReadableSpan
  ) => import("@node-llm/monitor").MonitoringEvent;

  /**
   * Session ID extractor. By default, looks for ai.telemetry.metadata.sessionId
   */
  sessionIdExtractor?: (span: OTelReadableSpan) => string | undefined;

  /**
   * Whether to record spans that NodeLLM's own OpenTelemetry middleware
   * created (they carry a `node_llm.request_id` attribute).
   * Default: false. The Monitor middleware already records NodeLLM calls, so
   * recording these spans too would count each call twice. Set to true when
   * NodeLLM reaches Monitor only through OpenTelemetry.
   */
  includeNodeLLMSpans?: boolean;

  /**
   * Error handler for storage failures
   */
  onError?: (error: Error, span: OTelReadableSpan) => void;
}
