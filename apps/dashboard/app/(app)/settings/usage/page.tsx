'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/session';
import { billing, UsageSnapshot, UsageBucket, ApiError } from '@/lib/api';
import { formatTime } from '@/lib/format';

function UsageBar({ label, bucket, unit }: { label: string; bucket: UsageBucket; unit?: string }) {
  const pct = Math.round(bucket.percentUsed * 100);
  const barColor = pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-warn' : 'bg-accent';

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm text-text">{label}</span>
        <span className="font-mono text-xs text-textMuted">
          {bucket.used.toLocaleString()} / {bucket.limit.toLocaleString()} {unit}
        </span>
      </div>
      <div className="h-2 rounded bg-borderMuted">
        <div className={`h-2 rounded ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export default function UsagePage() {
  const { organizationId, ready } = useSession();
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    billing
      .getUsage(organizationId)
      .then(setUsage)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load usage'));
  }, [organizationId]);

  if (!ready) return null;
  if (error) return <p className="p-8 text-sm text-error">{error}</p>;
  if (!usage) return <p className="p-8 text-sm text-textMuted">Loading…</p>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Usage & billing</h1>
          <p className="text-sm text-textMuted">
            {usage.planDisplayName} plan · billing period started {formatTime(usage.periodStart)}
          </p>
        </div>
      </div>

      {usage.warnings.length > 0 && (
        <div className="mb-6 space-y-1.5">
          {usage.warnings.map((w, i) => (
            <p key={i} className="rounded border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
              {w}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <UsageBar label="Traces this month" bucket={usage.traces} />
        <UsageBar label="Evaluation cases this month" bucket={usage.evalCases} />
        <UsageBar label="Team members" bucket={usage.teamMembers} />
      </div>

      <p className="mt-6 text-xs text-textFaint">
        Data retention on this plan can be set up to {usage.retentionDaysLimit} days per project (Settings on each
        project's Privacy tab).
      </p>
    </div>
  );
}
