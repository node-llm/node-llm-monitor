import type { MonitoringStore } from "../types.js";
import dashboardHtml from "./dashboard.html";

export class MonitorDashboard {
  constructor(private store: MonitoringStore) {}

  async handleRequest(req: any, res: any): Promise<boolean> {
    const url = new URL(req.url || "", `http://${req.headers?.host || "localhost"}`);
    
    // API Routes
    if (url.pathname === "/api/monitor/stats") {
      const stats = await this.store.getStats();
      this.sendJson(res, stats);
      return true;
    }

    if (url.pathname === "/api/monitor/traces") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const traces = await this.store.listTraces({ limit });
      this.sendJson(res, traces);
      return true;
    }

    if (url.pathname === "/api/monitor/events") {
      const requestId = url.searchParams.get("requestId");
      if (!requestId) {
        this.sendError(res, "Missing requestId", 400);
        return true;
      }
      const events = await this.store.getEvents(requestId);
      this.sendJson(res, events);
      return true;
    }

    // Serve Dashboard HTML
    if (url.pathname === "/monitor" || url.pathname === "/monitor/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(this.getDashboardHtml());
      return true;
    }

    return false;
  }

  private sendJson(res: any, data: any) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }

  private sendError(res: any, message: string, code: number) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }

  private getDashboardHtml(): string {
    return dashboardHtml;
  }
}
