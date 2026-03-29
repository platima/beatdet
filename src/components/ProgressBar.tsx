/**
 * ProgressBar: animated progress indicator used during audio analysis.
 * Shows percentage and a descriptive status label.
 *
 * A value of -1 triggers an indeterminate (shimmer overlay) state,
 * used during the file-loading and audio-decode phases.
 *
 * The shimmer is rendered as an absolutely-positioned overlay on top of
 * the progress track. The actual fill bar is always sized to pct%, so
 * there is no visual jump when the shimmer disappears and real progress
 * takes over.
 */

'use client';

interface ProgressBarProps {
  /** 0–1 progress value. Pass -1 for indeterminate (loading) state. */
  value: number;
  label?: string;
  showPercent?: boolean;
}

export function ProgressBar({
  value,
  label = 'Analysing…',
  showPercent = true,
}: ProgressBarProps) {
  // Treat any negative value as indeterminate (file-load / decode phase)
  const isIndeterminate = value < 0;
  const pct = isIndeterminate ? 0 : Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        {showPercent && !isIndeterminate && (
          <span
            className="font-mono text-xs tabular-nums"
            style={{ color: 'var(--accent)' }}
          >
            {pct}%
          </span>
        )}
      </div>

      <div
        className="relative h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-alt)' }}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        {/* Determinate fill — always sized to pct% so there is no jump
            when the shimmer overlay disappears and real progress begins. */}
        <div
          className="absolute inset-y-0 left-0 h-full rounded-full transition-all duration-300 ease-out"
          style={{
            width: `${pct}%`,
            backgroundColor: pct === 100 ? 'var(--sol-green)' : 'var(--accent)',
          }}
        />
        {/* Indeterminate shimmer overlay — covers the full track during the
            loading and decode phases. Disappears once real progress starts. */}
        {isIndeterminate && (
          <div className="absolute inset-0 h-full w-full rounded-full progress-shimmer" />
        )}
      </div>
    </div>
  );
}
