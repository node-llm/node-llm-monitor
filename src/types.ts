export type EventType = 
  | "request_start"
  | "request_end"
  | "request_error"
  | "tool_start"
  | "tool_end"
  | "tool_error";

export interface MonitoringEvent {
  id: string;
  requestId: string;
  timestamp: Date;
  eventType: EventType;
  provider: string;
  model: string;
  payload?: Record<string, any>;
}

export interface MonitoringStore {
  saveEvent(event: MonitoringEvent): Promise<void>;
  getEvents(requestId: string): Promise<MonitoringEvent[]>;
}

export interface MonitorOptions {
  store: MonitoringStore;
  /**
   * If true, captures the full prompt and response content in the event payload.
   * Defaults to false for privacy compliance.
   */
  captureContent?: boolean;
}
