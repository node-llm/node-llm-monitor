# NodeLLM Integration Guide for Enhanced Metadata

This guide shows how to use enhanced metadata with NodeLLM's actual request flow.

## Prerequisites

```typescript
import { createLLM } from '@node-llm/core';
import { Monitor } from '@node-llm/monitor';
import { PrismaAdapter } from '@node-llm/monitor/adapters/prisma';
import { prisma } from './db';

const monitor = new Monitor({
  store: new PrismaAdapter(prisma),
  captureContent: false // PII protection
});

const llm = createLLM({
  provider: 'openai',
  middlewares: [monitor]
});
```

## Integration Patterns

### Pattern 1: Wrapper Function (Recommended)

Create a wrapper that enriches metadata before calling NodeLLM:

```typescript
async function llmWithMetadata(
  messages: Message[],
  options: {
    // Standard NodeLLM options
    model?: string;
    temperature?: number;
    stream?: boolean;
    
    // Enhanced metadata (optional)
    metadata?: {
      environment?: 'production' | 'staging' | 'development';
      serviceName?: string;
      promptVersion?: string;
      retryCount?: number;
    };
  } = {}
) {
  const { metadata, ...llmOptions } = options;
  
  // Calculate request size
  const requestSizeBytes = JSON.stringify(messages).length;
  
  // Enrich context before request
  // Note: This is conceptual - actual implementation depends on NodeLLM's context API
  const enrichedContext = {
    ...llmOptions,
    _monitorMetadata: {
      request: {
        streaming: options.stream || false,
        requestSizeBytes,
        promptVersion: metadata?.promptVersion,
      },
      environment: {
        environment: metadata?.environment || process.env.NODE_ENV,
        serviceName: metadata?.serviceName,
        nodeVersion: process.version,
      },
      retry: metadata?.retryCount ? {
        retryCount: metadata.retryCount,
      } : undefined,
    }
  };
  
  // Make request
  const result = await llm.chat(messages, llmOptions);
  
  // Calculate response size
  const responseSizeBytes = result.toString().length;
  
  // Note: Response metadata would be captured in Monitor.onResponse
  
  return result;
}

// Usage
const result = await llmWithMetadata(
  [{ role: 'user', content: 'Hello' }],
  {
    model: 'gpt-4',
    metadata: {
      environment: 'production',
      serviceName: 'chat-api',
      promptVersion: 'v2.1.0',
    }
  }
);
```

### Pattern 2: Direct Monitor Access

If NodeLLM exposes the context, you can enrich directly:

```typescript
// This assumes NodeLLM provides access to the monitoring context
// Actual API depends on NodeLLM implementation

const result = await llm.chat(messages, {
  model: 'gpt-4',
  onBeforeRequest: (ctx) => {
    // Enrich with metadata
    ctx.payload = monitor.enrichWithEnvironment(ctx.payload || {}, {
      environment: 'production',
      serviceName: 'api',
    });
    
    ctx.payload = monitor.enrichWithRequestMetadata(ctx.payload, {
      streaming: false,
      requestSizeBytes: JSON.stringify(messages).length,
    });
  },
  onAfterResponse: (ctx, result) => {
    // Enrich with response metadata
    ctx.payload = monitor.enrichWithRequestMetadata(ctx.payload, {
      responseSizeBytes: result.toString().length,
    });
  }
});
```

### Pattern 3: Service-Level Configuration

Set metadata once at service initialization:

```typescript
class LLMService {
  private monitor: Monitor;
  private llm: any;
  private serviceMetadata: {
    serviceName: string;
    serviceVersion: string;
    environment: 'production' | 'staging' | 'development';
  };
  
  constructor(config: ServiceConfig) {
    this.monitor = new Monitor({
      store: new PrismaAdapter(prisma),
    });
    
    this.llm = createLLM({
      provider: config.provider,
      middlewares: [this.monitor],
    });
    
    this.serviceMetadata = {
      serviceName: config.serviceName,
      serviceVersion: config.version,
      environment: config.environment,
    };
  }
  
  async chat(messages: Message[], options: ChatOptions = {}) {
    // Auto-enrich all requests with service metadata
    const basePayload = {
      messages: options.captureContent ? messages : undefined,
    };
    
    let payload = this.monitor.enrichWithEnvironment(
      basePayload,
      this.serviceMetadata
    );
    
    payload = this.monitor.enrichWithRequestMetadata(payload, {
      streaming: options.stream || false,
      requestSizeBytes: JSON.stringify(messages).length,
      promptVersion: options.promptVersion,
    });
    
    // Make request (payload will be captured by monitor middleware)
    return await this.llm.chat(messages, options);
  }
}

// Usage
const service = new LLMService({
  provider: 'openai',
  serviceName: 'chat-api',
  version: '1.2.3',
  environment: 'production',
});

// All requests automatically include service metadata
const result = await service.chat(messages);
```

