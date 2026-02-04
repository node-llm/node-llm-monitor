import { MetricsData } from '../types';
import { MetricsChart } from './MetricsChart';

interface TokenAnalyticsProps {
  metrics: MetricsData | null;
  loading?: boolean;
}

/**
 * Format large numbers with K/M suffixes
 */
function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return count.toFixed(0);
}

/**
 * Token Analytics Panel
 * 
 * Displays:
 * - Input/Output token totals with visual breakdown
 * - Token usage over time chart
 * - Cost per 1K tokens by provider
 * - Token efficiency metrics (output/input ratio)
 */
export function TokenAnalytics({ metrics, loading }: TokenAnalyticsProps) {
  if (loading || !metrics) {
    return (
      <div className="glass rounded-2xl border border-monitor-border p-6 animate-pulse">
        <div className="h-6 bg-monitor-border rounded w-1/4 mb-6" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="h-24 bg-monitor-border rounded-xl" />
          <div className="h-24 bg-monitor-border rounded-xl" />
        </div>
        <div className="h-48 bg-monitor-border rounded-xl" />
      </div>
    );
  }

  const { totals, byProvider, timeSeries } = metrics;
  const totalTokens = totals.totalPromptTokens + totals.totalCompletionTokens;
  const efficiency = totals.totalPromptTokens > 0 
    ? (totals.totalCompletionTokens / totals.totalPromptTokens) 
    : 0;
  const costPer1k = totalTokens > 0 
    ? (totals.totalCost / totalTokens) * 1000 
    : 0;

  // Combine token time series for stacked visualization (for future use)
  // const combinedTokenSeries = combineTokenSeries(
  //   timeSeries.promptTokens || [],
  //   timeSeries.completionTokens || []
  // );

  return (
    <div className="space-y-6">
      {/* Token Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <TokenCard
          label="Total Tokens"
          value={formatTokenCount(totalTokens)}
          subValue={`${formatTokenCount(totals.avgTokensPerRequest)} avg/req`}
          icon="🎯"
          color="purple"
        />
        <TokenCard
          label="Input Tokens"
          value={formatTokenCount(totals.totalPromptTokens)}
          subValue={`${((totals.totalPromptTokens / Math.max(totalTokens, 1)) * 100).toFixed(0)}% of total`}
          icon="📥"
          color="blue"
        />
        <TokenCard
          label="Output Tokens"
          value={formatTokenCount(totals.totalCompletionTokens)}
          subValue={`${((totals.totalCompletionTokens / Math.max(totalTokens, 1)) * 100).toFixed(0)}% of total`}
          icon="📤"
          color="green"
        />
        <TokenCard
          label="Efficiency Ratio"
          value={efficiency.toFixed(2)}
          subValue="output/input"
          icon="⚡"
          color={efficiency > 1 ? 'green' : efficiency > 0.5 ? 'yellow' : 'red'}
        />
      </div>

      {/* Token Breakdown Visualization */}
      <div className="glass rounded-2xl border border-monitor-border p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">📊 Token Breakdown</h3>
        <TokenBreakdownBar 
          promptTokens={totals.totalPromptTokens} 
          completionTokens={totals.totalCompletionTokens} 
        />
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-gray-600">Input: {formatTokenCount(totals.totalPromptTokens)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-gray-600">Output: {formatTokenCount(totals.totalCompletionTokens)}</span>
          </div>
        </div>
      </div>

      {/* Token Usage Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MetricsChart
          title="Input Tokens"
          data={timeSeries.promptTokens || []}
          color="#3b82f6"
          formatter={(v) => formatTokenCount(v)}
          unit=""
        />
        <MetricsChart
          title="Output Tokens"
          data={timeSeries.completionTokens || []}
          color="#22c55e"
          formatter={(v) => formatTokenCount(v)}
          unit=""
        />
      </div>

      {/* Cost Per 1K Tokens by Provider */}
      {byProvider.length > 0 && (
        <div className="glass rounded-2xl border border-monitor-border p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">💰 Cost per 1K Tokens by Provider</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-monitor-border">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Provider / Model</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Input</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Output</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Total</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">$/1K</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {byProvider.map((provider) => {
                  const providerTotalTokens = provider.promptTokens + provider.completionTokens;
                  const providerEfficiency = provider.promptTokens > 0 
                    ? provider.completionTokens / provider.promptTokens 
                    : 0;
                  return (
                    <tr key={`${provider.provider}/${provider.model}`} className="border-b border-monitor-border/50 hover:bg-gray-50/50">
                      <td className="py-2 px-3">
                        <span className="font-medium text-gray-900">{provider.provider}</span>
                        <span className="text-gray-500"> / {provider.model}</span>
                      </td>
                      <td className="text-right py-2 px-3 text-blue-600 font-mono">
                        {formatTokenCount(provider.promptTokens)}
                      </td>
                      <td className="text-right py-2 px-3 text-green-600 font-mono">
                        {formatTokenCount(provider.completionTokens)}
                      </td>
                      <td className="text-right py-2 px-3 text-gray-900 font-mono">
                        {formatTokenCount(providerTotalTokens)}
                      </td>
                      <td className="text-right py-2 px-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          provider.costPer1kTokens < 0.01 
                            ? 'bg-green-100 text-green-700'
                            : provider.costPer1kTokens < 0.05
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          ${provider.costPer1kTokens.toFixed(4)}
                        </span>
                      </td>
                      <td className="text-right py-2 px-3 text-gray-600 font-mono">
                        {providerEfficiency.toFixed(2)}x
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="glass rounded-2xl border border-monitor-border p-6 bg-gradient-to-r from-purple-50/50 to-blue-50/50">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">📈 Token Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Avg Cost/1K Tokens</p>
            <p className="text-lg font-semibold text-purple-600">${costPer1k.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-gray-500">Tokens per Request</p>
            <p className="text-lg font-semibold text-blue-600">{formatTokenCount(totals.avgTokensPerRequest)}</p>
          </div>
          <div>
            <p className="text-gray-500">Total Requests</p>
            <p className="text-lg font-semibold text-gray-900">{totals.totalRequests}</p>
          </div>
          <div>
            <p className="text-gray-500">Est. Cost</p>
            <p className="text-lg font-semibold text-amber-600">${totals.totalCost.toFixed(4)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Individual token metric card
 */
interface TokenCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: string;
  color: 'purple' | 'blue' | 'green' | 'yellow' | 'red';
}

function TokenCard({ label, value, subValue, icon, color }: TokenCardProps) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    red: 'bg-red-50 border-red-200 text-red-700'
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subValue && <p className="text-xs opacity-75 mt-1">{subValue}</p>}
    </div>
  );
}

/**
 * Visual breakdown bar showing input vs output tokens
 */
interface TokenBreakdownBarProps {
  promptTokens: number;
  completionTokens: number;
}

function TokenBreakdownBar({ promptTokens, completionTokens }: TokenBreakdownBarProps) {
  const total = promptTokens + completionTokens;
  if (total === 0) {
    return (
      <div className="h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm text-gray-500">
        No token data
      </div>
    );
  }

  const promptPercent = (promptTokens / total) * 100;
  const completionPercent = (completionTokens / total) * 100;

  return (
    <div className="h-8 bg-gray-100 rounded-full overflow-hidden flex">
      <div 
        className="bg-blue-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
        style={{ width: `${promptPercent}%` }}
      >
        {promptPercent > 15 && `${promptPercent.toFixed(0)}%`}
      </div>
      <div 
        className="bg-green-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
        style={{ width: `${completionPercent}%` }}
      >
        {completionPercent > 15 && `${completionPercent.toFixed(0)}%`}
      </div>
    </div>
  );
}

// Future: Combine prompt and completion token series for stacked chart
// function combineTokenSeries(prompt: TimeSeriesPoint[], completion: TimeSeriesPoint[]): TimeSeriesPoint[] {
//   const combined = new Map<number, number>();
//   for (const p of prompt) combined.set(p.timestamp, (combined.get(p.timestamp) || 0) + p.value);
//   for (const c of completion) combined.set(c.timestamp, (combined.get(c.timestamp) || 0) + c.value);
//   return Array.from(combined.entries()).sort((a, b) => a[0] - b[0]).map(([timestamp, value]) => ({ timestamp, value }));
// }
