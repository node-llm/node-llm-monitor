/**
 * Simple Chat Example with Vercel AI SDK + NodeLLM Monitor
 * 
 * Demonstrates a single monitored request using the Vercel AI SDK.
 * 
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   npx tsx examples/vercel-ai-sdk/chat.ts
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Monitor } from "@node-llm/monitor";
import { randomUUID } from "crypto";
import "dotenv/config";

async function main() {
  // 1. Initialize Monitor
  const monitor = Monitor.memory({ captureContent: true });
  
  const requestId = randomUUID();
  const sessionId = randomUUID();
  const model = "gpt-4o-mini";
  const userMessage = "Explain quantum computing in one sentence.";

  console.log(`\n\x1b[36m👤 User:\x1b[0m ${userMessage}\n`);

  // 2. Prepare Context
  const ctx = {
    requestId,
    sessionId,
    provider: "openai",
    model,
    state: {},
    messages: [{ role: "user", content: userMessage }],
  };

  // 3. Log Request Start
  await monitor.onRequest(ctx);

  try {
    // 4. Call Vercel AI SDK
    const result = await generateText({
      model: openai(model),
      messages: [{ role: "user", content: userMessage }],
    });

    console.log(`\x1b[36m🤖 Assistant:\x1b[0m ${result.text}\n`);

    // 5. Log Response
    await monitor.onResponse(ctx, {
      toString: () => result.text,
      usage: result.usage,
      model,
    });

    // 6. Verify Monitoring Data (For Demo)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (monitor as any).store;
    const stats = await store.getStats();

    console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
    console.log("\x1b[33m✅ Monitoring Captured\x1b[0m");
    console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m");
    console.log(`   Total Requests: ${stats.totalRequests}`);
    console.log(`   Total Cost:     $${stats.totalCost?.toFixed(6)}`);
    console.log(`   Tokens:         ${result.usage.totalTokens}`);
    console.log("\x1b[33m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n");

  } catch (error) {
    await monitor.onError(ctx, error as Error);
    console.error("Error:", error);
  }
}

main().catch(console.error);
