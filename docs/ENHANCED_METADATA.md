# Enhanced Monitoring Metadata

**Status**: ✅ Production Ready  
**Version**: Added in v1.1.0  
**Philosophy**: Infrastructure-first observability without execution semantics

---

## Overview

Enhanced metadata extends NodeLLM Monitor's observability capabilities with **operational metrics** that help diagnose performance, reliability, and cost issues **without changing execution behavior**.

### Design Principles

✅ **Optional** - All fields are best-effort, never required  
✅ **Non-invasive** - Lives in `payload`, not core schema  
✅ **Infrastructure-focused** - No eval metrics, no business KPIs  
✅ **No PII** - Only operational data, never user content  

---

## Quick Start

```typescript
import { Monitor } from '@node-llm/monitor';

const monitor = new Monitor({ store });

// Enrich payload with operational metadata
const payload = monitor.enrichWithRequestMetadata(
  { messages: [...] },
  {
    streaming: true,
    requestSizeBytes: 1024,
    responseSizeBytes: 4096
  }
);
```

---

## Metadata Categories

### 1. Request Shaping (`enrichWithRequestMetadata`)

**Purpose**: Diagnose latency & cost spikes

```typescript
monitor.enrichWithRequestMetadata(payload, {
  streaming: true,              // Streaming vs non-streaming
  requestSizeBytes: 1024,        // Input payload size
  responseSizeBytes: 4096,       // Output payload size
  promptVersion: 'v2.1.0',       // Template version
  templateId: 'analysis-prompt'  // Template identifier
});
```

**Use Cases**:
- Correlate response time with payload size
- Track streaming vs non-streaming performance
- Version control for prompt templates
- Cost analysis by request size

---

### 2. Retry & Resilience (`enrichWithRetry`)

**Purpose**: Reliability dashboards & provider comparisons

```typescript
monitor.enrichWithRetry(payload, {
  retryCount: 3,                 // Number of retries
  retryReason: 'rate_limit',     // Why retry occurred
  fallbackModel: 'gpt-3.5-turbo' // Fallback used (if any)
});
```

**Retry Reasons**:
- `timeout` - Request timed out
- `rate_limit` - Provider rate limit hit
- `network` - Network error
- `server_error` - 5xx from provider
- `other` - Other retry reason

**Use Cases**:
- Identify flaky providers
- Optimize retry strategies
- Track fallback model usage
- SLA monitoring

---

### 3. Timing Breakdown (`enrichWithTiming`)

**Purpose**: SLOs, performance regressions, infra vs model blame

```typescript
monitor.enrichWithTiming(payload, {
  queueTime: 5,           // Waiting before execution (ms)
  networkTime: 45,        // HTTP round trip (ms)
  providerLatency: 850,   // Model processing time (ms)
  toolTimeTotal: 200,     // Sum of tool calls (ms)
  timeToFirstToken: 150   // Streaming: time to first token (ms)
});
```

**Use Cases**:
- Separate network latency from model latency
- Identify queueing issues
- Optimize tool call performance
- Track streaming responsiveness

**Example Analysis**:
```
Total Duration: 1100ms
├── Queue Time: 5ms (0.5%)
├── Network Time: 45ms (4%)
├── Provider Latency: 850ms (77%)
└── Tool Time: 200ms (18%)

Diagnosis: Provider is the bottleneck, not tools
```

---

### 4. Environment Context (`enrichWithEnvironment`)

**Purpose**: Multi-service deployments, release comparisons

```typescript
monitor.enrichWithEnvironment(payload, {
  serviceName: 'analytics-api',
  serviceVersion: '3.2.1',
  environment: 'production',
  region: 'us-east-1'
  // nodeVersion added automatically
});
```

**Environments**:
- `production`
- `staging`
- `development`
- `test`

**Use Cases**:
- Compare performance across services
- Track regressions between releases
- Regional performance analysis
- Node.js version impact

---

### 5. Sampling Control (`enrichWithSampling`)

**Purpose**: Volume control at scale

```typescript
monitor.enrichWithSampling(payload, {
  samplingRate: 0.1,           // 10% sampling
  sampled: true,               // Was this request sampled?
  samplingReason: 'random'     // Why was it sampled?
});
```

