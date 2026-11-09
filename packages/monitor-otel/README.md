# @node-llm/monitor-otel 📡

![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Enabled-blue)
![npm](https://img.shields.io/npm/v/@node-llm/monitor-otel)

OpenTelemetry integration for NodeLLM Monitor. Bridging the gap between standard OTel tracing and AI-specific observability.

## Features

- 🔌 **Zero-Code Instrumentation**: Automatically capture AI spans from libraries like Vercel AI SDK.
- 🧠 **AI-Aware**: Extracts model names, token usage, cost, and tool calls from OTel attributes.
- 🎯 **Native Routing**: Forwards AI spans directly to your NodeLLM Monitor store.
- 🔍 **Streaming Support**: Captures Time-to-First-Token (TTFT) and average tokens/sec.

## Installation

```bash
pnpm add @node-llm/monitor @node-llm/monitor-otel
```

## Usage

### 1. Basic Setup

```ts
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { Monitor } from "@node-llm/monitor";
import { NodeLLMSpanProcessor } from "@node-llm/monitor-otel";

// 1. Initialize your monitor store
const monitor = Monitor.memory();

// 2. Add the SpanProcessor to your OTel provider
const provider = new NodeTracerProvider();
provider.addSpanProcessor(new NodeLLMSpanProcessor(monitor.getStore()));
provider.register();
```

### 2. Instrumented Libraries (e.g., Vercel AI SDK)

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const result = await generateText({
  model: openai("gpt-4o"),
  prompt: "What is quantum gravity?",
  experimental_telemetry: { isEnabled: true } // Enable OTel spans
});
```

The spans emitted by `ai` will be automatically intercepted, processed, and saved to your NodeLLM Monitor dashboard.

## Configuration

`NodeLLMSpanProcessor` accepts an optional options object:

```ts
new NodeLLMSpanProcessor(store, {
  captureContent: true, // Set to false to hide prompts/responses from logs
  filter: (span) => span.name.includes("my-app"), // Custom span filtering
  includeNodeLLMSpans: false, // See "NodeLLM's own spans" below
  onError: (err, span) => console.error("Failed to process AI span", err)
});
```

### NodeLLM's own spans

`@node-llm/core` can also create OpenTelemetry spans, with its `OpenTelemetry(otel)` middleware. The processor skips those spans by default (they carry a `node_llm.request_id` attribute), because the `Monitor` middleware already records the same calls and they would be counted twice.

If NodeLLM reaches Monitor only through OpenTelemetry, without the `Monitor` middleware, set `includeNodeLLMSpans: true`.

## License

MIT
