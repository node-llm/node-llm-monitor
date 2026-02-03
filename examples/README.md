# NodeLLM Monitor Examples 🚀

This directory contains various integration patterns and usage examples for NodeLLM Monitor.

## Available Examples

| Example | Description | Tech Stack |
|---------|-------------|------------|
| [`dashboard`](./dashboard) | **Recommended.** Comprehensive demo showing the full observability portal with simulated traffic. | Node.js, Express |
| [`otel-vercel-ai-sdk`](./otel-vercel-ai-sdk) | Zero-code instrumentation of the Vercel AI SDK via OpenTelemetry. | OTel, AI SDK, Express |
| [`vercel-ai-sdk`](./vercel-ai-sdk) | Manual instrumentation of the Vercel AI SDK for granular control. | AI SDK, tsx |
| [`custom-adapter`](./custom-adapter) | Blueprint for building your own storage backend (e.g., for Redis or NoSQL). | Node.js, tsx |

## 🛠️ How to Run

Before running any example, ensure you have installed dependencies and built the core packages from the root of the repository.

### 1. Root Setup

```bash
# From the repository root
pnpm install
pnpm build
```

### 2. Configure Environment

Each example contains a `.env.example` file. Copy it to `.env` and add your API keys:

```bash
cd examples/dashboard
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 3. Start the Example

Navigate to the specific example folder and run the start script:

```bash
pnpm run start
```

## 🔍 Which one should I use?

- **If you want to see the UI in action**: Check the [`dashboard`](./dashboard) example. It simulates complex AI interactions including tool calls, retries, and errors.
- **If you use Vercel AI SDK**: We recommend the [`otel-vercel-ai-sdk`](./otel-vercel-ai-sdk) approach for zero-code integration.
- **If you have a custom database**: Look at [`custom-adapter`](./custom-adapter) to see how to implement the `MonitoringStore` interface.

---

For more details, visit the [main documentation](https://node-llm.eshaiju.com/monitor).
