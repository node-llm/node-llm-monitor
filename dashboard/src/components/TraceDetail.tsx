import { MonitoringEvent, TraceSummary } from '../types';

interface TraceDetailProps {
  trace: TraceSummary | null;
  events: MonitoringEvent[];
  onClose: () => void;
  loading?: boolean;
}

export function TraceDetail({ trace, events, onClose, loading }: TraceDetailProps) {
  if (!trace) {
    return (
      <div className="glass rounded-2xl border border-dashed border-monitor-border p-12 text-center text-gray-700 flex flex-col items-center justify-center h-full min-h-[400px]">
        <span className="text-4xl mb-4">🔍</span>
        <p className="font-medium">Select a trace to view details</p>
        <p className="text-sm text-gray-600 mt-1">Click on any trace from the list</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass rounded-2xl border border-monitor-border p-6 animate-pulse">
        <div className="h-6 bg-monitor-border rounded w-1/3 mb-6" />
        <div className="space-y-4">
          <div className="h-20 bg-monitor-border rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-16 bg-monitor-border rounded-xl" />
            <div className="h-16 bg-monitor-border rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = {
    success: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    error: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    running: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  };

  const status = statusConfig[trace.status];

  return (
    <div className="glass rounded-2xl border border-monitor-border glow p-6 sticky top-24 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Trace Detail</h2>
        <button 
          onClick={onClose} 
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Provider & Model */}
        <div className="p-4 bg-gray-50/50 rounded-xl border border-monitor-border">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Provider / Model</p>
          <p className="text-sm font-medium text-gray-900">{trace.provider} / {trace.model}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${status.bg} ${status.text} border ${status.border}`}>
              {trace.status.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <MetricBox label="Duration" value={`${(trace.duration || 0).toFixed(0)}ms`} icon="⏱" />
          <MetricBox label="Cost" value={`$${(trace.cost || 0).toFixed(4)}`} icon="💰" />
          <MetricBox label="CPU Time" value={`${(trace.cpuTime || 0).toFixed(2)}ms`} icon="🔧" />
          <MetricBox 
            label="Memory" 
            value={`${((trace.allocations || 0) / 1024 / 1024).toFixed(2)}MB`} 
            icon="📊" 
          />
        </div>

        {/* Request ID */}
        <div className="p-3 bg-gray-50/50 rounded-xl border border-monitor-border">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Request ID</p>
          <p className="text-xs font-mono text-gray-600 break-all">{trace.requestId}</p>
        </div>

        {/* Execution Flow */}
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Execution Flow</p>
          <div className="space-y-1">
            {events.map((event, index) => (
              <EventRow key={event.id} event={event} isLast={index === events.length - 1} />
            ))}
          </div>
        </div>

        {/* Error Display */}
        {trace.status === 'error' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-[10px] text-red-700 uppercase tracking-wider font-bold mb-2">Error Detected</p>
            <p className="text-sm text-red-800">
              {events.find(e => e.eventType === 'request.error')?.payload?.error || 'Unknown error'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface MetricBoxProps {
  label: string;
  value: string;
  icon: string;
}

function MetricBox({ label, value, icon }: MetricBoxProps) {
  return (
    <div className="p-3 bg-gray-50/50 rounded-xl border border-monitor-border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <span className="text-sm">{icon}</span>
      </div>
      <p className="text-sm font-medium text-monitor-accent">{value}</p>
    </div>
  );
}

interface EventRowProps {
  event: MonitoringEvent;
  isLast: boolean;
}

function EventRow({ event, isLast }: EventRowProps) {
  const eventConfig: Record<string, { icon: string; color: string }> = {
    'request.start': { icon: '▶️', color: 'text-blue-600' },
    'request.end': { icon: '✅', color: 'text-green-600' },
    'request.error': { icon: '❌', color: 'text-red-600' },
    'tool.start': { icon: '🔧', color: 'text-yellow-600' },
    'tool.end': { icon: '✓', color: 'text-green-600' },
    'tool.error': { icon: '⚠️', color: 'text-red-600' },
  };

  const config = eventConfig[event.eventType] || { icon: '•', color: 'text-gray-400' };
  const time = new Date(event.time);
  const toolName = event.payload?.toolCall?.function?.name;

  return (
    <div className={`flex items-start gap-3 text-xs pl-4 py-2 relative ${
      !isLast ? 'border-l-2 border-monitor-border' : ''
    }`}>
      <div className={`w-6 h-6 rounded-full bg-monitor-card border-2 border-monitor-border flex items-center justify-center -ml-[15px] text-[10px]`}>
        {config.icon}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`font-medium ${config.color}`}>{event.eventType}</p>
          <p className="text-[10px] text-gray-500">{time.toLocaleTimeString()}</p>
        </div>
        
        {toolName && (
          <div className="mt-1 p-2 bg-yellow-50 rounded text-yellow-800 font-mono text-[10px] border border-yellow-200">
            Tool: {toolName}
          </div>
        )}
        
        {event.duration && (
          <p className="text-[10px] text-gray-500 mt-1">Duration: {event.duration.toFixed(0)}ms</p>
        )}
      </div>
    </div>
  );
}