**Sampling Reasons**:
- `high_volume` - Reduce load during traffic spikes
- `debug` - Always sample for debugging
- `error` - Always sample errors
- `random` - Random sampling
- `always` - No sampling (100%)

**Use Cases**:
- Keep monitoring costs under control
- Selectively enable deep monitoring
- Debug production issues without full capture

**Example**:
```typescript
// Sample 10% of normal requests, 100% of errors
const shouldSample = isError || Math.random() < 0.1;

if (shouldSample) {
  const payload = monitor.enrichWithSampling({}, {
    samplingRate: isError ? 1.0 : 0.1,
    sampled: true,
    samplingReason: isError ? 'error' : 'random'
  });
}
```

---

## Advanced Usage

### Chaining Multiple Enrichments

```typescript
let payload: any = { messages: [...] };

// Add request metadata
payload = monitor.enrichWithRequestMetadata(payload, {
  streaming: true,
  requestSizeBytes: 1024
});

// Add timing
payload = monitor.enrichWithTiming(payload, {
  networkTime: 50,
  providerLatency: 200
});

// Add environment
payload = monitor.enrichWithEnvironment(payload, {
  environment: 'production',
  serviceName: 'api'
});

// All metadata preserved
console.log(payload.request);     // { streaming: true, ... }
console.log(payload.timing);      // { networkTime: 50, ... }
console.log(payload.environment); // { environment: 'production', ... }
```

---

## Real-World Scenarios

### Scenario 1: Diagnosing Slow Requests

```typescript
// Capture timing breakdown
const payload = monitor.enrichWithTiming({}, {
  queueTime: 5,
  networkTime: 45,
  providerLatency: 850,
  toolTimeTotal: 200
});

// Dashboard query:
// SELECT AVG(payload->>'timing'->>'providerLatency') 
// FROM monitoring_events 
// WHERE eventType = 'request.end'
// GROUP BY provider, model

// Result: Identify which provider/model is slowest
```

---

### Scenario 2: Tracking Retry Impact

```typescript
// Capture retry metadata
const payload = monitor.enrichWithRetry({}, {
  retryCount: 3,
  retryReason: 'rate_limit'
});

// Dashboard query:
// SELECT provider, 
//        COUNT(*) as total,
//        AVG(payload->>'retry'->>'retryCount') as avg_retries
// FROM monitoring_events
// WHERE payload->>'retry' IS NOT NULL
// GROUP BY provider

// Result: Which provider needs rate limit increases?
```

---

### Scenario 3: Cost Analysis by Request Size

```typescript
// Capture request size
const payload = monitor.enrichWithRequestMetadata({}, {
  requestSizeBytes: JSON.stringify(messages).length,
  responseSizeBytes: response.length
});

// Dashboard query:
// SELECT 
//   FLOOR(payload->>'request'->>'requestSizeBytes' / 1000) as size_kb,
//   AVG(cost) as avg_cost,
//   COUNT(*) as count
// FROM monitoring_events
// WHERE eventType = 'request.end'
// GROUP BY size_kb
// ORDER BY size_kb

// Result: Cost scales linearly with size? Or exponentially?
```

---

### Scenario 4: A/B Testing Prompt Versions

```typescript
// Version A
const payloadA = monitor.enrichWithRequestMetadata({}, {
  promptVersion: 'v1.0.0',
  templateId: 'analysis-prompt'
});

// Version B
const payloadB = monitor.enrichWithRequestMetadata({}, {
  promptVersion: 'v2.0.0',
  templateId: 'analysis-prompt'
});

// Dashboard query:
// SELECT 
//   payload->>'request'->>'promptVersion' as version,
//   AVG(duration) as avg_duration,
//   AVG(cost) as avg_cost
// FROM monitoring_events
// WHERE payload->>'request'->>'templateId' = 'analysis-prompt'
// GROUP BY version

// Result: Which prompt version is faster/cheaper?
```

---

## What NOT to Include

Following infrastructure-first principles, **do not add**:

❌ **Semantic correctness** - "Was the answer right?"  
❌ **Hallucination scores** - "Did the model hallucinate?"  
❌ **Cosine similarity** - "How similar to expected?"  
❌ **Eval judgments** - "Quality rating: 8/10"  
❌ **User identity** - "user_id: 12345"  
❌ **Business KPIs** - "conversion_rate: 0.15"  

**Why?** These belong in:
- **Eval systems** (correctness, quality)
- **Product analytics** (business metrics)
- **User databases** (identity)

