import { ReactNode } from 'react';

export function StatCard({
  label,
  value,
  sublabel,
  trend,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  sublabel?: string;
  trend?: { value: string; positive?: boolean };
  icon?: ReactNode;
  tone?: 'default' | 'error' | 'ok' | 'accent';
}) {
  const valueColor =
    tone === 'error'
      ? 'text-error'
      : tone === 'ok'
      ? 'text-ok'
      : tone === 'accent'
      ? 'text-accent'
      : 'text-white';

  const toneBg =
    tone === 'error'
      ? 'bg-error/10 border-error/20 text-error'
      : tone === 'ok'
      ? 'bg-ok/10 border-ok/20 text-ok'
      : tone === 'accent'
      ? 'bg-accent/10 border-accent/20 text-accent'
      : 'bg-white/5 border-white/10 text-textMuted';

  return (
    <div className="glass-card relative overflow-hidden rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-textMuted">{label}</span>
        {icon && <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${toneBg}`}>{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between">
        <p className={`font-mono text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
        {trend && (
          <span
            className={`inline-flex items-center text-xs font-medium rounded-full px-2 py-0.5 ${
              trend.positive ? 'bg-ok/10 text-ok border border-ok/20' : 'bg-error/10 text-error border border-error/20'
            }`}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      {sublabel && <p className="mt-2 text-xs text-textMuted/80 font-medium">{sublabel}</p>}
    </div>
  );
}
