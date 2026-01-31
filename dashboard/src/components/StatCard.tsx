interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color?: 'default' | 'success' | 'error' | 'warning';
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
}

const colorMap = {
  default: 'text-white',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
};

export function StatCard({ label, value, icon, color = 'default', change }: StatCardProps) {
  return (
    <div className="glass p-5 rounded-2xl glow hover:border-monitor-accent/30 transition-all border border-monitor-border animate-fade-in">
      <div className="flex justify-between items-start mb-3">
        <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      
      <div className={`text-2xl font-semibold ${colorMap[color]}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      
      {change && (
        <div className={`flex items-center gap-1 mt-2 text-xs ${
          change.trend === 'up' ? 'text-green-400' : 'text-red-400'
        }`}>
          <span>{change.trend === 'up' ? '↑' : '↓'}</span>
          <span>{Math.abs(change.value)}%</span>
          <span className="text-gray-500">vs last hour</span>
        </div>
      )}
    </div>
  );
}
