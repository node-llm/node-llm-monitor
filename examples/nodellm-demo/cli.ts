#!/usr/bin/env tsx
/**
 * NodeLLM Monitor Demo
 * 
 * A showcase of @node-llm/core integrated with @node-llm/monitor.
 * All features enabled by default - streaming, tools, cost tracking.
 */

import "dotenv/config";
import { Command } from "commander";
import { createServer } from "node:http";
import * as readline from "node:readline";

// ─────────────────────────────────────────────────────────────────────────────
// NodeLLM Imports
// ─────────────────────────────────────────────────────────────────────────────

import { createLLM, CostGuardMiddleware, Tool, z } from "@node-llm/core";
import { Monitor, MemoryAdapter } from "@node-llm/monitor";
import { MonitorDashboard } from "@node-llm/monitor/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Tools - Showcase NodeLLM Tool Definition
// ─────────────────────────────────────────────────────────────────────────────

class WeatherTool extends Tool {
  name = "get_weather";
  description = "Get current weather for a location";
  schema = z.object({
    location: z.string().describe("City name, e.g. 'London'"),
    unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  });

  async execute({ location, unit }: z.infer<typeof this.schema>) {
    return JSON.stringify({
      location,
      temperature: unit === "fahrenheit" ? 72 : 22,
      condition: "Partly cloudy",
      humidity: 65,
    });
  }
}

class CalculatorTool extends Tool {
  name = "calculator";
  description = "Perform math calculations";
  schema = z.object({
    expression: z.string().describe("Math expression, e.g. '2 + 2'"),
  });

  async execute({ expression }: z.infer<typeof this.schema>) {
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
    const result = Function(`"use strict"; return (${sanitized})`)();
    return `${expression} = ${result}`;
  }
}

class DateTimeTool extends Tool {
  name = "get_datetime";
  description = "Get current date/time";
  schema = z.object({
    timezone: z.string().optional().default("UTC"),
  });

