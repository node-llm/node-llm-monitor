/**
 * Enhanced Metadata Usage Example
 * 
 * This example demonstrates how to use the new enhanced monitoring metadata
 * to capture operational metrics without changing core execution semantics.
 */

import { Monitor } from "./src/Monitor.js";
import type { MonitoringStore } from "./src/types.js";

// Simple in-memory store
const store: MonitoringStore = {
  async saveEvent(event) {
    console.log(`[${event.eventType}]`, {
      provider: event.provider,
      model: event.model,
      duration: event.duration,
      // Enhanced metadata in payload
      request: event.payload.request,
      timing: event.payload.timing,
      environment: event.payload.environment,
      retry: event.payload.retry,
      sampling: event.payload.sampling,
    });
  },
  async getStats() {
    return {
      totalRequests: 0,
      totalCost: 0,
      avgDuration: 0,
      errorRate: 0,
    };
  },
};

const monitor = new Monitor({ store });

// Example 1: Basic request with streaming metadata
async function example1_streaming() {
  console.log("\n=== Example 1: Streaming Request ===");
  
  const ctx = {
    requestId: "req-stream-1",
    provider: "openai",
    model: "gpt-4",
    state: {},
  };

  // Enrich with request metadata
  const payload = monitor.enrichWithRequestMetadata(
    { messages: [{ role: "user", content: "Hello" }] },
    {
      streaming: true,
      requestSizeBytes: 45,
      responseSizeBytes: 120,
    }
  );

  await monitor.onRequest(ctx);
  
  // Simulate response with timing
  const result = {
    toString: () => "Hello! How can I help?",
    usage: { cost: 0.001 },
  };
  
  await monitor.onResponse(ctx, result);
}

// Example 2: Request with retry metadata
async function example2_retry() {
  console.log("\n=== Example 2: Request with Retries ===");
  
  const ctx = {
    requestId: "req-retry-1",
    provider: "anthropic",
    model: "claude-3-sonnet",
    state: {},
  };

  // Enrich with retry metadata
  const payload = monitor.enrichWithRetry(
    {},
    {
      retryCount: 2,
      retryReason: "rate_limit",
      fallbackModel: "claude-3-haiku",
    }
  );

  await monitor.onRequest(ctx);
  
  const result = {
    toString: () => "Response after retries",
    usage: { cost: 0.002 },
  };
  
  await monitor.onResponse(ctx, result);
}

// Example 3: Production request with full metadata
async function example3_production() {
  console.log("\n=== Example 3: Production Request (Full Metadata) ===");
  
  const ctx = {
    requestId: "req-prod-1",
    provider: "openai",
    model: "gpt-4o",
    state: {},
  };

  // Chain multiple enrichments
  let payload: any = { messages: [{ role: "user", content: "Analyze this data" }] };
  
  // Add request metadata
  payload = monitor.enrichWithRequestMetadata(payload, {
    streaming: false,
    requestSizeBytes: 1024,
    responseSizeBytes: 4096,
    promptVersion: "v2.1.0",
    templateId: "analysis-template",
  });
  
  // Add timing breakdown
  payload = monitor.enrichWithTiming(payload, {
    queueTime: 5,
    networkTime: 45,
    providerLatency: 850,
    toolTimeTotal: 200,
  });
  
  // Add environment context
  payload = monitor.enrichWithEnvironment(payload, {
    serviceName: "analytics-api",
    serviceVersion: "3.2.1",
    environment: "production",
    region: "us-east-1",
  });
  
  // Add sampling metadata
  payload = monitor.enrichWithSampling(payload, {
    samplingRate: 0.1,
    sampled: true,
    samplingReason: "random",
  });

  await monitor.onRequest(ctx);
  
  const result = {
    toString: () => "Analysis complete",
    usage: { cost: 0.015 },
  };
  
  await monitor.onResponse(ctx, result);
}

// Example 4: High-volume scenario with sampling
async function example4_sampling() {
  console.log("\n=== Example 4: High-Volume with Sampling ===");
  
  for (let i = 0; i < 10; i++) {
    const shouldSample = Math.random() < 0.2; // 20% sampling rate
    
    if (!shouldSample) {
      // Skip monitoring for non-sampled requests
      continue;
    }
    
    const ctx = {
      requestId: `req-volume-${i}`,
      provider: "openai",
      model: "gpt-3.5-turbo",
      state: {},
    };

    const payload = monitor.enrichWithSampling(
      {},
      {
        samplingRate: 0.2,
        sampled: true,
        samplingReason: "random",
      }
    );

    await monitor.onRequest(ctx);
    
    const result = {
      toString: () => "Quick response",
      usage: { cost: 0.0001 },
    };
    
    await monitor.onResponse(ctx, result);
  }
}

// Example 5: Error with retry metadata
async function example5_error() {
  console.log("\n=== Example 5: Error with Retry Context ===");
  
  const ctx = {
    requestId: "req-error-1",
    provider: "openai",
    model: "gpt-4",
    state: {},
  };

  const payload = monitor.enrichWithRetry(
    {},
    {
      retryCount: 3,
      retryReason: "timeout",
    }
  );

  await monitor.onRequest(ctx);
  await monitor.onError(ctx, new Error("Request timeout after 3 retries"));
}

// Run all examples
async function main() {
  console.log("🚀 Enhanced Metadata Examples\n");
  console.log("These examples show how to capture operational metrics");
  console.log("without changing execution semantics.\n");
  
  await example1_streaming();
  await example2_retry();
  await example3_production();
  await example4_sampling();
  await example5_error();
  
  console.log("\n✅ All examples complete!");
  console.log("\nKey Takeaways:");
  console.log("- All metadata is optional and best-effort");
  console.log("- Lives in payload, not core schema");
  console.log("- Can be chained for complex scenarios");
  console.log("- Enables operational dashboards without eval metrics");
}

main().catch(console.error);
