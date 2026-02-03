/**
 * Example: Vercel AI SDK + OpenTelemetry + NodeLLM Monitor
 * 
 * This example demonstrates how to use the @node-llm/monitor-otel package
 * to automatically capture AI calls from the Vercel AI SDK and display
 * them in the built-in dashboard.
 */

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { Monitor } from "@node-llm/monitor";
import { createMonitorMiddleware } from "@node-llm/monitor/ui";
import { NodeLLMSpanProcessor } from "@node-llm/monitor-otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import express from "express";
import "dotenv/config";

async function main() {
  console.log("🚀 Starting OTel + Vercel AI SDK Example...");

  // 1. Initialize the NodeLLM Monitor with Memory storage
  // We use the memory adapter for this simple example.
  const monitor = Monitor.memory();

  // 2. Setup standard OpenTelemetry
  const provider = new NodeTracerProvider();
  
  // 3. Attach our NodeLLM SpanProcessor to the OTel pipeline
  // This is the "Ear" that listens for AI spans and sends them to the Monitor.
  provider.addSpanProcessor(new NodeLLMSpanProcessor(monitor.getStore()));
  provider.register();

  // 4. Setup a lightweight Express server to host the Monitor Dashboard
  const app = express();
  const port = 3001;

  // Use the monitor's built-in dashboard middleware
  // You can access it at http://localhost:3001/dashboard
  app.use(createMonitorMiddleware(monitor.getStore(), { basePath: "/dashboard" }));

  app.get("/", (req, res) => {
    res.send('<h1>NodeLLM Monitor OTel Example</h1><p>Check the <a href="/dashboard">Dashboard</a> to see AI traces.</p>');
  });

  app.listen(port, () => {
    console.log(`\n📊 Dashboard available at: http://localhost:${port}/dashboard`);
    console.log(`🔗 Main page at: http://localhost:${port}/`);
  });

  // 5. Trigger some AI calls using Vercel AI SDK
  // We enable 'experimental_telemetry' so Vercel SDK emits OTel spans.
  console.log("\n🤖 Triggering first AI call (Normal request)...");
  
  await generateText({
    model: openai("gpt-4o-mini"),
    prompt: "Give me a 5-word slogan for an AI monitoring tool.",
    experimental_telemetry: { 
      isEnabled: true,
      functionId: "slogan-generator",
      metadata: { sessionId: "session-123", userId: "user-456" }
    }
  });

  console.log("🤖 Triggering second AI call (Error simulation)...");
  
  try {
    // This will likely fail if no API key is provided, which is good for testing error capture
    await generateText({
      model: openai("gpt-4o-mini"),
      prompt: "This request should be tracked even if it fails.",
      experimental_telemetry: { isEnabled: true }
    });
  } catch (error) {
    console.log("Caught expected error (or successful request if key present). Check dashboard!");
  }

  console.log("\n✨ Done! Keep this process running to browse the dashboard.");
  console.log("Press Ctrl+C to stop.");
}

main().catch(console.error);
