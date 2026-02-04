# NodeLLM Monitor Demo

A showcase of [@node-llm/monitor](../../packages/monitor) integrated with [@node-llm/core](https://github.com/AshDev-ai/node-llm).

**All features enabled by default:** Streaming, Tools, Cost Tracking, Dashboard.

## Quick Start

```bash
cp .env.example .env    # Add your API key
pnpm install
pnpm start              # Chat with streaming + tools
```

Dashboard: http://localhost:3333/monitor

## Features Showcased

```typescript
// 1. Create LLM with Monitor middleware
const llm = createLLM({ provider, middlewares: [monitor] });

// 2. Chat with Tools
const chat = llm.chat(model, {
  tools: [new WeatherTool(), new CalculatorTool()],
});

// 3. Streaming
for await (const chunk of chat.stream("Hello")) { ... }

// 4. Standard
const response = await chat.ask("Hello");
console.log(response.inputTokens, response.outputTokens, response.cost);
```

## CLI Options

```bash
pnpm start                          # All features enabled
pnpm start --no-streaming           # Disable streaming
pnpm start --no-tools               # Disable tools
pnpm start --provider anthropic     # Use Anthropic
pnpm start --model gpt-4o           # Specific model
pnpm start --max-cost 0.10          # Cost guard ($0.10 limit)
pnpm start --system "Be concise"    # System prompt
pnpm start -c                       # Capture content
pnpm start -v                       # Verbose output
pnpm start --dashboard-only         # Dashboard only
```

## Chat Commands

| Command | Description |
|---------|-------------|
| `stats` | View monitoring stats |
| `usage` | Show token usage for conversation |
| `history` | Show conversation history |
| `clear` | Reset monitoring data |
| `quit` | Exit |

## Built-in Tools

| Tool | Description | Try |
|------|-------------|-----|
| `get_weather` | Weather lookup | "What's the weather in London?" |
| `calculator` | Math operations | "Calculate 25 * 4 + 10" |
| `get_datetime` | Current time | "What time is it in Tokyo?" |

## Environment Variables

```env
OPENAI_API_KEY=sk-...           # OpenAI
ANTHROPIC_API_KEY=sk-ant-...    # Anthropic  
GOOGLE_API_KEY=...              # Google AI
DEEPSEEK_API_KEY=...            # DeepSeek
NODELLM_PROVIDER=openai         # Default provider
NODELLM_MODEL=gpt-4o-mini       # Default model
PORT=3333                       # Dashboard port
```

## Dashboard

- **Overview** - Requests, cost, latency, errors
- **Providers** - Per-provider/model breakdown  
- **Tokens** - Token analytics + time series
- **Traces** - Request traces with filters
