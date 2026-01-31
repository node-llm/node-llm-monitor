import { TraceSummary } from '../types';

interface TraceListProps {
  traces: TraceSummary[];
  selectedId: string | null;
  onSelect: (trace: TraceSummary) => void;
  loading?: boolean;
}

export function TraceList({ traces, selectedId, onSelect, loading }: TraceListProps) {
  if (loading) {
    return (
      <div className="glass rounded-2xl border border-monitor-border p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-monitor-border rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="glass rounded-2xl border border-monitor-border p-12 text-center">
        <span className="text-4xl mb-4 block">🔍</span>
        <p className="text-gray-400">No traces yet</p>
        <p className="text-gray-500 text-sm mt-1">Traces will appear here as LLM requests are made</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-monitor-border overflow-hidden">
      <div className="p-4 border-b border-monitor-border">
        <h2 className="text-sm font-semibold text-white">Recent Traces</h2>
        <p className="text-xs text-gray-500 mt-0.5">{traces.length} requests</p>
      </div>
      
      <div className="divide-y divide-monitor-border max-h-[600px] overflow-y-auto">
        {traces.map((trace) => (
          <TraceRow 
            key={trace.requestId} 
            trace={trace} 
            isSelected={selectedId === trace.requestId}
            onClick={() => onSelect(trace)}
          />
        ))}
      </div>
    </div>
  );
}

interface TraceRowProps {
  trace: TraceSummary;
  isSelected: boolean;
  onClick: () => void;
}

function TraceRow({ trace, isSelected, onClick }: TraceRowProps) {
  const statusConfig = {
    success: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', label: 'Success' },
    error: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', label: 'Error' },
    running: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20', label: 'Running' },
  };

  const status = statusConfig[trace.status];
  const time = new Date(trace.startTime);

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 text-left hover:bg-white/5 transition-colors ${
        isSelected ? 'bg-monitor-accent/10 border-l-2 border-l-monitor-accent' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${status.bg} ${status.text} border ${status.border}`}>
            {status.label}
          </span>
          <span className="text-xs text-gray-400 font-mono">{trace.provider}</span>
        </div>
        <span className="text-[10px] text-gray-500">
          {time.toLocaleTimeString()}
        </span>
      </div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white truncate max-w-[200px]">
          {trace.model}
        </span>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {trace.duration && (
            <span className="flex items-center gap-1">
              <span className="text-gray-500">⏱</span>
              {trace.duration.toFixed(0)}ms
            </span>
          )}
          {trace.cost !== undefined && trace.cost > 0 && (
            <span className="flex items-center gap-1">
              <span className="text-gray-500">💰</span>
              ${trace.cost.toFixed(4)}
            </span>
          )}
        </div>
      </div>
      
      <div className="mt-2 text-[10px] text-gray-500 font-mono truncate">
        {trace.requestId}
      </div>
    </button>
  );
}
