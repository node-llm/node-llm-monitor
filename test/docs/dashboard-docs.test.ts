/**
 * Documentation Verification Tests: docs/monitor/dashboard.md
 *
 * Ensures dashboard integration samples compile and expose expected handlers.
 */
import { describe, it, expect } from "vitest";
import { PrismaAdapter } from "../../src/adapters/prisma/PrismaAdapter.js";
import { MemoryAdapter } from "../../src/adapters/memory/MemoryAdapter.js";
import { Monitor } from "../../src/Monitor.js";
import { createMonitorMiddleware, createMonitoringRouter } from "../../src/ui/index.js";

const makeExpressStub = () => {
  const used: Array<{ path?: string; handler: unknown }> = [];
  return {
    used,
    use: (arg1: any, arg2?: any) => {
      if (typeof arg1 === "string") {
        used.push({ path: arg1, handler: arg2 });
      } else {
        used.push({ handler: arg1 });
      }
    }
  };
};

describe("docs/monitor/dashboard", () => {
  it("createMonitorMiddleware mounts with shared store", () => {
    const store = new MemoryAdapter();
    const middleware = createMonitorMiddleware(store, { basePath: "/monitor" });

    expect(typeof middleware).toBe("function");

    const app = makeExpressStub();
    app.use(middleware);

    expect(app.used.length).toBe(1);
    expect(typeof app.used[0].handler).toBe("function");
  });

  it("createMonitoringRouter returns GET/POST handlers", () => {
    const adapter = new PrismaAdapter({
      monitoring_events: {
        create: async () => ({}),
        findMany: async () => [],
        count: async () => 0,
        aggregate: async () => ({ _sum: { cost: 0 } })
      }
    } as any);

    const router = createMonitoringRouter(adapter, { basePath: "/api/monitor" });

    expect(router.GET).toBeDefined();
    expect(router.POST).toBeDefined();
    expect(typeof router.GET).toBe("function");
    expect(typeof router.POST).toBe("function");
  });

  it("Monitor works with middleware-style constructor", () => {
    const store = new MemoryAdapter();
    const monitor = new Monitor({ store });

    expect(monitor.name).toBe("NodeLLMMonitor");
    expect(typeof monitor.onRequest).toBe("function");
    expect(typeof monitor.onResponse).toBe("function");
  });
});
