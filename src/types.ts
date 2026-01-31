export type EventType = 
  | "request_start"
  | "request_end"
  | "request_error"
  | "tool_start"
  | "tool_end"
  | "tool_error";

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
  // Core metadata for indexing/filtering
  provider: string;
  model: string;
}

export interface MonitoringStats {
  totalRequests: number;
  totalCost: number;
  avgDuration: number;
  errorRate: number;
}

export interface TraceSummary {
  requestId: string;
  provider: string;
  model: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  cost?: number;
  status: "success" | "error" | "running";
}

export interface MonitoringStore {
  saveEvent(event: MonitoringEvent): Promise<void>;
  getEvents(requestId: string): Promise<MonitoringEvent[]>;
  getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats>;
  listTraces(options?: { limit?: number; offset?: number }): Promise<TraceSummary[]>;
}

export interface MonitorOptions {
  store: MonitoringStore;
  /**
   * If true, captures the full prompt and response content in the event payload.
   * Defaults to false for privacy compliance.
   */
  captureContent?: boolean;
}
