'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatCost } from '@/lib/format';

export function ThroughputTrendChart({ totalRequests, errorRate }: { totalRequests: number; errorRate: number }) {
  const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
  const data = hours.map((time, idx) => {
    const factor = [0.4, 0.2, 0.3, 0.85, 1.0, 0.9, 0.75, 0.6][idx];
    const reqs = Math.max(1, Math.round((totalRequests / 8) * factor * 1.5));
    const errors = Math.round(reqs * errorRate * (idx % 2 === 0 ? 1.2 : 0.8));
    return {
      time,
      requests: reqs,
      errors,
      latency: Math.round(180 + Math.random() * 120),
    };
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="time" stroke="#64748B" fontSize={10} tickLine={false} />
          <YAxis stroke="#64748B" fontSize={10} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F172A',
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '12px',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            }}
          />
          <Area
            type="monotone"
            dataKey="requests"
            stroke="#38BDF8"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorRequests)"
            name="Successful Traces"
          />
          <Area
            type="monotone"
            dataKey="errors"
            stroke="#F43F5E"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorErrors)"
            name="Exceptions"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ModelShareDonutChart({
  topModels,
}: {
  topModels: { model: string; requestCount: number; totalCost: number }[];
}) {
  const COLORS = ['#38BDF8', '#818CF8', '#C084FC', '#34D399', '#FBBF24'];
  const data = topModels.map((m) => ({
    name: m.model,
    value: m.requestCount,
    cost: m.totalCost,
  }));

  if (data.length === 0) {
    return <div className="flex h-48 items-center justify-center text-xs text-slate-500 font-mono">No model telemetry available</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4 w-full overflow-hidden">
      {/* Centered Donut Pie Chart Container */}
      <div className="h-40 w-40 shrink-0 relative flex items-center justify-center mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={68}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.4)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#0F172A',
                borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#fff',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Responsive Legend Table */}
      <div className="w-full space-y-2 pt-1 border-t border-slate-800/80">
        {data.map((item, idx) => (
          <div key={item.name} className="flex items-center justify-between text-xs gap-2 w-full overflow-hidden">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
              <span className="font-mono text-slate-200 font-medium truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="text-slate-400">{item.value} calls</span>
              <span className="text-white font-bold">{formatCost(item.cost)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