Monitoring is for **operational health**, not **business outcomes**.

---

## TypeScript Types

All metadata types are fully typed:

```typescript
import type {
  RequestMetadata,
  RetryMetadata,
  TimingMetadata,
  EnvironmentMetadata,
  SamplingMetadata,
  EnhancedMonitoringPayload
} from '@node-llm/monitor';

// Type-safe enrichment
const payload: EnhancedMonitoringPayload = {
  request: {
    streaming: true,
    requestSizeBytes: 1024
  },
  timing: {
    networkTime: 50,
    providerLatency: 200
  },
  environment: {
    environment: 'production',
    serviceName: 'api'
  }
};
```

---

## Dashboard Queries

### PostgreSQL Examples

```sql
-- Average latency by provider
SELECT 
  provider,
  model,
  AVG((payload->>'timing'->>'providerLatency')::int) as avg_latency_ms
FROM monitoring_events
WHERE payload->>'timing' IS NOT NULL
GROUP BY provider, model
ORDER BY avg_latency_ms DESC;

-- Retry rate by provider
SELECT 
  provider,
  COUNT(*) FILTER (WHERE payload->>'retry' IS NOT NULL) * 100.0 / COUNT(*) as retry_rate
FROM monitoring_events
WHERE event_type = 'request.end' OR event_type = 'request.error'
GROUP BY provider;

-- Cost by environment
SELECT 
  payload->>'environment'->>'environment' as env,
  SUM(cost) as total_cost,
  COUNT(*) as requests
FROM monitoring_events
WHERE event_type = 'request.end'
GROUP BY env;
```

---

## Migration Guide

### From Basic Monitoring

**Before**:
```typescript
await monitor.onRequest(ctx);
await monitor.onResponse(ctx, result);
```

**After** (optional enhancement):
```typescript
// Add metadata without changing execution
const enrichedPayload = monitor.enrichWithEnvironment({}, {
  environment: 'production',
  serviceName: 'api'
});

await monitor.onRequest(ctx);
await monitor.onResponse(ctx, result);
```

**No breaking changes** - All metadata is optional!

---

## Performance Impact

**Storage**: ~100-500 bytes per event (JSON in `payload` column)  
**CPU**: Negligible (<1ms per enrichment)  
**Network**: No additional requests  

**Recommendation**: Use sampling for high-volume services (>1000 req/s)

---

## Best Practices

### 1. Start Small
```typescript
// Begin with top 3 most valuable metrics
payload = monitor.enrichWithEnvironment(payload, {
  environment: process.env.NODE_ENV,
  serviceName: 'api'
});

payload = monitor.enrichWithRetry(payload, {
  retryCount: retries
});

payload = monitor.enrichWithSampling(payload, {
  samplingRate: 0.1
});
```

### 2. Use Sampling in Production
```typescript
const samplingRate = process.env.NODE_ENV === 'production' ? 0.1 : 1.0;

if (Math.random() < samplingRate) {
  payload = monitor.enrichWithSampling(payload, {
    samplingRate,
    sampled: true,
    samplingReason: 'random'
  });
}
```

### 3. Always Sample Errors
```typescript
const isError = result instanceof Error;
const shouldSample = isError || Math.random() < 0.1;

if (shouldSample) {
  payload = monitor.enrichWithSampling(payload, {
    samplingRate: isError ? 1.0 : 0.1,
    sampled: true,
    samplingReason: isError ? 'error' : 'random'
  });
}
```

### 4. Measure What Matters
Focus on metrics that answer specific questions:
- "Why is this slow?" → Timing breakdown
- "Why so many retries?" → Retry metadata
- "Which version is better?" → Prompt versioning
- "Is this a production issue?" → Environment context

---

## Examples

See [`example-enhanced-metadata.ts`](../example-enhanced-metadata.ts) for comprehensive examples.

---

## Summary

Enhanced metadata provides **infrastructure-grade observability** without:
- ❌ Changing execution semantics
- ❌ Adding eval logic
- ❌ Requiring schema migrations
- ❌ Capturing PII

It enables:
- ✅ Performance debugging
- ✅ Reliability dashboards
- ✅ Cost optimization
- ✅ A/B testing
- ✅ SLA monitoring

**Philosophy**: Measure operations, not outcomes.
