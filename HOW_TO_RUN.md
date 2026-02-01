# How to Run - NodeLLM Monitor

## Quick Start

### 1. Run Tests

```bash
npm test
```

**Expected Output**:

```
✓ test/Monitor.test.ts (2 tests)
✓ test/TimeSeriesBuilder.test.ts (11 tests)
✓ test/PrismaAdapter.test.ts (12 tests)
✓ test/api-client.test.ts (9 tests)
✓ test/enhanced-metadata.test.ts (14 tests)

Test Files  5 passed (5)
     Tests  48 passed (48)
```

---

### 2. Build

```bash
npm run build:server
```

**Expected Output**:

```
ESM Build start
ESM dist/index.js                         4.35 KB
ESM dist/adapters/prisma/PrismaAdapter.js 6.32 KB
ESM ⚡️ Build success
```

---

### 3. Run Example

```bash
npm run example
```

**What it does**:

- Builds the library and dashboard server
- Simulates live LLM requests with 3 different providers
- Demonstrates **Enhanced Metadata** (retries, environment, timing breakdowns)
- Aggregates metrics using **TimeSeriesBuilder**
- Starts a live dashboard at **http://localhost:3333/monitor**

### 4. Run Custom Adapter Example

```bash
npm run example:custom
```

**What it does**:

- Demonstrates how to use a **non-Prisma** custom store
- Uses a class-based `SimpleLogStore` implementation
- Starts a dashboard on **http://localhost:4000/monitor**

---

## Development Workflow

### Watch Mode (Development)

```bash
npm run build:server -- --watch
```

Rebuilds automatically on file changes.

---

### Run Specific Tests

```bash
# Single test file
npm test -- TimeSeriesBuilder.test.ts

# Pattern matching
npm test -- metadata

# Watch mode
npm test -- --watch
```

---

## Production Setup

### 1. Install in Your Project

```bash
npm install @node-llm/monitor
```

### 2. Add Prisma Schema

Add to your `schema.prisma`:

```prisma
model monitoring_events {
  id             String   @id @default(uuid())
  eventType      String
  requestId      String   @index
  sessionId      String?  @index
  transactionId  String?  @index
  time           DateTime @default(now())
  duration       Int?
  cost           Float?
  cpuTime        Float?
  gcTime         Float?
  allocations    Int?
  payload        Json     // Enhanced metadata stored here
  createdAt      DateTime @default(now())
  provider       String
  model          String
}
```

### 3. Run Migration

```bash
npx prisma migrate dev --name add_monitoring_events
```

### 4. Integrate with NodeLLM

```typescript
import { createLLM } from "@node-llm/core";
import { createPrismaMonitor } from "@node-llm/monitor";
import { prisma } from "./db";

const monitor = createPrismaMonitor(prisma, {
  captureContent: false // PII protection
});

const llm = createLLM({
  provider: "openai",
  middlewares: [monitor]
});

// Use enhanced metadata
const payload = monitor.enrichWithEnvironment(
  {},
  {
    environment: "production",
    serviceName: "api"
  }
);

const result = await llm.chat([{ role: "user", content: "Hello" }], { ...payload });
```

### 5. Start Dashboard

```typescript
import { MonitorDashboard } from "@node-llm/monitor";
import express from "express";
import { prisma } from "./db";

const app = express();
const dashboard = new MonitorDashboard(prisma);

app.use("/monitor", dashboard.middleware());
app.listen(3000);

// Dashboard available at: http://localhost:3000/monitor
```

---

## Dashboard

### Local Development

```bash
# Terminal 1: Build and run example
npm run example

# Terminal 2: Access dashboard
open http://localhost:3333/monitor
```

### Production Build

```bash
cd dashboard
npm run build
```

Outputs to `dashboard/dist` - served automatically by `MonitorDashboard`.

---

## Verification Checklist

After setup, verify everything works:

```bash
# 1. Tests pass
npm test
# ✓ 48 tests passing

# 2. Build succeeds
npm run build:server
# ✓ No errors

# 3. Example runs
npm run example
# ✓ Dashboard starts on :3333

# 4. Dashboard loads
curl http://localhost:3333/monitor/api/stats
# ✓ Returns JSON stats
```

---

## Troubleshooting

### Tests Fail

```bash
# Clear cache and retry
rm -rf node_modules/.vite
npm test
```

### Build Fails

```bash
# Check TypeScript version
npx tsc --version
# Should be 5.x

# Clean and rebuild
rm -rf dist
npm run build:server
```

### Dashboard Not Loading

```bash
# Check if port is in use
lsof -i :3333

# Try different port
PORT=3457 npm run example
```

### Prisma Issues

```bash
# Regenerate Prisma client
npx prisma generate

# Reset database (development only!)
npx prisma migrate reset
```

---

## Performance Testing

### Load Test

```bash
# Install autocannon
npm install -g autocannon

# Run load test
autocannon -c 10 -d 30 http://localhost:3456/api/monitor/stats
```

### Memory Profiling

```bash
node --inspect example.ts
# Open chrome://inspect in Chrome
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "20"
      - run: npm ci
      - run: npm test
      - run: npm run build:server
```

---

## Environment Variables

```bash
# Development
NODE_ENV=development
LOG_LEVEL=debug

# Production
NODE_ENV=production
DATABASE_URL=postgresql://...
MONITOR_SAMPLING_RATE=0.1  # 10% sampling
```

---

## Next Steps

1. ✅ Run tests: `npm test`
2. ✅ Build: `npm run build:server`
3. ✅ Try examples: `npm run example`
4. ✅ Read docs: `docs/ENHANCED_METADATA.md`
5. ✅ Integrate with your app
6. ✅ Deploy dashboard

---

## Support

- **Documentation**: See `docs/` folder
- **Examples**: See `examples/dashboard.ts`
- **Tests**: See `test/` folder for usage patterns
- **Metadata**: See `docs/ENHANCED_METADATA.md`

---

## Summary

**Development**:

```bash
npm test              # Run tests
npm run build:server  # Build
node example.ts       # Run example
```

**Production**:

```bash
npm install @node-llm/monitor
# Add Prisma schema
# Integrate with NodeLLM
# Deploy dashboard
```

**All features working** ✅