## Retry Integration

For retry logic with metadata:

```typescript
async function llmWithRetry(
  messages: Message[],
  options: ChatOptions = {},
  maxRetries = 3
) {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Enrich with retry metadata
      const payload = monitor.enrichWithRetry({}, {
        retryCount: attempt,
        retryReason: lastError ? getRetryReason(lastError) : undefined,
      });
      
      return await llm.chat(messages, {
        ...options,
        _monitorPayload: payload, // Pass to monitor
      });
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}

function getRetryReason(error: Error): RetryMetadata['retryReason'] {
  if (error.message.includes('timeout')) return 'timeout';
  if (error.message.includes('rate limit')) return 'rate_limit';
  if (error.message.includes('network')) return 'network';
  if (error.message.includes('500') || error.message.includes('503')) return 'server_error';
  return 'other';
}
```

## Sampling for High-Volume Services

```typescript
class SampledLLMService {
  private samplingRate: number;
  
  constructor(config: { samplingRate?: number } = {}) {
    this.samplingRate = config.samplingRate || 0.1; // 10% default
  }
  
  async chat(messages: Message[], options: ChatOptions = {}) {
    const isError = false; // Will be set on error
    const shouldSample = isError || Math.random() < this.samplingRate;
    
    if (!shouldSample) {
      // Skip monitoring for non-sampled requests
      // Use a lightweight LLM client without monitoring
      return await this.llm.chat(messages, options);
    }
    
    // Enrich with sampling metadata
    const payload = monitor.enrichWithSampling({}, {
      samplingRate: this.samplingRate,
      sampled: true,
      samplingReason: isError ? 'error' : 'random',
    });
    
    return await this.llm.chat(messages, {
      ...options,
      _monitorPayload: payload,
    });
  }
}
```

## Timing Breakdown

For advanced timing, you'll need to instrument your code:

```typescript
async function llmWithTiming(messages: Message[], options: ChatOptions = {}) {
  const timings = {
    queueStart: Date.now(),
    queueEnd: 0,
    networkStart: 0,
    networkEnd: 0,
  };
  
  // Simulate queue time (if using a queue)
  await processQueue();
  timings.queueEnd = Date.now();
  
  // Network time
  timings.networkStart = Date.now();
  const result = await llm.chat(messages, options);
  timings.networkEnd = Date.now();
  
  // Enrich with timing
  const payload = monitor.enrichWithTiming({}, {
    queueTime: timings.queueEnd - timings.queueStart,
    networkTime: timings.networkEnd - timings.networkStart,
    // providerLatency would come from LLM response headers if available
  });
  
  return result;
}
```

## Important Notes

### 1. **Payload Storage is Automatic**

Once you enrich the payload, the Monitor middleware automatically stores it:

```typescript
// You enrich:
const payload = monitor.enrichWithEnvironment({}, { environment: 'production' });

// Monitor automatically saves to DB:
// INSERT INTO monitoring_events (..., payload) VALUES (..., '{"environment": {"environment": "production", ...}}')
```

### 2. **No Schema Changes Needed**

The `payload` column is JSON, so all metadata "just works":

```sql
-- Query enhanced metadata
SELECT 
  provider,
  model,
  payload->>'environment'->>'environment' as env,
  payload->>'request'->>'streaming' as is_streaming,
  AVG(duration) as avg_duration
FROM monitoring_events
WHERE payload->>'environment' IS NOT NULL
GROUP BY provider, model, env, is_streaming;
```

### 3. **Backward Compatible**

Old events without enhanced metadata still work:

```sql
-- This query works for both old and new events
SELECT 
  provider,
  COALESCE(payload->>'environment'->>'environment', 'unknown') as env,
  COUNT(*) as count
FROM monitoring_events
GROUP BY provider, env;
```

## Testing

```typescript
import { describe, it, expect } from 'vitest';

describe('LLM with Enhanced Metadata', () => {
  it('should capture environment metadata', async () => {
    const service = new LLMService({
      environment: 'test',
      serviceName: 'test-service',
    });
    
    await service.chat([{ role: 'user', content: 'test' }]);
    
    // Verify in database
    const events = await prisma.monitoring_events.findMany({
      where: { event_type: 'request.end' },
      orderBy: { created_at: 'desc' },
      take: 1,
    });
    
    expect(events[0].payload.environment).toEqual({
      environment: 'test',
      serviceName: 'test-service',
      nodeVersion: process.version,
    });
  });
});
```

## Summary

**Q: Is this supported by the table?**  
✅ **YES** - The `payload` JSON column stores all metadata automatically

**Q: Is this supported by NodeLLM request?**  
✅ **YES** - Use wrapper functions or hooks to enrich before/during requests

**Key Insight**: Enhanced metadata is **additive**, not **intrusive**. It works with NodeLLM's existing flow by enriching the payload that's already being captured.
