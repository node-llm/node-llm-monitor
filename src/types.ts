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

export interface MonitoringStore {
  saveEvent(event: MonitoringEvent): Promise<void>;
  getEvents(requestId: string): Promise<MonitoringEvent[]>;
  getStats(options?: { from?: Date; to?: Date }): Promise<MonitoringStats>;
  listTraces(options?: { limit?: number; offset?: number }): Promise<PaginatedTraces>;
}

export interface MonitorOptions {
  store: MonitoringStore;
  captureContent?: boolean;
  onError?: (error: Error, event: MonitoringEvent) => void;
}
