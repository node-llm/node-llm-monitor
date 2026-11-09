# NodeLLM Monitor 🛰️

Advanced, infrastructure-first monitoring for NodeLLM.

![Dashboard Metrics View](docs/images/dashboard-metrics.png)

![Token Analytics](docs/images/dashboard-tokens.png)

![Dashboard Traces View](docs/images/dashboard-traces.png)

## Features

- 📊 **Real-time Metrics** - Track requests, costs, latency, and error rates
- 🔍 **Request Tracing** - Detailed execution flow with tool calls
- 💰 **Cost Analysis** - Per-provider and per-model cost breakdown
- 📈 **Time Series Charts** - Visualize trends over time
- 🔌 **Pluggable Storage** - Memory, File, or Prisma adapters
- 🛡️ **Privacy First** - Content scrubbing and PII protection

## Setup

### 1. Database Schema (Prisma)

Add the following model to your `schema.prisma`:

```prisma
model monitoring_events {
  id             String   @id @default(uuid())
  eventType      String   // request.start, request.end, tool.start, etc.
  requestId      String   @index
  sessionId      String?  @index
  transactionId  String?  @index
  time           DateTime @default(now())
  duration       Int?     // duration in ms
  cost           Float?
  cpuTime        Float?
  gcTime         Float?
  allocations    Int?
  payload        Json     // Stores metadata, tokens and optional content
  createdAt      DateTime @default(now())
  provider       String
  model          String
}
```

Then run the migration to create the table:

```bash
npx prisma migrate dev --name add_monitoring_events
```

_Note: For non-Prisma users, a raw SQL migration is available at `migrations/001_create_monitoring_events.sql`._

### 2. Integration

```ts
import { createLLM } from "@node-llm/core";
import { createPrismaMonitor } from "@node-llm/monitor";
import { prisma } from "./db";

// Create monitor with Prisma storage
const monitor = createPrismaMonitor(prisma, {
  captureContent: true // Optional: capture prompts/responses (scrubbed by default)
});

// Attach monitor as middleware - it automatically tracks all requests
const llm = createLLM({
  provider: "openai",
  model: "gpt-4o-mini",
  middlewares: [monitor]
});
```

### 3. Adapters (Memory / File)

NodeLLM Monitor includes built-in adapters for development and logging.

```ts
import { Monitor, createFileMonitor } from "@node-llm/monitor";

// 1. In-Memory (Great for Dev/CI)
const memoryMonitor = Monitor.memory();

// 2. File-based (Persistent JSON log)
const fileMonitor = createFileMonitor("./monitoring.log");
```

## Pluggable Storage (Non-Prisma)

While `@node-llm/monitor` provides a first-class Prisma adapter, it is designed with a pluggable architecture. You can use any database (PostgreSQL, SQLite, Redis, etc.) by implementing the `MonitoringStore` interface.

### 1. Manual Table Creation

If you aren't using Prisma, use our raw SQL migration:
`migrations/001_create_monitoring_events.sql`

### 2. Implement Custom Store

```ts
import { Monitor, MonitoringStore, MonitoringEvent, Stats } from "@node-llm/monitor";

class CustomStore implements MonitoringStore {
  async saveEvent(event: MonitoringEvent): Promise<void> {
    // Your DB logic here: INSERT INTO monitoring_events ...
  }

  async getStats(filter?: { from?: Date }): Promise<Stats> {
    // Return aggregated stats for the dashboard
    return {
      totalRequests: 0,
      totalCost: 0,
      avgDuration: 0,
      errorRate: 0
    };
  }
}

const monitor = new Monitor({ store: new CustomStore() });
```

## Dashboard

NodeLLM Monitor includes a high-performance built-in dashboard for real-time observability.

### Metrics View

Track total requests, costs, response times, and error rates at a glance. View usage breakdown by provider and model with interactive time-series charts.

![Metrics Dashboard](docs/images/dashboard-metrics.png)

### Traces View

Inspect individual requests with full execution flow, including tool calls, timing, and request/response content.

![Traces Dashboard](docs/images/dashboard-traces.png)

### Launch the Dashboard

```ts
import express from "express";
import { PrismaClient } from "@prisma/client";
import { MonitorDashboard } from "@node-llm/monitor/ui";

const prisma = new PrismaClient();
const app = express();

// Create dashboard - pass Prisma client or any MonitoringStore
// Dashboard handles its own routing under basePath
app.use(
  createMonitorMiddleware(prisma, {
    basePath: "/monitor",
    cors: false
  })
);

// OR use the ergonomic shorthand from a monitor instance:
app.use(monitor.api({ basePath: "/monitor" }));

app.listen(3000, () => {
  console.log("Dashboard available at http://localhost:3000/monitor");
});
```

