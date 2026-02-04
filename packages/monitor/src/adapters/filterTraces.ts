import type { MonitoringEvent, TraceFilters, TraceSummary } from "../types.js";

/**
 * Predicate function type for filtering events.
 */
type FilterPredicate = (event: MonitoringEvent) => boolean;

/**
 * Extract token counts from event payload.
 */
export function extractTokens(event: MonitoringEvent): { prompt: number; completion: number } {
  const payload = event.payload || {};

  // Check usage object (most common)
  if (payload.usage) {
    return {
      // Support multiple naming conventions:
      // - Vercel AI SDK: promptTokens/completionTokens
      // - OpenAI snake_case: prompt_tokens/completion_tokens
      // - Anthropic/industry: input_tokens/output_tokens
      prompt:
        payload.usage.promptTokens ||
        payload.usage.prompt_tokens ||
        payload.usage.input_tokens ||
        0,
      completion:
        payload.usage.completionTokens ||
        payload.usage.completion_tokens ||
        payload.usage.output_tokens ||
        0
    };
  }

  // Direct fields (some providers)
  return {
    prompt: payload.promptTokens || payload.prompt_tokens || payload.input_tokens || 0,
    completion: payload.completionTokens || payload.completion_tokens || payload.output_tokens || 0
  };
}

/**
 * Creates an array of filter predicates based on provided options.
 * This approach avoids deeply nested if statements and makes the filtering logic
 * more composable and testable.
 */
function buildFilterPredicates(options: TraceFilters): FilterPredicate[] {
  const predicates: FilterPredicate[] = [];

  // Text search filters - case-insensitive partial matching
  if (options.requestId) {
    const searchTerm = options.requestId.toLowerCase();
    predicates.push((e) => e.requestId.toLowerCase().includes(searchTerm));
  }

  if (options.query) {
    const searchTerm = options.query.toLowerCase();
    predicates.push(
      (e) =>
        e.requestId.toLowerCase().includes(searchTerm) ||
        e.model.toLowerCase().includes(searchTerm) ||
        e.provider.toLowerCase().includes(searchTerm)
    );
  }

  if (options.model) {
    const searchTerm = options.model.toLowerCase();
    predicates.push((e) => e.model.toLowerCase().includes(searchTerm));
  }

  if (options.provider) {
    const searchTerm = options.provider.toLowerCase();
    predicates.push((e) => e.provider.toLowerCase().includes(searchTerm));
  }

  // Numeric threshold filters
  if (options.minCost !== undefined) {
    const threshold = options.minCost;
    predicates.push((e) => (e.cost || 0) >= threshold);
  }

  if (options.minLatency !== undefined) {
    const threshold = options.minLatency;
    predicates.push((e) => (e.duration || 0) >= threshold);
  }

  // Status filter
  if (options.status) {
    const eventType = options.status.toLowerCase() === "success" ? "request.end" : "request.error";
    predicates.push((e) => e.eventType === eventType);
  }

  // Date range filters
  if (options.from) {
    const fromTime = options.from.getTime();
    predicates.push((e) => new Date(e.time).getTime() >= fromTime);
  }

  if (options.to) {
    const toTime = options.to.getTime();
    predicates.push((e) => new Date(e.time).getTime() <= toTime);
  }

  return predicates;
}

/**
 * Filters monitoring events based on the provided trace filters.
 * Only includes terminal events (request.end or request.error).
 *
 * @param events - Array of monitoring events to filter
 * @param options - Filter criteria
 * @returns Filtered array of events
 */
export function filterTraces(
  events: MonitoringEvent[],
  options: TraceFilters = {}
): MonitoringEvent[] {
  // Start with terminal events only
  const terminalEvents = events.filter(
    (e) => e.eventType === "request.end" || e.eventType === "request.error"
  );

  const predicates = buildFilterPredicates(options);

  // No filters applied, return all terminal events
  if (predicates.length === 0) {
    return terminalEvents;
  }

  // Apply all predicates (AND logic)
  return terminalEvents.filter((event) => predicates.every((predicate) => predicate(event)));
}

/**
 * Sorts events by time in descending order (most recent first).
 */
export function sortByTimeDesc(events: MonitoringEvent[]): MonitoringEvent[] {
  return [...events].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

/**
 * Paginates an array of items.
 */
export function paginate<T>(items: T[], limit: number, offset: number): T[] {
  return items.slice(offset, offset + limit);
}

/**
 * Converts a monitoring event to a trace summary.
 */
export function eventToTraceSummary(event: MonitoringEvent): TraceSummary {
  const tokens = extractTokens(event);
  const summary: TraceSummary = {
    requestId: event.requestId,
    provider: event.provider,
    model: event.model,
    startTime: new Date(new Date(event.time).getTime() - (event.duration || 0)),
    status: event.eventType === "request.end" ? "success" : "error"
  };

  // Only set optional properties if they have values
  if (event.time !== undefined) summary.endTime = event.time;
  if (event.duration !== undefined) summary.duration = event.duration;
  if (event.cost !== undefined) summary.cost = event.cost;
  if (event.cpuTime !== undefined) summary.cpuTime = event.cpuTime;
  if (event.allocations !== undefined) summary.allocations = event.allocations;
  if (tokens.prompt > 0) summary.promptTokens = tokens.prompt;
  if (tokens.completion > 0) summary.completionTokens = tokens.completion;

  return summary;
}
