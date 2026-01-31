import type { MonitoringStore, CorsConfig } from "../types.js";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/**
 * Minimal request interface for framework portability.
 * Adapters should map their framework's request to this shape.
 */
export interface MonitorRequest {
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
}

/**
 * Minimal response interface for framework portability.
 * Adapters should map their framework's response to this shape.
 */
export interface MonitorResponse {
  writeHead(code: number, headers?: Record<string, string>): void;
  end(body?: string | Buffer): void;
}

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
};

export interface MonitorDashboardOptions {
  /** Base path for mounting the dashboard. Default: "/monitor" */
  basePath?: string;
  /** Path to the static dashboard build folder */
  staticDir?: string;
  /** 
   * CORS configuration for API endpoints.
   * - false: same-origin only (default, recommended for embedded dashboards)
   * - true: allow all origins
   * - string: specific origin
   * - string[]: multiple allowed origins
   */
  cors?: CorsConfig;
  /** Polling interval in milliseconds for the fallback UI. Default: 5000 */
  pollInterval?: number;
}

export class MonitorDashboard {
  private readonly basePath: string;
  private readonly apiBase: string;
  private readonly staticDir: string;
  private readonly cors: CorsConfig;
  private readonly pollInterval: number;

  constructor(
    private store: MonitoringStore,
    options: MonitorDashboardOptions = {}
  ) {
    this.basePath = options.basePath ?? "/monitor";
    // API routes are nested under basePath to avoid collisions
    this.apiBase = `${this.basePath}/api`;
    // Default to looking for dashboard build in package
    this.staticDir = options.staticDir ?? join(__dirname, "../../dashboard/build");
    // CORS: same-origin by default (safer for embedded dashboards)
    this.cors = options.cors ?? false;
    this.pollInterval = options.pollInterval ?? 5000;
  }

  async handleRequest(req: MonitorRequest, res: MonitorResponse): Promise<boolean> {
    const host = Array.isArray(req.headers?.host) ? req.headers.host[0] : req.headers?.host;
    const url = new URL(req.url || "", `http://${host || "localhost"}`);
    const pathname = url.pathname;

    // Parse time range from query params
    const fromParam = url.searchParams.get("from");
    const from = fromParam ? new Date(fromParam) : undefined;
    const timeFilter = from ? { from } : {};

    // API Routes (nested under basePath)
    if (pathname === `${this.apiBase}/stats`) {
      try {
        const stats = await this.store.getStats(timeFilter);
        this.sendJson(res, stats, req);
      } catch (error) {
        this.sendError(res, "Failed to get stats", 500);
      }
      return true;
    }

    if (pathname === `${this.apiBase}/metrics`) {
      try {
        // Check if store supports getMetrics, otherwise build from getStats
        if (typeof this.store.getMetrics === 'function') {
          const metrics = await this.store.getMetrics(timeFilter);
          this.sendJson(res, metrics, req);
        } else {
          // Fallback: build metrics from stats
          const stats = await this.store.getStats(timeFilter);
          const metrics = {
            totals: stats,
            byProvider: [],
            timeSeries: {
              requests: [],
              cost: [],
              duration: [],
              errors: [],
            },
          };
          this.sendJson(res, metrics, req);
        }
      } catch (error) {
        this.sendError(res, "Failed to get metrics", 500);
      }
      return true;
    }

    if (pathname === `${this.apiBase}/traces`) {
      // Guard: check if store supports listTraces
      if (typeof this.store.listTraces !== 'function') {
        this.sendJson(res, { items: [], total: 0, limit: 50, offset: 0 }, req);
        return true;
      }
      try {
        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        const traces = await this.store.listTraces({ limit, offset });
        this.sendJson(res, traces, req);
      } catch (error) {
        this.sendError(res, "Failed to get traces", 500);
      }
      return true;
    }

    if (pathname === `${this.apiBase}/events`) {
      const requestId = url.searchParams.get("requestId");
      if (!requestId) {
        this.sendError(res, "Missing requestId", 400);
        return true;
      }
      // Guard: check if store supports getEvents
      if (typeof this.store.getEvents !== 'function') {
        this.sendJson(res, [], req);
        return true;
      }
      try {
        const events = await this.store.getEvents(requestId);
        this.sendJson(res, events, req);
      } catch (error) {
        this.sendError(res, "Failed to get events", 500);
      }
      return true;
    }

    // Serve Dashboard static files
    if (pathname === this.basePath || pathname === `${this.basePath}/`) {
      return this.serveStaticFile(res, "index.html");
    }

    if (pathname.startsWith(`${this.basePath}/`)) {
      const filePath = pathname.slice(this.basePath.length + 1) || "index.html";
      return this.serveStaticFile(res, filePath);
    }

    return false;
  }

  private async serveStaticFile(res: MonitorResponse, filePath: string): Promise<boolean> {
    // Security: prevent directory traversal
    const sanitizedPath = filePath.replace(/\.\./g, "").replace(/^\//, "");
    const fullPath = join(this.staticDir, sanitizedPath);

    // Check if file exists
    if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
      // For SPA routing, serve index.html for non-asset routes
      const indexPath = join(this.staticDir, "index.html");
      if (existsSync(indexPath)) {
        return this.serveFile(res, indexPath, ".html");
      }
      
      // Fallback: serve simple message if static build not available
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(this.getFallbackHtml());
      return true;
    }

    const ext = extname(fullPath).toLowerCase();
    return this.serveFile(res, fullPath, ext);
  }

