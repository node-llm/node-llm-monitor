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

### 3. Other Adapters (Drizzle, Sequelize, Mongoose)

NodeLLM Monitor supports almost all major ecosystems.

```ts
import { Monitor, DrizzleAdapter, SequelizeAdapter, MongooseAdapter } from "@node-llm/monitor";
```

<details>
<summary><b>Drizzle ORM</b></summary>

```ts
// schema.ts
import { pgTable, text, timestamp, integer, doublePrecision, jsonb, uuid } from "drizzle-orm/pg-core";

export const monitoringEvents = pgTable("monitoring_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("eventType").notNull(),
  requestId: text("requestId").notNull(),
  sessionId: text("sessionId"),
  transactionId: text("transactionId"),
  time: timestamp("time").defaultNow().notNull(),
  duration: integer("duration"),
  cost: doublePrecision("cost"),
  payload: jsonb("payload").notNull().$type<Record<string, any>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
});

// app.ts
const monitor = new Monitor({
  store: new DrizzleAdapter(db, monitoringEvents)
});
```
</details>

<details>
<summary><b>Sequelize</b></summary>

```ts
// models/MonitoringEvent.ts
const MonitoringEvent = sequelize.define('monitoring_events', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  eventType: { type: DataTypes.STRING, allowNull: false },
  requestId: { type: DataTypes.STRING, allowNull: false, index: true },
  sessionId: { type: DataTypes.STRING, index: true },
  transactionId: { type: DataTypes.STRING, index: true },
  time: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, index: true },
  duration: DataTypes.INTEGER,
  cost: DataTypes.DOUBLE,
  payload: { type: DataTypes.JSON, allowNull: false },
  provider: DataTypes.STRING,
  model: DataTypes.STRING,
});

// app.ts
const monitor = new Monitor({ store: new SequelizeAdapter(MonitoringEvent) });
```
</details>

<details>
<summary><b>Mongoose (MongoDB)</b></summary>

```ts
// models/MonitoringEvent.ts
const MonitoringEventSchema = new Schema({
  id: { type: String, required: true, unique: true },
  eventType: { type: String, required: true, index: true },
  requestId: { type: String, required: true, index: true },
  time: { type: Date, default: Date.now, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  provider: String,
  model: String,
});

const MonitoringModel = model('MonitoringEvent', MonitoringEventSchema);

// app.ts
const monitor = new Monitor({ store: new MongooseAdapter(MonitoringModel) });
```
</details>

<details>
<summary><b>Zero-Config (Memory / File)</b></summary>

```ts
// 1. In-Memory (Great for Dev/CI)
const monitor = Monitor.memory();

// 2. File-based (Persistent JSON log)
const monitor = createFileMonitor("monitoring.log");
```
</details>


## Pluggable Storage (Non-Prisma)

While `@node-llm/monitor` provides a first-class Prisma adapter, it is designed with a pluggable architecture. You can use any database (PostgreSQL, SQLite, Redis, etc.) by implementing the `MonitoringStore` interface.

### 1. Manual Table Creation
If you aren't using Prisma, use our raw SQL migration:
`migrations/001_create_monitoring_events.sql`

### 2. Implement Custom Store
```ts
import { MonitoringStore, MonitoringEvent } from "@node-llm/monitor";

class CustomStore implements MonitoringStore {
  async saveEvent(event: MonitoringEvent) {
    // Your DB logic here: INSERT INTO monitoring_events ...
  }
  
  async getStats() {
    // Return aggregated stats for the dashboard
  }
}

const monitor = new Monitor({ store: new CustomStore() });
```

## Dashboard

NodeLLM Monitor includes a high-performance built-in dashboard.

```ts
import { MonitorDashboard } from "@node-llm/monitor/ui";
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

## Generic Usage (Non-NodeLLM)

While optimized as a native middleware for NodeLLM, the monitor is a generic telemetry engine. You can use it manually with any library (Vercel AI SDK, LangChain, or raw OpenAI):

```ts
const ctx = { requestId: "req_123", provider: "openai", model: "gpt-4" };

// 1. Start tracking
await monitor.onRequest(ctx);

// 2. Track tool calls
await monitor.onToolCallStart(ctx, { function: { name: "get_weather" } });
await monitor.onToolCallEnd(ctx, { result: "22°C" });

// 3. Finalize
await monitor.onResponse(ctx, {
  usage: { input_tokens: 100, output_tokens: 50, cost: 0.002 }
});
```

## Privacy

By default, `captureContent` is `false`. This ensures that Personal Identifiable Information (PII) is not persisted in your monitoring logs unless explicitly enabled for debugging.
