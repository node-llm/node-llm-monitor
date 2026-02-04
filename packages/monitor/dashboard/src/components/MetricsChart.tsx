import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TimeSeriesPoint } from '../types';

interface MetricsChartProps {
  title: string;
  data: TimeSeriesPoint[];
  color: string;
  formatter?: (value: number) => string;
  unit?: string;
}

export function MetricsChart({ title, data, color, formatter, unit }: MetricsChartProps) {
  // Transform data for recharts
  const chartData = data.map((point) => ({
    time: point.timestamp,
    value: point.value,
    formattedTime: new Date(point.timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
  }));

  const formatValue = formatter || ((v: number) => v.toLocaleString());

  return (
    <div className="glass rounded-2xl border border-monitor-border p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="h-[200px]">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="formattedTime"
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={{ stroke: '#e5e7eb' }}
                tickFormatter={formatValue}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                labelStyle={{ color: '#4b5563', fontSize: 12 }}
                itemStyle={{ color: color }}
                formatter={(value: number) => [formatValue(value) + (unit || ''), title]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
