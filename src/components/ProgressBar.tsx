/**
 * ProgressBar: animated progress indicator used during audio analysis.
 * Shows percentage and a descriptive status label.
 *
 * A value of -1 triggers an indeterminate (full-width shimmer) state,
 * used during the file-loading phase before analysis begins.
 */

'use client';

import { useRef } from 'react';

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
  // Treat any negative value as indeterminate (file-load phase)
  const isIndeterminate = value < 0;
  const pct = isIndeterminate ? 0 : Math.round(Math.max(0, Math.min(1, value)) * 100);

  // Suppress the CSS transition on the single frame where we switch from
  // indeterminate (bar at 100% width) to the first real progress value.
  // Without this, the bar visually animates backwards from 100% → e.g. 5%.
  const prevValueRef = useRef<number>(value);
  const justBecameDeterminate = prevValueRef.current < 0 && !isIndeterminate;
  prevValueRef.current = value;

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
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-alt)' }}
        role="progressbar"
        aria-valuenow={isIndeterminate ? undefined : pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full progress-shimmer${!isIndeterminate && !justBecameDeterminate ? ' transition-all duration-300 ease-out' : ''}`}
          style={{
            // Indeterminate: full-width shimmer. Determinate: sized bar.
            width: isIndeterminate ? '100%' : `${pct}%`,
            backgroundColor: pct === 100 ? 'var(--sol-green)' : 'var(--accent)',
          }}
        />
      </div>
    </div>
  );
}
