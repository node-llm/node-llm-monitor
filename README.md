# NodeLLM Monitor 🛰️

Advanced, infrastructure-first monitoring for NodeLLM.

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

*Note: For non-Prisma users, a raw SQL migration is available at `migrations/001_create_monitoring_events.sql`.*

### 2. Integration

```ts
import { createPrismaMonitor } from "@node-llm/monitor";
import { prisma } from "./db";

const monitor = createPrismaMonitor(prisma, {
  captureContent: true // Optional: store full prompts/responses
});

const llm = createLLM({
  provider: "openai",
  middlewares: [monitor]
});
```

### 3. Zero-Config Development (In-Memory)

Perfect for local testing without a database:

```ts
import { Monitor } from "@node-llm/monitor";

const monitor = Monitor.memory();
```


## Dashboard

NodeLLM Monitor includes a high-performance built-in dashboard.

```ts
import { MonitorDashboard } from "@node-llm/monitor";
import express from "express";

const app = express();
const dashboard = new MonitorDashboard(prisma);

app.use("/monitor", dashboard.middleware());
app.listen(3000);
```


## Operational Metadata

Capture granular operational metrics without changing execution semantics:

```ts
// Enrich with environment, retries, and timing breakdowns
const payload = monitor.enrichWithEnvironment({}, {
  serviceName: "hr-api",
  environment: "production"
});

const result = await llm.chat(messages, { 
  sessionId: "session-123" 
});
```

## Privacy

By default, `captureContent` is `false`. This ensures that Personal Identifiable Information (PII) is not persisted in your monitoring logs unless explicitly enabled for debugging.
