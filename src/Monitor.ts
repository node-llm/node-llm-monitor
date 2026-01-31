import type { MonitoringStore, MonitorOptions, EventType, MonitoringEvent } from "./types.js";
// Using internal type definitions to avoid hard dependency on @node-llm/core for now
// while keeping compatibility with its Middleware interface.
import { randomUUID } from "node:crypto";

export class Monitor {
  public readonly name = "NodeLLMMonitor";
  private store: MonitoringStore;
  private captureContent: boolean;

  constructor(options: MonitorOptions) {
    this.store = options.store;
    this.captureContent = options.captureContent ?? false;
  }

  async onRequest(ctx: any): Promise<void> {
    await this.log(ctx, "request_start", {
      messages: this.captureContent ? ctx.messages : undefined,
      options: ctx.options
    });
  }

  async onResponse(ctx: any, result: any): Promise<void> {
    await this.log(ctx, "request_end", {
      result: this.captureContent ? result.toString() : undefined,
      usage: result.usage,
      latency: Date.now() - (ctx.state._monitorStart as number || Date.now())
    });
  }

  async onError(ctx: any, error: Error): Promise<void> {
    await this.log(ctx, "request_error", {
      error: error.message,
      stack: error.stack
    });
  }

  async onToolCallStart(ctx: any, tool: any): Promise<void> {
    await this.log(ctx, "tool_start", {
      toolCall: tool
    });
  }

  async onToolCallEnd(ctx: any, tool: any, result: any): Promise<void> {
    await this.log(ctx, "tool_end", {
      toolCallId: tool.id,
      result: this.captureContent ? result : undefined
    });
  }

  async onToolCallError(ctx: any, tool: any, error: Error): Promise<void> {
    await this.log(ctx, "tool_error", {
      toolCallId: tool.id,
      error: error.message
    });
  }

  private async log(ctx: any, eventType: EventType, payload: any): Promise<void> {
    // Inject start time on first event
    if (eventType === "request_start") {
      ctx.state._monitorStart = Date.now();
    }

    const event: MonitoringEvent = {
      id: randomUUID(),
      requestId: ctx.requestId,
      timestamp: new Date(),
      eventType,
      provider: ctx.provider,
      model: ctx.model,
      payload
    };

    // Store the event. We don't await to avoid blocking the LLM request.
    // However, for high-reliability auditing, we might want to await. 
    // The plan says "high-performance," so we'll fire and forget or use a queue later.
    this.store.saveEvent(event).catch(err => {
      console.error(`[Monitor] Failed to save event ${eventType}:`, err);
    });
  }
}
