const STATUS_STYLES: Record<string, string> = {
  QUEUED: 'bg-borderMuted text-textMuted border-border',
  RUNNING: 'bg-warn/10 text-warn border-warn/30',
  COMPLETED: 'bg-ok/10 text-ok border-ok/30',
  FAILED: 'bg-error/10 text-error border-error/30',
};

export function RunStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs ${STATUS_STYLES[status] ?? ''}`}>
      {status}
    </span>
  );
}

const VERDICT_STYLES: Record<string, string> = {
  PASS: 'bg-ok/10 text-ok border-ok/30',
  WARN: 'bg-warn/10 text-warn border-warn/30',
  FAIL: 'bg-error/10 text-error border-error/30',
};

export function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-xs text-textFaint">—</span>;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs ${VERDICT_STYLES[verdict] ?? ''}`}>
      {verdict}
    </span>
  );
}
