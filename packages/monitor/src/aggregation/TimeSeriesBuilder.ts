import type { MonitoringEvent, MetricsData, ProviderStats } from "../types.js";

/**
 * Extract token counts from event payload.
 * Handles multiple naming conventions from different providers.
 */
function extractTokens(event: MonitoringEvent): { prompt: number; completion: number } {
  const payload = event.payload || {};

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

interface BucketData {
  requests: number;
  cost: number;
  duration: number;
  errors: number;
  count: number;
  promptTokens: number;
  completionTokens: number;
}

interface ProviderStatsInternal extends Omit<ProviderStats, "costPer1kTokens"> {
  _totalDuration: number;
  _totalTokens: number;
}

export class TimeSeriesBuilder {
  constructor(private readonly bucketSizeMs: number = 5 * 60 * 1000) {}

  build(events: MonitoringEvent[]): MetricsData["timeSeries"] {
    const buckets = new Map<number, BucketData>();

    for (const event of events) {
      if (event.eventType === "request.end" || event.eventType === "request.error") {
        const bucket = this.getBucket(event.time);
        const data = buckets.get(bucket) || this.emptyBucket();
        const tokens = extractTokens(event);

        data.requests++;
        data.cost += event.cost || 0;
        data.duration += event.duration || 0;
        data.count++;
        data.promptTokens += tokens.prompt;
        data.completionTokens += tokens.completion;
        if (event.eventType === "request.error") data.errors++;

        buckets.set(bucket, data);
      }
    }

    return this.toTimeSeries(buckets);
  }

  buildProviderStats(events: MonitoringEvent[]): ProviderStats[] {
    const providerMap = new Map<string, ProviderStatsInternal>();

    for (const event of events) {
      if (event.eventType === "request.end" || event.eventType === "request.error") {
        const key = `${event.provider}/${event.model}`;
        const tokens = extractTokens(event);
        const existing = providerMap.get(key) || {
          provider: event.provider,
          model: event.model,
          requests: 0,
          cost: 0,
          avgDuration: 0,
          errorCount: 0,
          promptTokens: 0,
          completionTokens: 0,
          _totalDuration: 0,
          _totalTokens: 0
        };

        existing.requests++;
        existing.cost += event.cost || 0;
        existing._totalDuration += event.duration || 0;
        existing.promptTokens += tokens.prompt;
        existing.completionTokens += tokens.completion;
        existing._totalTokens += tokens.prompt + tokens.completion;
        if (event.eventType === "request.error") existing.errorCount++;
        existing.avgDuration = existing._totalDuration / existing.requests;

        providerMap.set(key, existing);
      }
    }

    return Array.from(providerMap.values()).map(({ _totalDuration, _totalTokens, ...stats }) => ({
      ...stats,
      costPer1kTokens: _totalTokens > 0 ? (stats.cost / _totalTokens) * 1000 : 0
    }));
  }

  private getBucket(time: Date | string): number {
    const timestamp = typeof time === "string" ? new Date(time).getTime() : time.getTime();
    return Math.floor(timestamp / this.bucketSizeMs) * this.bucketSizeMs;
  }

  private emptyBucket(): BucketData {
    return {
      requests: 0,
      cost: 0,
      duration: 0,
      errors: 0,
      count: 0,
      promptTokens: 0,
      completionTokens: 0
    };
  }

  private toTimeSeries(buckets: Map<number, BucketData>): MetricsData["timeSeries"] {
    const sortedBuckets = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);

    return {
      requests: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.requests
      })),
      cost: sortedBuckets.map(([ts, d]) => ({ timestamp: ts, value: d.cost })),
      duration: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.count > 0 ? d.duration / d.count : 0
      })),
      errors: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.errors
      })),
      promptTokens: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.promptTokens
      })),
      completionTokens: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.completionTokens
      }))
    };
  }
}
