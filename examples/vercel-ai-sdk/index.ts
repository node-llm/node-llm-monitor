/**
 * Simple Chat Example with Vercel AI SDK + NodeLLM Monitor
 * 
 * Demonstrates a single monitored request using the Vercel AI SDK.
 * 
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   npx tsx examples/vercel-ai-sdk/index.ts
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Monitor, MemoryAdapter } from "@node-llm/monitor";
import { MonitorDashboard } from "@node-llm/monitor/ui";
import { createServer } from "node:http";
import { randomUUID } from "crypto";
import "dotenv/config";

async function main() {
  // 1. Initialize Monitor with MemoryAdapter
  const store = new MemoryAdapter();
  const monitor = new Monitor({ store, captureContent: true });

  // 2. Create Dashboard with custom title for Vercel AI SDK
  const dashboard = new MonitorDashboard(store, {
    i18n: {
      title: "Vercel AI SDK Monitor",
      supportedLngs: ["en", "es", "ar"],
      fallbackLng: "en"
    }
  });

  // 3. Start dashboard server
  const server = createServer(async (req, res) => {
    const handled = await dashboard.handleRequest(
      { url: req.url ?? "", headers: req.headers as Record<string, string | undefined>, method: req.method ?? "GET" },
      res
    );
    if (!handled) {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  server.listen(3334, () => {
    console.log("\n🚀 Vercel AI SDK Monitor Dashboard at http://localhost:3334/monitor\n");
  });
  
  const requestId = randomUUID();
  const sessionId = randomUUID();
  const model = "gpt-4o-mini";
  const userMessage = "Explain quantum computing in one sentence.";

  console.log(`\x1b[36m👤 User:\x1b[0m ${userMessage}\n`);

  // 4. Prepare Context
  const ctx = {
    requestId,
    sessionId,
    provider: "openai",
    model,
    state: {},
    messages: [{ role: "user", content: userMessage }],
  };

  // 5. Log Request Start
  await monitor.onRequest(ctx);

  try {
    // 6. Call Vercel AI SDK
    const result = await generateText({
      model: openai(model),
      messages: [{ role: "user", content: userMessage }],
    });

    console.log(`\x1b[36m🤖 Assistant:\x1b[0m ${result.text}\n`);

    // 7. Log Response
    await monitor.onResponse(ctx, {
      toString: () => result.text,
      usage: result.usage,
      model,
    });

    // 8. Verify Monitoring Data
    const stats = await store.getStats();

    console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
    console.log("\x1b[33m✅ Monitoring Captured\x1b[0m");
    console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
    console.log(`   Total Requests: ${stats.totalRequests}`);
    console.log(`   Total Cost:     $${stats.totalCost?.toFixed(6)}`);
    console.log(`   Tokens:         ${result.usage.totalTokens}`);
    console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
    console.log("\n📊 Dashboard running - press Ctrl+C to exit\n");

  } catch (error) {
    await monitor.onError(ctx, error as Error);
    console.error("Error:", error);
  }
}

main().catch(console.error);
