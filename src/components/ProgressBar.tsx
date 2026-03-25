/**
 * ProgressBar — animated progress indicator used during audio analysis.
 * Shows percentage and a descriptive status label.
 */

'use client';

interface ProgressBarProps {
  /** 0–1 progress value. */
  value: number;
  label?: string;
  showPercent?: boolean;
}

export function ProgressBar({
  value,
  label = 'Analysing…',
  showPercent = true,
}: ProgressBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        {showPercent && (
          <span
            className="font-mono text-xs tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {pct}%
          </span>
        )}
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-alt)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={[
            'h-full rounded-full transition-all duration-300 ease-out',
            pct < 100 ? 'progress-shimmer' : '',
          ].join(' ')}
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? 'var(--sol-green)' : 'var(--accent)',
          }}
        />
      </div>
    </div>
  );
}
