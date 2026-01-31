# NodeLLM Monitor 🛰️

Advanced, infrastructure-first monitoring for NodeLLM.

## Setup

### 1. Database Schema (Prisma)

Add the following model to your `schema.prisma`:

```prisma
model monitoring_events {
  id             String   @id @default(uuid())
  event_type     String   // request.start, request.end, tool.start, etc.
  request_id     String   @index
  session_id     String?  @index
  transaction_id String?  @index
  time           DateTime @default(now())
  duration       Int?     // duration in ms
  cost           Float?
  cpu_time       Float?
  gc_time        Float?
  allocations    Int?
  payload        Json     // Stores metadata, tokens and optional content
  created_at     DateTime @default(now())
  provider       String
  model          String
}
```

### 2. Integration

```ts
import { Monitor } from "@node-llm/monitor";
import { PrismaAdapter } from "@node-llm/monitor/adapters/prisma";
import { prisma } from "./db";

const monitor = new Monitor({
  store: new PrismaAdapter(prisma),
  captureContent: true // Optional: store full prompts/responses
});

const llm = createLLM({
  provider: "openai",
  middlewares: [monitor]
});
```

## Privacy

By default, `captureContent` is `false`. This ensures that Personal Identifiable Information (PII) is not persisted in your monitoring logs unless explicitly enabled for debugging.
