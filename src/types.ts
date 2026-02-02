export type EventType =
  | "request.start"
  | "request.end"
  | "request.error"
  | "tool.start"
  | "tool.end"
  | "tool.error";

export interface MonitoringEvent {
  id: string;
  eventType: string;
  requestId: string;
  sessionId?: string;
  transactionId?: string;
  time: Date;
  duration?: number;
  cost?: number;
  cpuTime?: number;
  gcTime?: number;
  allocations?: number;
  payload: Record<string, any>;
  createdAt: Date;
  provider: string;
  model: string;
}

export interface MonitoringStats {
  totalRequests: number;
  totalCost: number;
  avgDuration: number;
  errorRate: number;
}

export interface ProviderStats {
  provider: string;
  model: string;
  requests: number;
  cost: number;
  avgDuration: number;
  errorCount: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface MetricsData {
  totals: MonitoringStats;
  byProvider: ProviderStats[];
  timeSeries: {
    requests: TimeSeriesPoint[];
    cost: TimeSeriesPoint[];
    duration: TimeSeriesPoint[];
    errors: TimeSeriesPoint[];
  };
}

export interface TraceSummary {
  requestId: string;
  provider: string;
  model: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  cost?: number;
  cpuTime?: number;
  allocations?: number;
  status: "success" | "error" | "running";
}

export interface PaginatedTraces {
  items: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface TraceFilters {
  requestId?: string;
  status?: "success" | "error";
  model?: string;
  provider?: string;
  minCost?: number;
  minLatency?: number;
  from?: Date;
  to?: Date;
}

/**
 * Storage adapter interface for monitoring data.
 *
 * Required methods:
 * - saveEvent: Persist telemetry events
 * - getStats: Aggregate statistics for dashboard overview
 *
 * Optional methods (dashboard features):
 * - getMetrics: Time-series data for charts
 * - listTraces: Paginated trace list
 * - getEvents: Event details for a specific request
 */
export interface MonitoringStore {
  // Required: Core telemetry
  saveEvent(event: MonitoringEvent): Promise<void>;
  getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats>;

  // Optional: Dashboard features
  getMetrics?(options?: { from?: Date; to?: Date }): Promise<MetricsData>;
  listTraces?(
    options?: { limit?: number; offset?: number } & TraceFilters
  ): Promise<PaginatedTraces>;
  getEvents?(requestId: string): Promise<MonitoringEvent[]>;
}

/**
 * CORS configuration for dashboard API endpoints.
 */
export type CorsConfig =
  | boolean // true = allow all, false = same-origin only
  | string // specific origin
  | string[] // multiple origins
  | { origin: string | string[]; credentials?: boolean };

export interface MonitorOptions {
  store: MonitoringStore;
  /**
   * Whether to capture request/response content (prompts, completions).
   * Default: false (content is not stored)
   */
  captureContent?: boolean;
  /**
   * Content scrubbing configuration.
   * When captureContent is true, this controls how sensitive data is handled.
   */
  scrubbing?: ContentScrubbingOptions;
  onError?: (error: Error, event: MonitoringEvent) => void;
}

/**
 * Configuration for content scrubbing/redaction.
 */
export interface ContentScrubbingOptions {
  /**
   * Enable automatic PII scrubbing (emails, phone numbers, SSN, etc.)
   * Default: true when captureContent is enabled
   */
  pii?: boolean;
  /**
   * Enable API key/secret scrubbing
   * Default: true
   */
  secrets?: boolean;
  /**
   * Custom patterns to scrub (regex patterns)
   */
  customPatterns?: Array<{
    pattern: RegExp;
    replacement?: string;
    name?: string;
  }>;
  /**
   * Fields to completely exclude from capture
   */
  excludeFields?: string[];
  /**
   * Mask characters to use for redaction
   * Default: "***"
   */
  maskWith?: string;
}
