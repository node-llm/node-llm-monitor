import type { MonitoringStore } from "../types.js";

/**
 * Portable API handler for the monitoring dashboard.
 * Can be used with Express, Fastify, or custom http servers.
 */
export class MonitorDashboard {
  constructor(private store: MonitoringStore) {}

  /**
   * Handle an incoming HTTP request for the monitor API.
   * Returns true if the request was handled, false otherwise.
   */
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
    // We'll return a premium, standalone HTML string using Preact + Tailwind Play CDN
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NodeLLM Monitor</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Outfit', 'sans-serif'],
                        mono: ['JetBrains Mono', 'monospace'],
                    },
                }
            }
        }
    </script>
    <style>
        body { background-color: #030712; color: #f3f4f6; }
        .glass { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .glow { box-shadow: 0 0 20px rgba(79, 70, 229, 0.15); }
        .gradient-text { background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    </style>
</head>
<body class="font-sans min-h-screen">
    <div id="app"></div>

    <script type="module">
        import { h, render } from 'https://esm.sh/preact';
        import { useState, useEffect } from 'https://esm.sh/preact/hooks';
        import htm from 'https://esm.sh/htm';

        const html = htm.bind(h);

        function App() {
            const [stats, setStats] = useState(null);
            const [traces, setTraces] = useState([]);
            const [selectedTrace, setSelectedTrace] = useState(null);
            const [events, setEvents] = useState([]);
            const [loading, setLoading] = useState(true);

            useEffect(() => {
                fetchStats();
                fetchTraces();
                const interval = setInterval(() => {
                    fetchStats();
                    fetchTraces();
                }, 5000);
                return () => clearInterval(interval);
            }, []);

            async function fetchStats() {
                const res = await fetch('/api/monitor/stats');
                setStats(await res.json());
            }

            async function fetchTraces() {
                const res = await fetch('/api/monitor/traces');
                setTraces(await res.json());
                setLoading(false);
            }

            async function viewTrace(trace) {
                setSelectedTrace(trace);
                const res = await fetch('/api/monitor/events?requestId=' + trace.requestId);
                setEvents(await res.json());
            }

            if (loading) return html\`<div class="flex items-center justify-center h-screen"><div class="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div></div>\`;

            return html\`
                <div class="max-w-7xl mx-auto px-6 py-8">
                    <header class="flex justify-between items-center mb-10">
                        <div>
                            <h1 class="text-3xl font-semibold gradient-text">NodeLLM Monitor</h1>
                            <p class="text-gray-400 text-sm mt-1">Infrastructure observability for your LLM apps</p>
                        </div>
                        <div class="flex gap-4">
                            <div class="glass px-4 py-2 rounded-xl text-xs font-medium border-emerald-500/20 text-emerald-400 flex items-center gap-2">
                                <span class="relative flex h-2 w-2">
                                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                System Live
                            </div>
                        </div>
                    </header>

                    <!-- Stats Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                        <StatCard label="Total Requests" value=\${stats?.totalRequests || 0} icon="📊" />
                        <StatCard label="Total Cost" value=\${'$' + (stats?.totalCost || 0).toFixed(4)} icon="💰" />
                        <StatCard label="Avg Duration" value=\${Math.round(stats?.avgDuration || 0) + 'ms'} icon="⚡" />
                        <StatCard label="Error Rate" value=\${(stats?.errorRate || 0).toFixed(1) + '%'} color="text-red-400" icon="⚠️" />
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <!-- Trace List -->
                        <div class="lg:col-span-2">
                            <div class="glass rounded-2xl glow p-1">
                                <table class="w-full text-left text-sm">
                                    <thead>
                                        <tr class="text-gray-400 border-b border-white/5">
                                            <th class="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Trace ID</th>
                                            <th class="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Model</th>
                                            <th class="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Cost</th>
                                            <th class="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Duration</th>
                                            <th class="px-6 py-4 font-medium uppercase tracking-wider text-[10px]">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5">
                                        \${traces.map(trace => html\`
                                            <tr 
                                                class="hover:bg-white/5 transition-colors cursor-pointer \${selectedTrace?.requestId === trace.requestId ? 'bg-indigo-500/10' : ''}"
                                                onclick=\${() => viewTrace(trace)}
                                            >
                                                <td class="px-6 py-4 font-mono text-gray-300 text-xs">\${trace.requestId.slice(0, 13)}...</td>
                                                <td class="px-6 py-4">
                                                    <span class="text-gray-200">\${trace.model}</span>
                                                    <span class="block text-[10px] text-gray-500">\${trace.provider}</span>
                                                </td>
                                                <td class="px-6 py-4 text-gray-300">$\${(trace.cost || 0).toFixed(5)}</td>
                                                <td class="px-6 py-4 text-gray-300">\${trace.duration}ms</td>
                                                <td class="px-6 py-4">
                                                    <span class="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold \${trace.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}">
                                                        \${trace.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        \`)}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- Trace Details -->
                        <div class="lg:col-span-1">
                            \${selectedTrace ? html\`
                                <div class="glass rounded-2xl glow p-6 sticky top-8">
                                    <h2 class="text-lg font-semibold mb-4 flex justify-between items-center">
                                        Trace Detail
                                        <button onclick=\${() => setSelectedTrace(null)} class="text-gray-500 hover:text-white">&times;</button>
                                    </h2>
                                    
                                    <div class="space-y-4">
                                        <div class="p-3 bg-white/5 rounded-xl border border-white/5">
                                            <p class="text-[10px] text-gray-500 uppercase">Provider / Model</p>
                                            <p class="text-sm font-medium">\${selectedTrace.provider} / \${selectedTrace.model}</p>
                                        </div>

                                        <div class="space-y-2">
                                            <p class="text-[10px] text-gray-500 uppercase mb-2">Execution Flow</p>
                                            \${events.map(event => html\`
                                                <div class="flex items-start gap-3 text-xs border-l-2 border-white/10 pl-4 py-1">
                                                    <div class="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 -ml-[21px] border-2 border-gray-900"></div>
                                                    <div>
                                                        <p class="font-medium text-gray-300">\${event.eventType}</p>
                                                        <p class="text-[10px] text-gray-500">\${new Date(event.time).toLocaleTimeString()}</p>
                                                        \${event.eventType.includes('start') && event.payload.toolCall ? html\`
                                                            <div class="mt-1 p-2 bg-indigo-500/5 rounded text-indigo-300 font-mono text-[10px]">
                                                                Tool: \${event.payload.toolCall.function.name}
                                                            </div>
                                                        \` : ''}
                                                    </div>
                                                </div>
                                            \`)}
                                        </div>

                                        \${selectedTrace.status === 'error' ? html\`
                                            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                                                <p class="font-bold uppercase mb-1">Error Detected</p>
                                                <p>\${events.find(e => e.eventType === 'request.error')?.payload.error}</p>
                                            </div>
                                        \` : ''}
                                    </div>
                                </div>
                            \` : html\`
                                <div class="glass rounded-2xl border-dashed border-white/10 p-12 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                                    <span class="text-4xl mb-4">🔍</span>
                                    <p>Select a trace to view deep execution logs</p>
                                </div>
                            \`}
                        </div>
                    </div>
                </div>
            \`;
        }

        function StatCard({ label, value, icon, color = "text-white" }) {
            return html\`
                <div class="glass p-5 rounded-2xl glow hover:border-indigo-500/30 transition-all border border-white/5">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-gray-400 text-xs font-medium uppercase tracking-wider">\${label}</span>
                        <span class="text-xl">\${icon}</span>
                    </div>
                    <div class="text-2xl font-semibold \${color}">\${value}</div>
                </div>
            \`;
        }

        render(html\`<\${App} />\`, document.getElementById('app'));
    </script>
</body>
</html>`;
  }
}
