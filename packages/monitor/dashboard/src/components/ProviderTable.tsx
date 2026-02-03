import type { ProviderStats } from '../types';

interface ProviderTableProps {
  data: ProviderStats[];
  loading?: boolean;
}

export function ProviderTable({ data, loading }: ProviderTableProps) {
  if (loading) {
    return (
      <div className="glass rounded-2xl border border-monitor-border p-6 animate-pulse">
        <div className="h-6 bg-monitor-border rounded w-1/4 mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-monitor-border rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="glass rounded-2xl border border-monitor-border p-8 text-center">
        <p className="text-gray-500">No provider data available</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-monitor-border overflow-hidden">
      <div className="p-4 border-b border-monitor-border">
        <h3 className="text-sm font-semibold text-gray-900">Usage by Provider/Model</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-monitor-border bg-gray-50/50">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider / Model
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Requests
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg Duration
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Errors
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-monitor-border">
            {data.map((row, index) => (
              <tr key={`${row.provider}-${row.model}-${index}`} className="hover:bg-gray-50/50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <ProviderIcon provider={row.provider} />
                    <span className="text-sm text-gray-900 font-medium">
                      {row.provider}/{row.model}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">
                  {row.requests.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right text-sm text-yellow-600 font-medium">
                  ${row.cost.toFixed(4)}
                </td>
                <td className="py-3 px-4 text-right text-sm text-gray-600">
                  {row.avgDuration.toFixed(0)}ms
                </td>
                <td className="py-3 px-4 text-right">
                  {row.errorCount > 0 ? (
                    <span className="text-sm text-red-600 font-medium">{row.errorCount}</span>
                  ) : (
                    <span className="text-sm text-green-600 font-medium">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  const icons: Record<string, string> = {
    openai: '🤖',
    anthropic: '🧠',
    google: '🔮',
    mistral: '🌪️',
    cohere: '💬',
    default: '⚡',
  };

  return (
    <span className="text-lg" title={provider}>
      {icons[provider.toLowerCase()] || icons.default}
    </span>
  );
}
