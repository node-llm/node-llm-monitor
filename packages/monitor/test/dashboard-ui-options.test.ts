import { describe, it, expect } from "vitest";
import { injectDashboardConfig, scriptJson, MonitorDashboard } from "../src/ui/index.js";
import { MemoryAdapter } from "../src/adapters/memory/MemoryAdapter.js";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const page = "<!DOCTYPE html><html><head><title>NodeLLM Monitor</title></head><body></body></html>";

describe("dashboard UI options", () => {
  it("injects the host's UI options as window.__MONITOR_UI__", () => {
    const html = injectDashboardConfig(page, {
      ui: { title: "AI monitor", accentColor: "#f2a93b", hideGithubLink: true }
    });
    expect(html).toContain(
      '<head><script>window.__MONITOR_UI__ = {"title":"AI monitor","accentColor":"#f2a93b","hideGithubLink":true};</script>'
    );
  });

  it("injects i18n and UI options together, and leaves the page alone without options", () => {
    const html = injectDashboardConfig(page, { i18n: { lng: "en" }, ui: { theme: "dark" } });
    expect(html).toMatch(/__MONITOR_I18N__.*__MONITOR_UI__/);
    expect(injectDashboardConfig(page, {})).toBe(page);
  });

  it("can't be used to close the script tag or add markup", () => {
    const json = scriptJson({ context: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("</script>");
    expect(JSON.parse(json)).toEqual({ context: "</script><script>alert(1)</script>" });
  });

  it("serves the dashboard page with the UI options", async () => {
    const dir = await mkdtemp(join(tmpdir(), "monitor-ui-"));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), page);
    const dashboard = new MonitorDashboard(new MemoryAdapter(), {
      staticDir: dir,
      ui: { title: "Qadet AI monitor", context: "Acme" }
    });

    let body = "";
    const handled = await dashboard.handleRequest(
      { url: "/monitor/", method: "GET", headers: {} },
      {
        writeHead: () => undefined,
        end: (chunk?: string | Buffer) => {
          body = chunk?.toString() ?? "";
        }
      }
    );

    expect(handled).toBe(true);
    expect(body).toContain('window.__MONITOR_UI__ = {"title":"Qadet AI monitor","context":"Acme"}');
  });
});
