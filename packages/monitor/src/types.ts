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
  sessionId?: string | undefined;
  transactionId?: string | undefined;
  time: Date;
  duration?: number | undefined;
  cost?: number | undefined;
  cpuTime?: number | undefined;
  gcTime?: number | undefined;
  allocations?: number | undefined;
  correctionRounds?: number | undefined;
  /**
   * Plain labels for filtering, such as { project: "Checkout", env: "staging" }. Set with the
   * Monitor's `tags` option, or per call with `monitorTags`. Never put prompts or secrets here.
   */
  tags?: Record<string, string> | undefined;
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
  // Token analytics
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgTokensPerRequest: number;
  totalSelfCorrections?: number;
}

export interface ProviderStats {
  provider: string;
  model: string;
  requests: number;
  cost: number;
  avgDuration: number;
  errorCount: number;
  // Token analytics
  promptTokens: number;
  completionTokens: number;
  costPer1kTokens: number;
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
    // Token analytics
    promptTokens: TimeSeriesPoint[];
    completionTokens: TimeSeriesPoint[];
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
  // Token analytics
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  cacheCreationTokens?: number;
  reasoningTokens?: number;
  imageTokens?: number;
  correctionRounds?: number;
  tags?: Record<string, string>;
}

export interface PaginatedTraces {
  items: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface TraceFilters {
  requestId?: string;
  query?: string;
  status?: "success" | "error";
  model?: string;
  provider?: string;
  minCost?: number;
  minLatency?: number;
  from?: Date;
  to?: Date;
  /** Only calls carrying every one of these tags */
  tags?: Record<string, string>;
}

/** The time range and tags that stats and metrics cover. */
export interface StatsFilters {
  from?: Date;
  to?: Date;
  tags?: Record<string, string>;
}

/** Each tag key with the values seen, for building filters. */
export type TagValues = Record<string, string[]>;

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
  getStats(options?: StatsFilters): Promise<MonitoringStats>;

  // Optional: Dashboard features
  getMetrics?(options?: StatsFilters): Promise<MetricsData>;
  /** The tag keys and values in a time range, so the dashboard can offer them as filters. */
  listTags?(options?: { from?: Date; to?: Date }): Promise<TagValues>;
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
   * Tags added to every call this Monitor records, such as { service: "billing" }. A call's own
   * `monitorTags` option adds to them and wins on the same key.
   */
  tags?: Record<string, string>;
  /**
   * Content scrubbing configuration.
   * When captureContent is true, this controls how sensitive data is handled.
   */
  scrubbing?: ContentScrubbingOptions;
  /**
   * Whether to collect per-request CPU time and heap allocation metrics.
   * Collecting them calls process.memoryUsage() twice per request, which is
   * a comparatively slow syscall on some platforms. Set to false to skip
   * resource metrics on latency-sensitive paths. Default: true.
   */
  resourceMetrics?: boolean;
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
