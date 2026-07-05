import type { MonitoringEvent, MonitoringStats, TraceFilters, TraceSummary } from "../types.js";
import { extractTokenUsage, type ExtractedTokenUsage } from "./tokenExtraction.js";

/**
 * Predicate function type for filtering events.
 */
type FilterPredicate = (event: MonitoringEvent) => boolean;

/**
 * Memoizes extraction per event object: stats, provider stats, and time-series
 * aggregation all need the same counts, and the in-memory adapters reuse the
 * same event objects across queries. WeakMap keys don't keep evicted events alive.
 */
const tokenCache = new WeakMap<MonitoringEvent, ExtractedTokenUsage>();

/**
 * Extract token counts from an event's payload. Handles multiple naming
 * conventions from different providers/SDKs (see tokenExtraction.ts).
 */
export function extractTokens(event: MonitoringEvent): ExtractedTokenUsage {
  let tokens = tokenCache.get(event);
  if (!tokens) {
    tokens = extractTokenUsage(event.payload);
    tokenCache.set(event, tokens);
  }
  return tokens;
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
 * Timestamps are computed once per event rather than in the comparator.
 */
export function sortByTimeDesc(events: MonitoringEvent[]): MonitoringEvent[] {
  return events
    .map((event) => ({ event, timestamp: new Date(event.time).getTime() }))
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ event }) => event);
}

/**
 * Computes aggregate stats over events in a single pass.
 * Shared by the in-memory adapters (MemoryAdapter, FileAdapter).
 */
export function computeStats(
  events: MonitoringEvent[],
  options?: { from?: Date; to?: Date }
): MonitoringStats {
  const fromTime = options?.from?.getTime();
  const toTime = options?.to?.getTime();

  let endCount = 0;
  let errorCount = 0;
  let totalCost = 0;
  let totalDuration = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalSelfCorrections = 0;

  for (const event of events) {
    if (event.eventType !== "request.end" && event.eventType !== "request.error") continue;

    if (fromTime !== undefined || toTime !== undefined) {
      const time = new Date(event.time).getTime();
      if (fromTime !== undefined && time < fromTime) continue;
      if (toTime !== undefined && time > toTime) continue;
    }

    if (event.eventType === "request.error") {
      errorCount++;
      continue;
    }

    endCount++;
    totalCost += event.cost || 0;
    totalDuration += event.duration || 0;
    const tokens = extractTokens(event);
    totalPromptTokens += tokens.prompt;
    totalCompletionTokens += tokens.completion;
    if ((event.correctionRounds ?? 0) > 0) totalSelfCorrections++;
  }

  const totalRequests = endCount + errorCount;
  const totalTokens = totalPromptTokens + totalCompletionTokens;

  return {
    totalRequests,
    totalCost,
    avgDuration: endCount > 0 ? totalDuration / endCount : 0,
    errorRate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
    totalPromptTokens,
    totalCompletionTokens,
    avgTokensPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
    totalSelfCorrections
  };
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
  if (tokens.cached > 0) summary.cachedTokens = tokens.cached;
  if (tokens.cacheCreation > 0) summary.cacheCreationTokens = tokens.cacheCreation;
  if (tokens.reasoning > 0) summary.reasoningTokens = tokens.reasoning;
  if (tokens.image > 0) summary.imageTokens = tokens.image;
  if (event.correctionRounds !== undefined) summary.correctionRounds = event.correctionRounds;

  return summary;
}