  async execute({ timezone }: z.infer<typeof this.schema>) {
    return new Date().toLocaleString("en-US", { timeZone: timezone });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS = {
  openai: { env: "OPENAI_API_KEY", model: "gpt-4o-mini" },
  anthropic: { env: "ANTHROPIC_API_KEY", model: "claude-3-5-sonnet-20241022" },
  google: { env: "GOOGLE_API_KEY", model: "gemini-1.5-flash" },
  deepseek: { env: "DEEPSEEK_API_KEY", model: "deepseek-chat" },
} as const;

type ProviderName = keyof typeof PROVIDERS;

function detectProvider(): ProviderName {
  if (process.env.NODELLM_PROVIDER) return process.env.NODELLM_PROVIDER as ProviderName;
  for (const [name, { env }] of Object.entries(PROVIDERS)) {
    if (process.env[env]) return name as ProviderName;
  }
  return "openai";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Demo
// ─────────────────────────────────────────────────────────────────────────────

async function main(options: {
  port: number;
  provider: ProviderName;
  model: string;
  streaming: boolean;
  tools: boolean;
  maxCost?: number;
  system?: string;
  capture: boolean;
  verbose: boolean;
  dashboardOnly: boolean;
}) {
  const { port, provider, model, streaming, tools, maxCost, system, capture, verbose } = options;

  // ─── 1. Setup Monitor ───
  const store = new MemoryAdapter();
  const monitor = new Monitor({
    store,
    captureContent: capture,
    scrubbing: { pii: true, secrets: true },
  });

  // ─── 2. Start Dashboard ───
  const dashboard = new MonitorDashboard(store);
  createServer((req, res) => {
    dashboard.handleRequest(
      { url: req.url ?? "", headers: req.headers as Record<string, string>, method: req.method ?? "GET" },
      res
    );
  }).listen(port, () => {
    console.log(`\n📊 Dashboard: http://localhost:${port}/monitor\n`);
  });

  if (options.dashboardOnly) {
    console.log("Dashboard-only mode. Press Ctrl+C to exit.\n");
    return;
  }

  // ─── 3. Validate API Key ───
  const { env: envKey } = PROVIDERS[provider];
  if (!process.env[envKey]) {
    console.error(`❌ Missing ${envKey} for provider '${provider}'`);
    console.log("\nAvailable providers:");
    for (const [p, { env }] of Object.entries(PROVIDERS)) {
      console.log(`  ${process.env[env] ? "✅" : "❌"} ${p}: ${env}`);
    }
    process.exit(1);
  }

  // ─── 4. Create LLM with Monitor ───
  const middlewares: any[] = [monitor];
  if (maxCost) {
    middlewares.push(
      new CostGuardMiddleware({
        maxCost,
        onLimitExceeded: (_, cost) => console.log(`\n⚠️ Budget exceeded: $${cost.toFixed(4)}`),
      })
    );
  }

  const llm = createLLM({ provider, middlewares });

  // ─── 5. Create Chat with Tools ───
  const chat = llm.chat(model, {
    systemPrompt: system,
    tools: tools ? [new WeatherTool(), new CalculatorTool(), new DateTimeTool()] : undefined,
    onToolCallStart: verbose ? (t: any) => console.log(`  🔧 ${t.name}`) : undefined,
    onToolCallEnd: verbose ? (t: any, r: any) => console.log(`  ✅ ${String(r).slice(0, 50)}`) : undefined,
  });

  // ─── 6. Print Config ───
  console.log(`🤖 NodeLLM Chat`);
  console.log(`   Provider: ${provider} | Model: ${model}`);
  console.log(`   Streaming: ${streaming} | Tools: ${tools}`);
  if (maxCost) console.log(`   Cost Guard: $${maxCost}`);
  console.log(`\n💬 Type your message (or: stats, usage, history, clear, quit)\n`);

  // ─── 7. Chat Loop ───
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => {
    rl.question("You: ", async (input) => {
      const cmd = input.trim().toLowerCase();

      if (cmd === "quit" || cmd === "exit") {
        console.log(`\n👋 Goodbye! Dashboard: http://localhost:${port}/monitor`);
        process.exit(0);
      }

      if (cmd === "stats") {
        const s = await store.getStats();
        console.log(`\n📊 Stats: ${s.totalRequests} reqs | $${s.totalCost.toFixed(6)} cost | ${s.avgDuration.toFixed(0)}ms avg\n`);
        return prompt();
      }

      if (cmd === "usage") {
        const u = chat.totalUsage;
        console.log(`\n📈 Usage: ${u.input_tokens} in + ${u.output_tokens} out = ${u.total_tokens} tokens | $${(u.cost || 0).toFixed(6)}\n`);
        return prompt();
      }

      if (cmd === "history") {
        console.log(`\n📜 History (${chat.history.length} messages):`);
        chat.history.forEach((m, i) => console.log(`  ${i + 1}. [${m.role}] ${String(m.content).slice(0, 60)}...`));
        console.log();
        return prompt();
      }

      if (cmd === "clear") {
        store.clear();
        console.log("\n✅ Cleared\n");
        return prompt();
      }

      if (!input.trim()) return prompt();

      try {
        if (streaming) {
          // ─── Streaming Response ───
          process.stdout.write("\n🤖 ");
          let usage: any;
          for await (const chunk of chat.stream(input)) {
            if (chunk.content) process.stdout.write(chunk.content);
            if (chunk.usage) usage = chunk.usage;
          }
          console.log("\n");
          if (usage) {
            console.log(`   📊 ${usage.input_tokens} in / ${usage.output_tokens} out | $${usage.cost?.toFixed(6) || "N/A"}\n`);
          }
        } else {
          // ─── Standard Response ───
          const response = await chat.ask(input);
          console.log(`\n🤖 ${response.content}\n`);
          console.log(`   📊 ${response.inputTokens} in / ${response.outputTokens} out | $${response.cost?.toFixed(6) || "N/A"}\n`);
        }
      } catch (err: any) {
        console.error(`\n❌ ${err.message}\n`);
      }

      prompt();
    });
  };

  prompt();
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

const program = new Command()
  .name("nodellm-demo")
  .description("NodeLLM + Monitor showcase")
  .option("-p, --port <n>", "Dashboard port", "3333")
  .option("--provider <name>", "Provider: openai, anthropic, google, deepseek")
  .option("--model <name>", "Model name")
  .option("--no-streaming", "Disable streaming")
  .option("--no-tools", "Disable tools")
  .option("--max-cost <n>", "Cost limit in USD")
  .option("--system <prompt>", "System prompt")
  .option("-c, --capture", "Capture content")
  .option("-v, --verbose", "Verbose output")
  .option("--dashboard-only", "Dashboard only")
  .action((opts) => {
    const provider = (opts.provider || detectProvider()) as ProviderName;
    main({
      port: parseInt(opts.port),
      provider,
      model: opts.model || process.env.NODELLM_MODEL || PROVIDERS[provider].model,
      streaming: opts.streaming !== false,
      tools: opts.tools !== false,
      maxCost: opts.maxCost ? parseFloat(opts.maxCost) : undefined,
      system: opts.system,
      capture: opts.capture || false,
      verbose: opts.verbose || false,
      dashboardOnly: opts.dashboardOnly || false,
    });
  });

program.parse();
