/**
 * Enhanced monitoring metadata types.
 * 
 * These extend the base MonitoringEvent payload with operational metrics
 * that provide deeper observability without affecting execution semantics.
 * 
 * Design principles:
 * - All fields are optional (best-effort)
 * - No PII or business logic
 * - Infrastructure-focused, not eval-focused
 * - Lives in payload, not core schema
 */

/**
 * Request shaping metadata - helps diagnose latency & cost spikes
 */
export interface RequestMetadata {
  /** Size of input payload in bytes */
  requestSizeBytes?: number;
  /** Size of output payload in bytes */
  responseSizeBytes?: number;
  /** Whether this was a streaming request */
  streaming?: boolean;
  /** Template/prompt version identifier (if using templates) */
  promptVersion?: string;
  /** Template ID (if using templates) */
  templateId?: string;
}

/**
 * Retry & resilience metadata - critical for reliability dashboards
 */
export interface RetryMetadata {
  /** Number of retries attempted */
  retryCount?: number;
  /** Reason for retry (timeout, rate_limit, network, etc.) */
  retryReason?: 'timeout' | 'rate_limit' | 'network' | 'server_error' | 'other';
  /** Fallback model used (if routing/fallback is enabled) */
  fallbackModel?: string;
}

/**
 * Advanced timing breakdown - enables SLOs and performance regression detection
 */
export interface TimingMetadata {
  /** Time spent waiting in queue before execution (ms) */
  queueTime?: number;
  /** HTTP round trip time (ms) */
  networkTime?: number;
  /** Model processing time on provider side (ms) */
  providerLatency?: number;
  /** Total time spent in tool calls (ms) */
  toolTimeTotal?: number;
  /** Time to first token (streaming only, ms) */
  timeToFirstToken?: number;
}

/**
 * Tool-call deep monitoring - answers "Is the LLM slow or is my tool slow?"
 */
export interface ToolMetadata {
  /** Name of the tool being called */
  toolName?: string;
  /** Category for grouping (db, http, fs, internal, etc.) */
  toolCategory?: 'db' | 'http' | 'fs' | 'internal' | 'llm' | 'other';
  /** Duration of this specific tool call (ms) */
  toolDuration?: number;
  /** Number of retries for this tool */
  toolRetries?: number;
  /** Whether this tool call timed out */
  toolTimeout?: boolean;
}

/**
 * Routing & decision metadata - for advanced routing/policy systems
 */
export interface RoutingMetadata {
  /** Reason this model was chosen */
  routingDecision?: string;
  /** Policy ID that governed this request */
  policyId?: string;
  /** Remaining budget (if budget tracking is enabled) */
  budgetRemaining?: number;
}

/**
 * Sampling & volume controls - critical at scale
 */
export interface SamplingMetadata {
  /** Sampling rate applied (0.0 to 1.0) */
  samplingRate?: number;
  /** Whether this event was sampled */
  sampled?: boolean;
  /** Reason for sampling decision */
  samplingReason?: 'high_volume' | 'debug' | 'error' | 'random' | 'always';
}

/**
 * Environment & deployment context - essential for multi-service deployments
 */
export interface EnvironmentMetadata {
  /** Service name */
  serviceName?: string;
  /** Service version */
  serviceVersion?: string;
  /** Environment (prod, staging, dev) */
  environment?: 'production' | 'staging' | 'development' | 'test';
  /** Cloud region/zone */
  region?: string;
  /** Availability zone */
  zone?: string;
  /** Node.js version */
  nodeVersion?: string;
}

/**
 * Lightweight security signals - not enforcement, just observability
 */
export interface SecurityMetadata {
  /** Whether request was blocked */
  blocked?: boolean;
  /** Reason for blocking */
  blockReason?: 'policy' | 'tool_denied' | 'rate_limit' | 'content' | 'other';
  /** Whether redaction was applied to content */
  redactionApplied?: boolean;
}

/**
 * Combined enhanced metadata payload.
 * 
 * Usage:
 * ```typescript
 * const payload: EnhancedMonitoringPayload = {
 *   ...basePayload,
 *   request: { streaming: true, requestSizeBytes: 1024 },
 *   timing: { networkTime: 50, providerLatency: 200 },
 *   environment: { environment: 'production', serviceName: 'api' }
 * };
 * ```
 */
export interface EnhancedMonitoringPayload {
  /** Request shaping metadata */
  request?: RequestMetadata;
  /** Retry & resilience metadata */
  retry?: RetryMetadata;
  /** Advanced timing breakdown */
  timing?: TimingMetadata;
  /** Tool-specific metadata */
  tool?: ToolMetadata;
  /** Routing & decision metadata */
  routing?: RoutingMetadata;
  /** Sampling & volume control */
  sampling?: SamplingMetadata;
  /** Environment & deployment context */
  environment?: EnvironmentMetadata;
  /** Security signals */
  security?: SecurityMetadata;
  
  /** Original payload fields (messages, options, etc.) */
  [key: string]: any;
}

/**
 * Helper to create enhanced payload with type safety
 */
export function createEnhancedPayload(
  base: Record<string, any>,
  metadata: Partial<EnhancedMonitoringPayload>
): EnhancedMonitoringPayload {
  return {
    ...base,
    ...metadata
  };
}
