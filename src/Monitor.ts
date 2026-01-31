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
    ctx.state._monitorCpuStart = process.cpuUsage();
    ctx.state._monitorMemStart = process.memoryUsage().heapUsed;
    
    await this.log(ctx, "request.start", {
      messages: this.captureContent ? ctx.messages : undefined,
      options: ctx.options
    });
  }

  async onResponse(ctx: any, result: any): Promise<void> {
    const cpuUsage = process.cpuUsage(ctx.state._monitorCpuStart);
    const cpuTime = (cpuUsage.user + cpuUsage.system) / 1000; // ms
    const allocations = process.memoryUsage().heapUsed - (ctx.state._monitorMemStart || 0);
    const duration = Date.now() - (ctx.state._monitorStart as number || Date.now());

    await this.log(ctx, "request.end", {
      result: this.captureContent ? result.toString() : undefined,
      usage: result.usage
    }, {
      duration,
      cost: result.usage?.cost,
      cpuTime,
      allocations: allocations > 0 ? allocations : 0
    });
  }

  async onError(ctx: any, error: Error): Promise<void> {
    const duration = Date.now() - (ctx.state._monitorStart as number || Date.now());
    await this.log(ctx, "request.error", {
      error: error.message,
      stack: error.stack
    }, { duration });
  }

  async onToolCallStart(ctx: any, tool: any): Promise<void> {
    await this.log(ctx, "tool.start", {
      toolCall: tool
    });
  }

  async onToolCallEnd(ctx: any, tool: any, result: any): Promise<void> {
    await this.log(ctx, "tool.end", {
      toolCallId: tool.id,
      result: this.captureContent ? result : undefined
    });
  }

  async onToolCallError(ctx: any, tool: any, error: Error): Promise<void> {
    await this.log(ctx, "tool.error", {
      toolCallId: tool.id,
      error: error.message
    });
  }

  private async log(
    ctx: any, 
    eventType: string, 
    payload: any, 
    metrics: Partial<MonitoringEvent> = {}
  ): Promise<void> {
    // Inject start time on first event
    if (eventType === "request.start") {
      ctx.state._monitorStart = Date.now();
    }

    const event: MonitoringEvent = {
      id: randomUUID(),
      eventType,
      requestId: ctx.requestId,
      sessionId: ctx.sessionId || ctx.options?.sessionId,
      transactionId: ctx.transactionId || ctx.options?.transactionId,
      time: new Date(),
      createdAt: new Date(),
      provider: ctx.provider,
      model: ctx.model,
      payload: payload || {},
      ...metrics
    };

    this.store.saveEvent(event).catch(err => {
      console.error(`[Monitor] Failed to save event ${eventType}:`, err);
    });
  }
}