  private async serveFile(res: MonitorResponse, fullPath: string, ext: string): Promise<boolean> {
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    
    try {
      const content = await readFile(fullPath);
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
      });
      res.end(content);
      return true;
    } catch (error) {
      this.sendError(res, "File not found", 404);
      return true;
    }
  }

  private sendJson(res: MonitorResponse, data: unknown, req?: MonitorRequest) {
    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
    };
    
    // Apply CORS headers based on configuration
    const corsHeaders = this.getCorsHeaders(req);
    Object.assign(headers, corsHeaders);
    
    res.writeHead(200, headers);
    res.end(JSON.stringify(data));
  }

  private sendError(res: MonitorResponse, message: string, code: number) {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: message }));
  }

  private getCorsHeaders(req?: MonitorRequest): Record<string, string> {
    if (this.cors === false) {
      // Same-origin only, no CORS headers needed
      return {};
    }
    
    if (this.cors === true) {
      return { "Access-Control-Allow-Origin": "*" };
    }
    
    if (typeof this.cors === "string") {
      return { "Access-Control-Allow-Origin": this.cors };
    }
    
    if (Array.isArray(this.cors)) {
      const origin = Array.isArray(req?.headers?.origin) 
        ? req.headers.origin[0] 
        : req?.headers?.origin;
      if (origin && this.cors.includes(origin)) {
        return { "Access-Control-Allow-Origin": origin };
      }
      return {};
    }
    
    // Object config with origin and credentials
    const config = this.cors;
    const origin = Array.isArray(req?.headers?.origin) 
      ? req.headers.origin[0] 
      : req?.headers?.origin;
    const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin];
    
    if (origin && allowedOrigins.includes(origin)) {
      const headers: Record<string, string> = { "Access-Control-Allow-Origin": origin };
      if (config.credentials) {
        headers["Access-Control-Allow-Credentials"] = "true";
      }
      return headers;
    }
    
    return {};
  }

  /**
   * Fallback HTML when static build is not available.
   * For production, build the dashboard with `pnpm build` in the dashboard folder.
   */
  private getFallbackHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NodeLLM Monitor</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0a0a0f;
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 2rem;
      max-width: 500px;
    }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; }
    p { color: #888; line-height: 1.6; margin-bottom: 1.5rem; }
    code {
      background: #1a1a2e;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      display: block;
      font-size: 0.875rem;
      color: #a5b4fc;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    a { color: #6366f1; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📊</div>
    <h1>Dashboard Build Not Found</h1>
    <p>
      The monitoring dashboard UI has not been built yet.
      To enable the full dashboard, run:
    </p>
    <code>cd dashboard && pnpm install && pnpm build</code>
    <p style="margin-top: 1.5rem; font-size: 0.875rem;">
      API endpoints are available at:<br>
      <a href="${this.apiBase}/stats">${this.apiBase}/stats</a> · 
      <a href="${this.apiBase}/metrics">${this.apiBase}/metrics</a> · 
      <a href="${this.apiBase}/traces">${this.apiBase}/traces</a>
    </p>
  </div>
</body>
</html>`;
  }
}

/**
 * Express/Connect compatible middleware factory.
 * 
 * @example
 * ```ts
 * app.use(createMonitorMiddleware(store, { basePath: '/monitor' }));
 * ```
 */
export function createMonitorMiddleware(store: MonitoringStore, options?: MonitorDashboardOptions) {
  const dashboard = new MonitorDashboard(store, options);
  
  // Using broader types for framework compatibility (Express, Fastify, etc.)
  return async (
    req: MonitorRequest, 
    res: MonitorResponse, 
    next?: () => void
  ) => {
    const handled = await dashboard.handleRequest(req, res);
    if (!handled && next) {
      next();
    }
  };
}

/**
 * Factory for Next.js API route handlers.
 * 
 * @example
 * ```ts
 * // app/api/monitor/[...path]/route.ts
 * import { createMonitoringRouter } from 'node-llm-monitor/ui';
 * export const { GET, POST } = createMonitoringRouter(store, { basePath: '/api/monitor' });
 * ```
 */
export function createMonitoringRouter(store: MonitoringStore, options?: MonitorDashboardOptions) {
  const dashboard = new MonitorDashboard(store, options);
  
  return {
    async GET(req: Request) {
      const url = new URL(req.url);
      const mockRes = createMockResponse();
      
      // Adapt Web Request to MonitorRequest
      const mockReq: MonitorRequest = {
        url: url.pathname + url.search,
        headers: { 
          host: url.host,
          origin: req.headers.get("origin") ?? undefined,
        },
        method: req.method,
      };
      
      await dashboard.handleRequest(mockReq, mockRes);
      
      return new Response(mockRes._body, {
        status: mockRes._statusCode,
        headers: mockRes._headers,
      });
    },
    
    async POST(req: Request) {
      // For future event ingestion endpoint
      return new Response(JSON.stringify({ error: "Not implemented" }), {
        status: 501,
        headers: { "Content-Type": "application/json" },
      });
    },
  };
}

interface MockResponse extends MonitorResponse {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: string | Buffer;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    _statusCode: 200,
    _headers: {},
    _body: "",
    
    writeHead(code: number, headers?: Record<string, string>) {
      res._statusCode = code;
      if (headers) {
        Object.assign(res._headers, headers);
      }
    },
    
    end(body?: string | Buffer) {
      res._body = body ?? "";
    },
  };
  
  return res;
}
