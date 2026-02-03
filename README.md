# NodeLLM Monitor 🛰️

Advanced, infrastructure-first monitoring and observability for LLM applications. Built for production-grade Node.js systems.

NodeLLM Monitor provides a unified observability layer for all your LLM interactions, regardless of the provider or the SDK you use. It captures requests, tool calls, costs, and performance metrics, providing a beautiful standalone dashboard for real-time analysis.

---

## 🏗️ Architecture

NodeLLM Monitor is designed to be decoupled from your application logic. It operates in two primary modes:

1.  **Native Middleware**: First-class integration with `@node-llm/core`.
2.  **OpenTelemetry Bridge**: Zero-code instrumentation for the Vercel AI SDK, LangChain, or any OTel-compatible library via `@node-llm/monitor-otel`.

## 📦 Packages

| Package                                             | Version                                                     | Description                                             |
| --------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| [`@node-llm/monitor`](./packages/monitor)           | ![npm](https://img.shields.io/npm/v/@node-llm/monitor)      | Core monitoring engine, storage adapters, and dashboard |
| [`@node-llm/monitor-otel`](./packages/monitor-otel) | ![npm](https://img.shields.io/npm/v/@node-llm/monitor-otel) | OpenTelemetry bridge for AI observability               |

## 🚀 Quick Start

### 1. Installation

```bash
pnpm add @node-llm/monitor
```

### 2. Choose your workflow

#### Option A: Native NodeLLM Integration

If you are using `@node-llm/core`, adding monitoring is a single line:

```ts
import { createLLM } from "@node-llm/core";
import { Monitor } from "@node-llm/monitor";

const monitor = Monitor.memory(); // Or File/Prisma adapter

const llm = createLLM({
  provider: "openai",
  model: "gpt-4o",
  middlewares: [monitor]
});

// All calls via 'llm.ask()' are now automatically tracked!
```

#### Option B: OpenTelemetry (Vercel AI SDK, etc.)

Zero-code instrumentation for existing OTel-instrumented libraries:

```ts
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { NodeLLMSpanProcessor } from "@node-llm/monitor-otel";
import { Monitor } from "@node-llm/monitor";

const monitor = Monitor.memory();
const provider = new NodeTracerProvider();

// Hook the AI-aware SpanProcessor into your OTel pipeline
provider.addSpanProcessor(new NodeLLMSpanProcessor(monitor.getStore()));
provider.register();
```

### 3. Standalone Observability Dashboard

```ts
import express from "express";
import { Monitor } from "@node-llm/monitor";

const monitor = Monitor.memory();
const app = express();

// Standalone dashboard available at /monitor
app.use(monitor.api({ basePath: "/monitor" }));

app.listen(3000);
```

---

## ✨ Features

### 📊 Real-time Metrics

Track the pulse of your AI infrastructure:

- **Throughput**: Request volume and error rates.
- **Cost**: Automatic token counting and USD cost calculation for major providers.
- **Performance**: Latency tracking, Time-to-First-Token (TTFT), and tokens/sec.

### 🔍 Deep Tracing

Inspect the full lifecycle of every AI request:

- **Tool Calls**: See exactly what tools were called, their arguments, and results.
- **Streaming**: Visualize the progression of streamed responses.
- **Content**: Optional request/response content capture for debugging.

### 🛡️ Privacy & Scrubbing

Production-safe by default:

- **Zero-Storage Content**: Content capture is disabled by default.
- **Automated Scrubbing**: Built-in identifiers for PII (emails, keys, etc.) that mask sensitive data before it hits your database.

### 🔌 Pluggable Storage

- **Memory**: For development and high-speed transient monitoring.
- **Filesystem**: Persistent JSON logs for low-overhead auditing.
- **Prisma**: Production-grade storage in PostgreSQL, SQLite, or MySQL.
- **Custom**: Simple interface to build your own storage adapter (e.g., Redis, OpenSearch).

---

## 🛠️ Development

This is a pnpm workspace. To get started:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test
```

> **Note**: If you encounter `tsx: command not found` when running examples, ensure you've run `pnpm install` at the root to link workspace binaries.

## 📖 Examples

We provide detailed examples for various scenarios:

- [`demo`](./examples/demo): Full demo with simulated real-world AI traffic.
- [`otel-vercel-ai-sdk`](./examples/otel-vercel-ai-sdk): Integration with Vercel AI SDK via OpenTelemetry.
- [`vercel-ai-sdk`](./examples/vercel-ai-sdk): Manual instrumentation for Vercel AI SDK.
- [`custom-adapter`](./examples/custom-adapter): How to implement your own `MonitoringStore`.

---

## 📜 License

MIT © [Shaiju Edakulangara](https://eshaiju.com)
