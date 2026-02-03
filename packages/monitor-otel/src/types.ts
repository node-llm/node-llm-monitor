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
  operationId?: string;
  functionId?: string;

  // Model info
  modelId?: string;
  modelProvider?: string;

  // Request info
  prompt?: string;
  promptMessages?: string;
  promptTools?: string;

  // Response info
  responseText?: string;
  responseObject?: string;
  responseToolCalls?: string;
  responseFinishReason?: string;
  responseId?: string;
  responseModel?: string;

  // Usage
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;

  // Timing (streaming)
  msToFirstChunk?: number;
  msToFinish?: number;
  avgCompletionTokensPerSecond?: number;

  // Tool calls
  toolCallName?: string;
  toolCallId?: string;
  toolCallArgs?: string;
  toolCallResult?: string;

  // GenAI semantic conventions
  genAiSystem?: string;
  genAiRequestModel?: string;
  genAiResponseModel?: string;
  genAiInputTokens?: number;
  genAiOutputTokens?: number;

  // Custom metadata
  metadata?: Record<string, unknown>;
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
   * Error handler for storage failures
   */
  onError?: (error: Error, span: OTelReadableSpan) => void;
}
