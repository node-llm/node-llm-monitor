#!/usr/bin/env node
/**
 * Verify that all documented exports actually exist in the built package.
 * Run after `npm run build` to catch documentation errors.
 */

import * as monitor from "../dist/index.js";
import * as ui from "../dist/ui/index.js";

const expectedExports = {
  "@node-llm/monitor": {
    // Core classes
    classes: [
      "Monitor",
      "MemoryAdapter",
      "PrismaAdapter",
      "FileAdapter",
      "ContentScrubber",
      "TimeSeriesBuilder"
    ],
    // Factory functions
    functions: ["createPrismaMonitor", "createFileMonitor"],
    // Types (just verify they're exported, even if undefined at runtime)
    types: ["MonitorOptions", "MonitoringEvent", "MonitoringStore", "Stats", "MetricsData"]
  },
  "@node-llm/monitor/ui": {
    classes: ["MonitorDashboard"],
    functions: ["createMonitorMiddleware", "createMonitoringRouter"]
  }
};

let hasErrors = false;

function verify(pkg, mod, category, names) {
  for (const name of names) {
    if (!(name in mod)) {
      console.error(`❌ Missing ${category}: ${pkg} → ${name}`);
      hasErrors = true;
    } else {
      console.log(`✓ ${pkg} → ${name}`);
    }
  }
}

console.log("\n📦 Verifying @node-llm/monitor exports...\n");

const monitorExports = expectedExports["@node-llm/monitor"];
verify("@node-llm/monitor", monitor, "class", monitorExports.classes);
verify("@node-llm/monitor", monitor, "function", monitorExports.functions);

console.log("\n📦 Verifying @node-llm/monitor/ui exports...\n");

const uiExports = expectedExports["@node-llm/monitor/ui"];
verify("@node-llm/monitor/ui", ui, "class", uiExports.classes);
verify("@node-llm/monitor/ui", ui, "function", uiExports.functions);

console.log("\n🔍 Verifying static methods...\n");

// Verify Monitor.memory() static method
if (typeof monitor.Monitor.memory !== "function") {
  console.error("❌ Monitor.memory() static method not found");
  hasErrors = true;
} else {
  console.log("✓ Monitor.memory() static method exists");
}

console.log("\n🔍 Verifying instance methods...\n");

// Verify Monitor instance methods
const testMonitor = monitor.Monitor.memory();
const monitorMethods = [
  "onRequest",
  "onResponse",
  "onError",
  "onToolCallStart",
  "onToolCallEnd",
  "onToolCallError",
  "enrichWithRequestMetadata",
  "enrichWithTiming",
  "enrichWithEnvironment",
  "enrichWithRetry",
  "enrichWithSampling"
];

for (const method of monitorMethods) {
  if (typeof testMonitor[method] !== "function") {
    console.error(`❌ Monitor.${method}() method not found`);
    hasErrors = true;
  } else {
    console.log(`✓ Monitor.${method}()`);
  }
}

// Verify MonitorDashboard instance methods
const testStore = new monitor.MemoryAdapter();
const testDashboard = new ui.MonitorDashboard(testStore);
const dashboardMethods = ["middleware", "handleRequest"];

for (const method of dashboardMethods) {
  if (typeof testDashboard[method] !== "function") {
    console.error(`❌ MonitorDashboard.${method}() method not found`);
    hasErrors = true;
  } else {
    console.log(`✓ MonitorDashboard.${method}()`);
  }
}

// Verify MemoryAdapter methods
const adapterMethods = ["saveEvent", "getStats"];
for (const method of adapterMethods) {
  if (typeof testStore[method] !== "function") {
    console.error(`❌ MemoryAdapter.${method}() method not found`);
    hasErrors = true;
  } else {
    console.log(`✓ MemoryAdapter.${method}()`);
  }
}

console.log("");

if (hasErrors) {
  console.error("❌ Export verification failed! Update docs or implementation.\n");
  process.exit(1);
} else {
  console.log("✅ All documented exports verified!\n");
}