### Fit It Into Your App

Pass `ui` to make the dashboard look like part of the app that hosts it: your name and logo, your accent color, a label for what is being monitored (such as a tenant), and a link back to your app. The built-in extras can be hidden.

```ts
const dashboard = createMonitorMiddleware(store, {
  basePath: "/admin/monitor",
  ui: {
    title: "AI monitor",
    subtitle: "Calls, cost and latency",
    logoUrl: "/logo.svg",
    accentColor: "#f2a93b",
    theme: "light", // "light" | "dark" | "system" (default)
    context: "Acme Inc.", // shown as a badge in the header
    backLink: { label: "Back to app", href: "/" },
    hideGithubLink: true,
    hideLanguageSwitcher: true,
    hideFooter: true,
    documentTitle: "AI monitor · Acme Inc.",
    embedded: false // true: shown in a same-origin frame in your own page (see below)
  }
});
```

**Inside your own page.** See [Fit the dashboard into your app](../../docs/EMBEDDING.md) for embedded mode, the security checklist and a worked example. In short, with `embedded: true`, the dashboard drops its header and footer and its page background, and posts its height to the parent page as `{ type: "nodellm-monitor:height", height }`, to its own origin only. Show it in a same-origin `<iframe>` and size the frame from that message, checking `event.origin` is your own. Allow the dashboard page to be framed by your own site only (`Content-Security-Policy: frame-ancestors 'self'`); no other page needs to change.

If your app serves the static build in `dashboard/build` itself (for example from a Rails or Django app, with its own API answering `./api/*`), set the same object as `window.__MONITOR_UI__` in a script before the dashboard's script. `injectDashboardConfig(html, { ui })` from `@node-llm/monitor/ui` does this safely. With a Content Security Policy, give that script your nonce.

## Operational Metadata

Capture granular operational metrics without changing execution semantics:

```ts
import { Monitor, createPrismaMonitor } from "@node-llm/monitor";

const monitor = createPrismaMonitor(prisma);

// Enrich with environment context
let payload = monitor.enrichWithEnvironment(
  {},
  {
    serviceName: "hr-api",
    environment: "production"
  }
);

// Add timing breakdown for debugging
payload = monitor.enrichWithTiming(payload, {
  queueTime: 5,
  networkTime: 45,
  providerLatency: 850
});

// Track retries for reliability analysis
payload = monitor.enrichWithRetry(payload, {
  retryCount: 2,
  retryReason: "rate_limit"
});
```

## Generic Usage (Non-NodeLLM)

While optimized as a native middleware for NodeLLM, the monitor is a generic telemetry engine. You can use it manually with any library (Vercel AI SDK, LangChain, or raw OpenAI):

```ts
import { Monitor } from "@node-llm/monitor";
import type { MinimalContext } from "@node-llm/monitor";

const monitor = Monitor.memory();

// Create context object (implements MinimalContext interface)
const ctx: MinimalContext = {
  requestId: "req_123",
  provider: "openai",
  model: "gpt-4o",
  state: {} // Required for metrics tracking
};

// 1. Start tracking
await monitor.onRequest(ctx);

// 2. Track tool calls (optional)
await monitor.onToolCallStart(ctx, { id: "call_1", function: { name: "get_weather" } });
await monitor.onToolCallEnd(ctx, { id: "call_1" }, "22°C");

// 3. Finalize with result
await monitor.onResponse(ctx, {
  toString: () => "The weather is 22°C",
  usage: { input_tokens: 100, output_tokens: 50, cost: 0.002 }
});
```

## OpenTelemetry Support

For zero-code instrumentation of libraries like Vercel AI SDK, use our OpenTelemetry bridge:

```ts
import { NodeLLMSpanProcessor } from "@node-llm/monitor-otel";
import { Monitor } from "@node-llm/monitor";

const monitor = Monitor.memory();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new NodeLLMSpanProcessor(monitor.getStore()));
provider.register();
```

See [`@node-llm/monitor-otel`](../monitor-otel) for more details.

## Privacy

By default, `captureContent` is `false`. This ensures that Personal Identifiable Information (PII) is not persisted in your monitoring logs unless explicitly enabled for debugging.
