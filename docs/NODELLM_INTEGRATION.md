# NodeLLM Integration Guide for Enhanced Metadata

This guide shows how to use enhanced metadata with NodeLLM's actual request flow.

## Prerequisites

```typescript
import { createLLM, type Message } from '@node-llm/core';
import { createPrismaMonitor } from '@node-llm/monitor';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use the factory function - recommended approach
const monitor = createPrismaMonitor(prisma, {
  captureContent: false, // PII protection (default)
});

const llm = createLLM({
  provider: 'openai',
  model: 'gpt-4o-mini',
  middlewares: [monitor],
});
```

## Integration Patterns

### Pattern 1: Wrapper Function (Recommended)

Create a wrapper that enriches metadata and passes it via the `sessionId` or custom options that the Monitor middleware reads from context:

```typescript
import { createPrismaMonitor } from '@node-llm/monitor';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const monitor = createPrismaMonitor(prisma);

// The Monitor middleware automatically captures metadata from ctx.state
// You can extend the context state before/after requests

async function llmWithMetadata(
  messages: Message[],
  options: {
    model?: string;
    temperature?: number;
    stream?: boolean;
    sessionId?: string;
    
    // Enhanced metadata (optional)
    metadata?: {
      environment?: 'production' | 'staging' | 'development';
      serviceName?: string;
      promptVersion?: string;
    };
  } = {}
) {
  const { metadata, ...llmOptions } = options;
  
  // Calculate request size for later analysis
  const requestSizeBytes = JSON.stringify(messages).length;
  
  // Make request - the Monitor middleware captures timing automatically
  const result = await llm.chat(messages, {
    ...llmOptions,
    sessionId: options.sessionId, // Monitor captures this automatically
  });
  
  // Note: The Monitor middleware automatically tracks:
  // - Request start/end times (duration)
  // - Provider and model
  // - Token usage and cost (if available in response)
  // - CPU time and memory allocations
  
  return result;
}

// Usage
const result = await llmWithMetadata(
  [{ role: 'user', content: 'Hello' }],
  {
    model: 'gpt-4',
    sessionId: 'session-123',
  }
);
```

### Pattern 2: Service-Level Configuration

Set metadata once at service initialization:

```typescript
import { createLLM, type Message } from '@node-llm/core';
import { createPrismaMonitor, Monitor } from '@node-llm/monitor';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ServiceConfig {
  provider: string;
  serviceName: string;
  version: string;
  environment: 'production' | 'staging' | 'development';
}

interface ChatOptions {
  stream?: boolean;
  promptVersion?: string;
  captureContent?: boolean;
}

class LLMService {
  private monitor: Monitor;
  private llm: ReturnType<typeof createLLM>;
  private serviceMetadata: {
    serviceName: string;
    serviceVersion: string;
    environment: 'production' | 'staging' | 'development';
  };
  
  constructor(config: ServiceConfig) {
    // Use the factory function - recommended approach
    this.monitor = createPrismaMonitor(prisma);
    
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
      streaming: options.stream ?? false,
      requestSizeBytes: JSON.stringify(messages).length,
      promptVersion: options.promptVersion,
    });
    
    // Make request (monitor middleware captures automatically)
    const chat = this.llm.chat('gpt-4o-mini');
    return await chat.generate(messages);
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

For retry logic, wrap your LLM calls and track retry metadata:

```typescript
async function llmWithRetry(
  messages: Message[],
  options: ChatOptions = {},
  maxRetries = 3
) {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // The monitor middleware automatically captures each request attempt
      // Retry count can be tracked via transactionId to group related requests
      return await llm.chat(messages, {
        ...options,
        transactionId: options.transactionId, // Groups retries together
      });
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}

// You can query retry patterns from monitoring_events:
// SELECT transactionId, COUNT(*) as attempts, MAX(eventType) as final_status
// FROM monitoring_events WHERE transactionId IS NOT NULL
// GROUP BY transactionId HAVING COUNT(*) > 1
```

## Sampling for High-Volume Services

For high-volume services, create two LLM instances - one with monitoring and one without:

```typescript
class SampledLLMService {
  private samplingRate: number;
  private monitoredLlm: any;
  private unmonitoredLlm: any;
  
  constructor(config: { samplingRate?: number; provider: string } = { provider: 'openai' }) {
    this.samplingRate = config.samplingRate || 0.1; // 10% default
    
    // LLM with monitoring
    this.monitoredLlm = createLLM({
      provider: config.provider,
      middlewares: [monitor],
    });
    
    // LLM without monitoring for non-sampled requests
    this.unmonitoredLlm = createLLM({
      provider: config.provider,
    });
  }
  
  async chat(messages: Message[], options: ChatOptions = {}) {
    const shouldSample = Math.random() < this.samplingRate;
    
    if (shouldSample) {
      // Use monitored client
      return await this.monitoredLlm.chat(messages, options);
    }
    
    // Skip monitoring for non-sampled requests
    return await this.unmonitoredLlm.chat(messages, options);
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
-- Query enhanced metadata (PostgreSQL)
SELECT 
  provider,
  model,
  payload->'environment'->>'environment' as env,
  payload->'request'->>'streaming' as is_streaming,
  AVG(duration) as avg_duration
FROM monitoring_events
WHERE payload->'environment' IS NOT NULL
GROUP BY provider, model, env, is_streaming;
```

### 3. **Backward Compatible**

Old events without enhanced metadata still work:

```sql
-- This query works for both old and new events (PostgreSQL)
SELECT 
  provider,
  COALESCE(payload->'environment'->>'environment', 'unknown') as env,
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

**Q: How does monitoring integrate with NodeLLM?**  
✅ The Monitor class implements the NodeLLM middleware interface with lifecycle hooks:
- `onRequest(ctx)` - Called when a request starts
- `onResponse(ctx, result)` - Called when a request completes
- `onError(ctx, error)` - Called on errors
- `onToolCallStart/End/Error(ctx, tool)` - Called for tool invocations

**Key Insight**: The Monitor middleware automatically captures timing, usage, and cost data. Use `sessionId` and `transactionId` options to group related requests.
