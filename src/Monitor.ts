import { randomUUID } from "node:crypto";
import type { 
  MonitoringStore, 
  MonitorOptions, 
  MonitoringEvent 
} from "./types.js";
import type { EnhancedMonitoringPayload } from "./metadata.js";

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

  /**
   * Seamless creation with In-Memory store (Development/Testing)
   */
  static memory(options?: Omit<MonitorOptions, 'store'>): Monitor {
    const memoryStore: MonitoringStore = {
      async saveEvent() {},
      async getEvents() { return []; },
      async getStats() { return { totalRequests: 0, totalCost: 0, avgDuration: 0, errorRate: 0 }; },
      async getMetrics() { 
        return { 
          totals: await this.getStats(), 
          byProvider: [], 
          timeSeries: { requests: [], cost: [], duration: [], errors: [] }
        }; 
      },
      async listTraces() { return { items: [], total: 0, limit: 50, offset: 0 }; }
    };
    return new Monitor({
      ...options,
      store: memoryStore
    });
  }

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

  /**
   * Helper: Enrich payload with request metadata
   */
  enrichWithRequestMetadata(
    payload: Record<string, any>,
    options: {
      streaming?: boolean;
      requestSizeBytes?: number;
      responseSizeBytes?: number;
      promptVersion?: string;
      templateId?: string;
    }
  ): EnhancedMonitoringPayload {
    const request: Record<string, any> = {};
    if (options.streaming !== undefined) request.streaming = options.streaming;
    if (options.requestSizeBytes !== undefined) request.requestSizeBytes = options.requestSizeBytes;
    if (options.responseSizeBytes !== undefined) request.responseSizeBytes = options.responseSizeBytes;
    if (options.promptVersion !== undefined) request.promptVersion = options.promptVersion;
    if (options.templateId !== undefined) request.templateId = options.templateId;
    
    return {
      ...payload,
      request
    };
  }

  /**
   * Helper: Enrich payload with timing breakdown
   */
  enrichWithTiming(
    payload: Record<string, any>,
    timing: {
      queueTime?: number;
      networkTime?: number;
      providerLatency?: number;
      toolTimeTotal?: number;
      timeToFirstToken?: number;
    }
  ): EnhancedMonitoringPayload {
    return {
      ...payload,
      timing
    };
  }

  /**
   * Helper: Enrich payload with environment context
   */
  enrichWithEnvironment(
    payload: Record<string, any>,
    env: {
      serviceName?: string;
      serviceVersion?: string;
      environment?: 'production' | 'staging' | 'development' | 'test';
      region?: string;
    }
  ): EnhancedMonitoringPayload {
    return {
      ...payload,
      environment: {
        ...env,
        nodeVersion: process.version,
      }
    };
  }

  /**
   * Helper: Enrich payload with retry metadata
   */
  enrichWithRetry(
    payload: Record<string, any>,
    retry: {
      retryCount?: number;
      retryReason?: 'timeout' | 'rate_limit' | 'network' | 'server_error' | 'other';
      fallbackModel?: string;
    }
  ): EnhancedMonitoringPayload {
    return {
      ...payload,
      retry
    };
  }

  /**
   * Helper: Enrich payload with sampling metadata
   */
  enrichWithSampling(
    payload: Record<string, any>,
    sampling: {
      samplingRate?: number;
      sampled?: boolean;
      samplingReason?: 'high_volume' | 'debug' | 'error' | 'random' | 'always';
    }
  ): EnhancedMonitoringPayload {
    return {
      ...payload,
      sampling
    };
  }
}
