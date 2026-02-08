# NodeLLM Monitor Examples 🚀

This directory contains various integration patterns and usage examples for NodeLLM Monitor.

## Available Examples

| Example | Description | Tech Stack |
|---------|-------------|------------|
| [`demo`](./demo) | **Recommended.** Comprehensive demo showing the full observability portal with simulated traffic. | Node.js, Express |
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

### 2. Configure Environment (Optional)

The `demo` example works out-of-the-box. However, the AI SDK examples require API keys:

```bash
cd examples/otel-vercel-ai-sdk
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 3. Start the Example

Navigate to the specific example folder and run the start script:

```bash
pnpm run start
```

For the [`demo`](./demo) example, once running, simply click the link below or paste it into your browser:
👉 **[http://localhost:3333/monitor](http://localhost:3333/monitor)**

#### What you'll see in the Demo:
*   **Real-time Charts**: Watch the request volume and cost graphs update every few seconds.
*   **Trace Explorer**: Inspect the full lifecycle of requests, including simulated tool calls, retries, and timing breakdowns.
*   **Provider Comparison**: Visualize activity across OpenAI, Anthropic, and Google Gemini.

## 🔍 Which one should I use?

- **If you want to see the UI in action**: Check the [`demo`](./demo) example.
- **If you use Vercel AI SDK**: We recommend the [`otel-vercel-ai-sdk`](./otel-vercel-ai-sdk) approach for zero-code integration.
- **If you have a custom database**: Look at [`custom-adapter`](./custom-adapter) to see how to implement the `MonitoringStore` interface.

---

For more details, visit the [main documentation](https://nodellm.dev/monitor).
