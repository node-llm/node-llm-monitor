# NodeLLM Monitor 🛰️

Advanced, infrastructure-first monitoring for NodeLLM.

## Setup

### 1. Database Schema (Prisma)

Add the following model to your `schema.prisma`:

```prisma
model llm_monitoring_events {
  id        String   @id @default(uuid())
  requestId String   @index
  timestamp DateTime @default(now())
  eventType String   // request_start, request_end, tool_start, etc.
  provider  String
  model     String
  payload   Json     // Stores metadata, tokens, cost, and optional content
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
