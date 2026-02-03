# NodeLLM Monitor 🛰️

Advanced, infrastructure-first monitoring and observability for LLM applications.

This repository is a monorepo containing the core monitoring package and integrations.

## Packages

| Package                                             | Version                                                     | Description                                             |
| --------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| [`@node-llm/monitor`](./packages/monitor)           | ![npm](https://img.shields.io/npm/v/@node-llm/monitor)      | Core monitoring engine, storage adapters, and dashboard |
| [`@node-llm/monitor-otel`](./packages/monitor-otel) | ![npm](https://img.shields.io/npm/v/@node-llm/monitor-otel) | OpenTelemetry integration for AI observability          |

## Quick Start

### 1. Installation

```bash
pnpm add @node-llm/monitor
```

### 2. Choose your workflow

#### Native NodeLLM Integration

If you are using `@node-llm/core`, just drop it in:

```ts
import { createLLM } from "@node-llm/core";
import { Monitor } from "@node-llm/monitor";

const monitor = Monitor.memory();
const llm = createLLM({
  middlewares: [monitor]
});
```

#### OpenTelemetry (Vercel AI SDK, etc.)

If you use the Vercel AI SDK or any OTel-instrumented library:

```ts
import { NodeLLMSpanProcessor } from "@node-llm/monitor-otel";
import { Monitor } from "@node-llm/monitor";

const monitor = Monitor.memory();
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new NodeLLMSpanProcessor(monitor.getStore()));
provider.register();
```

### 3. Launch Dashboard

```ts
import express from "express";
import { createMonitorMiddleware } from "@node-llm/monitor/ui";

const app = express();
app.use("/monitor", createMonitorMiddleware(monitor.getStore()));
app.listen(3000);
```

## Features

- 📊 **Real-time Metrics**: Track requests, costs, latency, and error rates at a glance.
- 🔍 **Request Tracing**: Deep-dive into execution flows, tool calls, and content.
- 💸 **Cost Observability**: Automatic cost calculation for OpenAI, Anthropic, and more.
- 🛡️ **PII Protection**: Content scrubbing out-of-the-box.
- 🔌 **Pluggable Architecture**: Support for Prisma, Filesystem, or custom storage.

## Development

This is a pnpm workspace.

```bash
pnpm install
pnpm build
pnpm test
```

## Examples

Check the [`examples/`](./examples) directory for various integration patterns:

- [`vercel-ai-sdk`](./examples/vercel-ai-sdk): Manual integration with Vercel AI SDK.
- [`otel-vercel-ai-sdk`](./examples/otel-vercel-ai-sdk): Zero-code instrumentation via OpenTelemetry.
- [`custom-adapter`](./examples/custom-adapter): Building your own storage backend.
- [`dashboard`](./examples/dashboard): Setting up the standalone observability portal.

## License

MIT
