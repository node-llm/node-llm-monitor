/**
 * NodeLLM SpanProcessor for OpenTelemetry
 *
 * This SpanProcessor intercepts OpenTelemetry spans emitted by the Vercel AI SDK
 * (and other OTel-instrumented LLM libraries) and converts them to NodeLLM Monitor events.
 *
 * Usage:
 * ```ts
 * import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
 * import { NodeLLMSpanProcessor } from "@node-llm/monitor/otel";
 * import { PrismaAdapter } from "@node-llm/monitor/adapters/prisma";
 *
 * const store = new PrismaAdapter(prisma);
 * const provider = new NodeTracerProvider();
 * provider.addSpanProcessor(new NodeLLMSpanProcessor(store));
 * provider.register();
 *
 * // Now Vercel AI SDK's experimental_telemetry will flow to node-llm-monitor
 * await generateText({
 *   model: openai("gpt-4o"),
 *   prompt: "Hello",
 *   experimental_telemetry: { isEnabled: true }
 * });
 * ```
 */

import { randomUUID } from "node:crypto";
import type { MonitoringStore, MonitoringEvent } from "@node-llm/monitor";
import type {
  OTelReadableSpan,
  OTelSpan,
  OTelContext,
  OTelSpanProcessor,
  NodeLLMSpanProcessorOptions
} from "./types.js";
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
  extractSessionId,
  parseJsonAttribute
} from "./utils.js";
import { estimateCost } from "@node-llm/monitor";

/**
 * OpenTelemetry SpanProcessor that routes AI spans to NodeLLM Monitor storage.
 *
 * This processor:
 * 1. Filters for AI-related spans (ai.generateText, ai.streamText, etc.)
 * 2. Extracts LLM-specific attributes (model, tokens, cost, etc.)
 * 3. Converts to MonitoringEvent format
 * 4. Saves to the configured MonitoringStore
 */
export class NodeLLMSpanProcessor implements OTelSpanProcessor {
  private readonly store: MonitoringStore;
  private readonly options: Required<Pick<NodeLLMSpanProcessorOptions, "captureContent">> &
    NodeLLMSpanProcessorOptions;
  private pendingWrites: Promise<void>[] = [];

  constructor(store: MonitoringStore, options: NodeLLMSpanProcessorOptions = {}) {
    this.store = store;
    this.options = {
      captureContent: true,
      ...options
    };
  }

  /**
   * Called when a span starts. We don't need to do anything here
   * since we process spans on completion.
   */
  onStart(_span: OTelSpan, _parentContext: OTelContext): void {
    // No-op: We process spans when they end
  }

  /**
   * Called when a span ends. This is where we extract data and save events.
   */
  onEnd(span: OTelReadableSpan): void {
    // Quick filter: only process AI spans
    if (!isAISpan(span)) {
      return;
    }

    // Apply custom filter if provided
    if (this.options.filter && !this.options.filter(span)) {
      return;
    }

    // Process only top-level spans to avoid duplicates
    // (doGenerate/doStream contain the detailed info, but top-level has aggregated data)
    if (!isTopLevelAISpan(span)) {
      return;
    }

    // Convert and save asynchronously
    const writePromise = this.processSpan(span).catch((error) => {
      if (this.options.onError) {
        this.options.onError(error as Error, span);
      } else {
        console.error("[NodeLLMSpanProcessor] Error processing span:", error);
      }
    });

    this.pendingWrites.push(writePromise);
  }

  /**
   * Process a single span and save as MonitoringEvent
   */
  private async processSpan(span: OTelReadableSpan): Promise<void> {
    const event = this.spanToEvent(span);

    // Apply custom transform if provided
    const finalEvent = this.options.transform ? this.options.transform(event, span) : event;

    await this.store.saveEvent(finalEvent);
  }

  /**
   * Convert an OTel span to a MonitoringEvent
   */
  private spanToEvent(span: OTelReadableSpan): MonitoringEvent {
    const attrs = extractAIAttributes(span);
    const operationType = getOperationType(span);
    const provider = extractProvider(attrs);
    const model = extractModel(attrs);
    const duration = calculateDurationMs(span.startTime, span.endTime);

    // Calculate token counts (prefer AI SDK attributes, fallback to GenAI conventions)
    const promptTokens = attrs.promptTokens ?? attrs.genAiInputTokens ?? 0;
    const completionTokens = attrs.completionTokens ?? attrs.genAiOutputTokens ?? 0;

    // Estimate cost
    const cost = estimateCost(provider, model, promptTokens, completionTokens);

    // Extract request ID
    const requestId = this.options.sessionIdExtractor
      ? generateRequestId(span)
      : generateRequestId(span);

    // Extract session ID
    const sessionId = this.options.sessionIdExtractor
      ? this.options.sessionIdExtractor(span)
      : extractSessionId(span);

    // Build payload
    const payload: Record<string, unknown> = {
      operationType,
      functionId: attrs.functionId,
      finishReason: attrs.responseFinishReason,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      },
      // Streaming metrics
      ...(attrs.msToFirstChunk !== undefined && {
        msToFirstChunk: attrs.msToFirstChunk
      }),
      ...(attrs.msToFinish !== undefined && { msToFinish: attrs.msToFinish }),
      ...(attrs.avgCompletionTokensPerSecond !== undefined && {
        avgCompletionTokensPerSecond: attrs.avgCompletionTokensPerSecond
      }),
      // Custom metadata
      ...(attrs.metadata && { metadata: attrs.metadata }),
      // OpenTelemetry trace context
      otel: {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
        parentSpanId: span.parentSpanId
      }
    };

    // Add content if enabled
    if (this.options.captureContent) {
      if (attrs.prompt) {
        payload.prompt = attrs.prompt;
      }
      if (attrs.promptMessages) {
        payload.messages = parseJsonAttribute(attrs.promptMessages);
      }
      if (attrs.responseText) {
        payload.result = attrs.responseText;
      }
      if (attrs.responseObject) {
        payload.object = parseJsonAttribute(attrs.responseObject);
      }
      if (attrs.responseToolCalls) {
        payload.toolCalls = parseJsonAttribute(attrs.responseToolCalls);
      }
    }

    // Tool call specific payload
    if (operationType === "ai.toolCall") {
      payload.tool = {
        name: attrs.toolCallName,
        id: attrs.toolCallId,
        ...(this.options.captureContent && {
          args: parseJsonAttribute(attrs.toolCallArgs),
          result: parseJsonAttribute(attrs.toolCallResult)
        })
      };
    }

    // Handle errors
    if (span.status.code === 2) {
      payload.error = span.status.message || "Unknown error";
    }

    return {
      id: randomUUID(),
      eventType: mapStatusToEventType(span.status.code, operationType),
      requestId,
      sessionId,
      time: hrTimeToDate(span.startTime),
      duration,
      cost,
      payload,
      createdAt: new Date(),
      provider,
      model
    };
  }

  /**
   * Flush all pending writes
   */
  async forceFlush(): Promise<void> {
    await Promise.all(this.pendingWrites);
    this.pendingWrites = [];
  }

  /**
   * Shutdown the processor
   */
  async shutdown(): Promise<void> {
    await this.forceFlush();
  }
}

/**
 * Factory function to create a SpanProcessor with simpler API
 */
export function createOTelProcessor(
  store: MonitoringStore,
  options?: NodeLLMSpanProcessorOptions
): NodeLLMSpanProcessor {
  return new NodeLLMSpanProcessor(store, options);
}
