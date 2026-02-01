import type { MonitoringEvent, MetricsData, ProviderStats } from "../types.js";

interface BucketData {
  requests: number;
  cost: number;
  duration: number;
  errors: number;
  count: number;
}

interface ProviderStatsInternal extends ProviderStats {
  _totalDuration: number;
}

export class TimeSeriesBuilder {
  constructor(private readonly bucketSizeMs: number = 5 * 60 * 1000) {}

  build(events: MonitoringEvent[]): MetricsData["timeSeries"] {
    const buckets = new Map<number, BucketData>();

    for (const event of events) {
      if (
        event.eventType === "request.end" ||
        event.eventType === "request.error"
      ) {
        const bucket = this.getBucket(event.time);
        const data = buckets.get(bucket) || this.emptyBucket();

        data.requests++;
        data.cost += event.cost || 0;
        data.duration += event.duration || 0;
        data.count++;
        if (event.eventType === "request.error") data.errors++;

        buckets.set(bucket, data);
      }
    }

    return this.toTimeSeries(buckets);
  }

  buildProviderStats(events: MonitoringEvent[]): ProviderStats[] {
    const providerMap = new Map<string, ProviderStatsInternal>();

    for (const event of events) {
      if (
        event.eventType === "request.end" ||
        event.eventType === "request.error"
      ) {
        const key = `${event.provider}/${event.model}`;
        const existing = providerMap.get(key) || {
          provider: event.provider,
          model: event.model,
          requests: 0,
          cost: 0,
          avgDuration: 0,
          errorCount: 0,
          _totalDuration: 0,
        };

        existing.requests++;
        existing.cost += event.cost || 0;
        existing._totalDuration += event.duration || 0;
        if (event.eventType === "request.error") existing.errorCount++;
        existing.avgDuration = existing._totalDuration / existing.requests;

        providerMap.set(key, existing);
      }
    }

    return Array.from(providerMap.values()).map(
      ({ _totalDuration, ...stats }) => stats
    );
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
    };
  }

  private toTimeSeries(
    buckets: Map<number, BucketData>
  ): MetricsData["timeSeries"] {
    const sortedBuckets = Array.from(buckets.entries()).sort(
      (a, b) => a[0] - b[0]
    );

    return {
      requests: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.requests,
      })),
      cost: sortedBuckets.map(([ts, d]) => ({ timestamp: ts, value: d.cost })),
      duration: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.count > 0 ? d.duration / d.count : 0,
      })),
      errors: sortedBuckets.map(([ts, d]) => ({
        timestamp: ts,
        value: d.errors,
      })),
    };
  }
}
