import { describe, it, expect } from "vitest";
import { Monitor, cleanTags } from "../src/Monitor.js";
import { MemoryAdapter } from "../src/adapters/memory/MemoryAdapter.js";
import { MonitorDashboard, tagsFromQuery } from "../src/ui/index.js";
import type { MonitoringEvent } from "../src/types.js";

const call = (
  requestId: string,
  tags: Record<string, string> | undefined,
  cost: number
): MonitoringEvent => ({
  id: `${requestId}-end`,
  eventType: "request.end",
  requestId,
  time: new Date(),
  createdAt: new Date(),
  provider: "openai",
  model: "gpt-4o",
  duration: 100,
  cost,
  payload: { usage: { input_tokens: 10, output_tokens: 5 } },
  ...(tags ? { tags } : {})
});

async function seeded() {
  const store = new MemoryAdapter();
  await store.saveEvent(call("a", { project: "Checkout", env: "staging" }, 1));
  await store.saveEvent(call("b", { project: "Checkout", env: "production" }, 2));
  await store.saveEvent(call("c", { project: "Search" }, 4));
  await store.saveEvent(call("d", undefined, 8));
  return store;
}

describe("tag filters", () => {
  it("tags every call a Monitor records, with a call's own tags added on top", async () => {
    const store = new MemoryAdapter();
    const monitor = new Monitor({ store, tags: { service: "billing", env: "staging" } });
    await monitor.onRequest({
      requestId: "r1",
      provider: "openai",
      model: "gpt-4o",
      state: {},
      options: { monitorTags: { project: "Checkout", env: "production" } }
    } as any);

    const [event] = await store.getEvents("r1");
    expect(event?.tags).toEqual({ service: "billing", env: "production", project: "Checkout" });
  });

  it("keeps tags as short plain strings and drops empty ones", () => {
    expect(cleanTags({ project: 42, empty: "", none: null, long: "x".repeat(300) })).toEqual({
      project: "42",
      long: "x".repeat(200)
    });
    expect(cleanTags({})).toBeUndefined();
  });

  it("filters stats, metrics and traces by every given tag", async () => {
    const store = await seeded();

    expect((await store.getStats({ tags: { project: "Checkout" } })).totalCost).toBe(3);
    expect(
      (await store.getStats({ tags: { project: "Checkout", env: "staging" } })).totalCost
    ).toBe(1);
    expect((await store.getMetrics({ tags: { project: "Search" } })).totals.totalRequests).toBe(1);

    const traces = await store.listTraces({ tags: { project: "Checkout" } });
    expect(traces.items.map((t) => t.requestId).sort()).toEqual(["a", "b"]);
    expect(traces.items[0]?.tags?.project).toBe("Checkout");
  });

  it("lists each tag key with its values", async () => {
    expect(await (await seeded()).listTags()).toEqual({
      env: ["production", "staging"],
      project: ["Checkout", "Search"]
    });
  });

  it("reads tag filters from the query string", () => {
    expect(
      tagsFromQuery(new URLSearchParams("tag.project=Checkout&tag.env=staging&from=x&tag.=y"))
    ).toEqual({
      project: "Checkout",
      env: "staging"
    });
    expect(tagsFromQuery(new URLSearchParams("from=x"))).toBeUndefined();
  });

  it("answers /api/tags and filters /api/stats by tag", async () => {
    const dashboard = new MonitorDashboard(await seeded());
    const get = async (url: string) => {
      let body = "";
      await dashboard.handleRequest(
        { url, method: "GET", headers: {} },
        {
          writeHead: () => undefined,
          end: (chunk?: string | Buffer) => {
            body = chunk?.toString() ?? "";
          }
        }
      );
      return JSON.parse(body);
    };

    expect((await get("/monitor/api/tags")).project).toEqual(["Checkout", "Search"]);
    expect((await get("/monitor/api/stats?tag.project=Search")).totalCost).toBe(4);
  });
});
