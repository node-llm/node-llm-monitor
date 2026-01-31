import { randomUUID } from "node:crypto";
import type { 
  MonitoringStore, 
  MonitorOptions, 
  MonitoringEvent 
} from "./types.js";

/**
 * Minimal interface for NodeLLM context to ensure type safety without forcing dependencies.
 */
export interface MinimalContext {
  requestId: string;
  provider: string;
  model: string;
  state: Record<string, any>;
  messages?: any[];
  options?: Record<string, any>;
  sessionId?: string;
  transactionId?: string;
}

export class Monitor {
  public readonly name = "NodeLLMMonitor";
  
  private readonly store: MonitoringStore;
  private readonly captureContent: boolean;
  private readonly errorHook?: ((error: Error, event: MonitoringEvent) => void) | undefined;

  constructor(options: MonitorOptions) {
    this.store = options.store;
    this.captureContent = options.captureContent ?? false;
    this.errorHook = options.onError;
  }

  async onRequest(ctx: MinimalContext): Promise<void> {
    this.initializeMetrics(ctx);
    
    await this.emit(ctx, "request.start", {
      messages: this.captureContent ? ctx.messages : undefined,
      options: ctx.options
    });
  }

  async onResponse(ctx: MinimalContext, result: { toString(): string; usage?: any }): Promise<void> {
    const metrics = this.calculateMetrics(ctx, result.usage);

    await this.emit(ctx, "request.end", {
      result: this.captureContent ? result.toString() : undefined,
      usage: result.usage
    }, metrics);
  }

  async onError(ctx: MinimalContext, error: Error): Promise<void> {
    const metrics = this.calculateMetrics(ctx);
    
    await this.emit(ctx, "request.error", {
      error: error.message,
      stack: error.stack
    }, metrics);
  }

  async onToolCallStart(ctx: MinimalContext, tool: any): Promise<void> {
    await this.emit(ctx, "tool.start", { toolCall: tool });
  }

  async onToolCallEnd(ctx: MinimalContext, tool: any, result: any): Promise<void> {
    await this.emit(ctx, "tool.end", {
      toolCallId: tool.id,
      result: this.captureContent ? result : undefined
    });
  }

  async onToolCallError(ctx: MinimalContext, tool: any, error: Error): Promise<void> {
    await this.emit(ctx, "tool.error", {
      toolCallId: tool.id,
      error: error.message
    });
  }

  /**
   * Internal telemetry engine
   */
  private async emit(
    ctx: MinimalContext, 
    eventType: string, 
    payload: any, 
    metrics: Partial<MonitoringEvent> = {}
  ): Promise<void> {
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

    // Non-blocking persistence with error isolation
    this.store.saveEvent(event).catch(err => {
      if (this.errorHook) {
        this.errorHook(err, event);
      } else {
        console.error(`[NodeLLM-Monitor] Storage Failure (${eventType}):`, err.message);
      }
    });
  }

  private initializeMetrics(ctx: MinimalContext): void {
    ctx.state._monitor = {
      startTime: Date.now(),
      cpuStart: process.cpuUsage(),
      memStart: process.memoryUsage().heapUsed
    };
  }

  private calculateMetrics(ctx: MinimalContext, usage?: any): Partial<MonitoringEvent> {
    const state = ctx.state._monitor;
    if (!state) return {};

    const cpuUsage = process.cpuUsage(state.cpuStart);
    const cpuTime = (cpuUsage.user + cpuUsage.system) / 1000; // ms
    const allocations = process.memoryUsage().heapUsed - (state.memStart || 0);
    const duration = Date.now() - state.startTime;

    return {
      duration,
      cost: usage?.cost,
      cpuTime,
      allocations: Math.max(0, allocations)
    };
  }
}
