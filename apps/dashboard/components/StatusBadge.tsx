const STYLES: Record<string, string> = {
  ok: 'bg-ok/10 text-ok border-ok/30',
  error: 'bg-error/10 text-error border-error/30',
  in_progress: 'bg-warn/10 text-warn border-warn/30',
};

const LABELS: Record<string, string> = {
  ok: 'OK',
  error: 'Error',
  in_progress: 'In progress',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? 'bg-borderMuted text-textMuted border-border';
  const label = LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs ${style}`}>
      {label}
    </span>
  );
}
