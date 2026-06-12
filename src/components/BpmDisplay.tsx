/**
 * BpmDisplay: prominent BPM readout with confidence meter and candidate list.
 *
 * Displays:
 *   - Primary BPM estimate (large, prominent)
 *   - Confidence percentage
 *   - Alternative tempo candidates
 *   - Beat count and average interval
 *   - Contextual detection hints with optional Wikipedia "more info" links
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';
import { CloseButton } from './Button';
import type { AnalysisResult } from '@/types';
import { buildHints } from '@/lib/hintUtils';

interface BpmDisplayProps {
  result: AnalysisResult;
  /** Display-only BPM multiplier (1, 2, or 0.5); does not re-run analysis. */
  bpmMultiplier?: number;
  onMultiplierChange?: (m: number) => void;
}

function formatSeconds(s: number): string {
  return s.toFixed(3);
}

export function BpmDisplay({ result, bpmMultiplier = 1, onMultiplierChange }: BpmDisplayProps) {
  const { bpmEstimate, beats, duration } = result;
  const avgInterval =
    beats.length > 1
      ? (beats[beats.length - 1].time - beats[0].time) / (beats.length - 1)
      : 0;

  const confidencePct = Math.round(bpmEstimate.confidence * 100);

  // Hint visibility: re-shown on every new result, dismissible per-analysis.
  // Track which result the dismissal applies to so we auto-show on new results.
  const [dismissedResult, setDismissedResult] = useState<AnalysisResult | null>(null);
  const hintsVisible = dismissedResult !== result;
  const hints = buildHints(bpmEstimate, beats.length);

  // Tap tempo: timestamps of recent taps (ms), cleared after 3 s of inactivity
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapBpm, setTapBpm] = useState<number | null>(null);

  // Reset tap state when a new analysis result comes in.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    tapTimesRef.current = [];
    setTapBpm(null);
  }, [result]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Clear any pending tap-reset timer on unmount so it cannot fire a state
  // update after the component is gone.
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const times = tapTimesRef.current;

    // Reset the tap chain if more than 3 s have elapsed since the last tap
    if (times.length > 0 && now - times[times.length - 1] > 3000) {
      tapTimesRef.current = [];
    }
    tapTimesRef.current = [...tapTimesRef.current, now];

    // Need at least 2 taps to measure an interval
    if (tapTimesRef.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setTapBpm(Math.round(60000 / avgMs));
    }

    // Auto-clear tap chain after 3 s of inactivity
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = [];
      setTapBpm(null);
    }, 3000);
  }, []);

  return (
    <>
    <div
      className="ui-panel ui-bpm-card rounded-xl p-6 space-y-5"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Primary BPM */}
      <div className="flex items-end gap-3">
        <div>
          <p className="ui-section-heading text-xs font-medium uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)' }}>
            Detected BPM
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className="text-6xl font-bold tabular-nums leading-none"
              style={{ color: 'var(--accent)' }}
            >
              {bpmEstimate.bpm > 0
                ? Math.round(bpmEstimate.bpm * bpmMultiplier)
                : '-'}
            </span>
            <span className="text-xl font-medium" style={{ color: 'var(--text-muted)' }}>
              BPM
            </span>
          </div>
          {/* Quick-correct buttons: divide or multiply displayed BPM */}
          {onMultiplierChange && bpmEstimate.bpm > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <button
                onClick={() => onMultiplierChange(bpmMultiplier * 0.5)}
                className="rounded px-2 py-0.5 text-xs font-mono transition-colors hover:bg-[var(--bg-alt)]"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                title="Halve displayed BPM"
                aria-label="Halve displayed BPM"
              >
                ÷2
              </button>
              <button
                onClick={() => onMultiplierChange(bpmMultiplier * 2)}
                className="rounded px-2 py-0.5 text-xs font-mono transition-colors hover:bg-[var(--bg-alt)]"
                style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                title="Double displayed BPM"
                aria-label="Double displayed BPM"
              >
                ×2
              </button>
              {bpmMultiplier !== 1 && (
                <button
                  onClick={() => onMultiplierChange(1)}
                  className="rounded px-2 py-0.5 text-xs transition-colors hover:bg-[var(--bg-alt)]"
                  style={{ border: '1px solid var(--border)', color: 'var(--warning)' }}
                  title="Reset to detected BPM"
                  aria-label="Reset to detected BPM"
                >
                  reset
                </button>
              )}
            </div>
          )}

          {/* Tap tempo: tap to measure inter-tap BPM; apply to override display */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleTap}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80 active:scale-95"
              style={{
                backgroundColor: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                color: 'var(--text-heading)',
              }}
              title="Tap this button to the beat to measure tempo"
              aria-label="Tap tempo"
            >
              Tap
            </button>
            {tapBpm !== null && (
              <>
                <span
                  className="text-sm font-semibold tabular-nums font-mono"
                  style={{ color: 'var(--accent-alt)' }}
                  aria-live="polite"
                  aria-label={`Tap tempo: ${tapBpm} BPM`}
                >
                  {tapBpm} BPM
                </span>
                {onMultiplierChange && bpmEstimate.bpm > 0 && (
                  <button
                    onClick={() => onMultiplierChange(tapBpm / bpmEstimate.bpm)}
                    className="rounded px-2 py-0.5 text-xs transition-colors hover:bg-[var(--bg-alt)]"
                    style={{ border: '1px solid var(--accent-alt)', color: 'var(--accent-alt)' }}
                    title="Override displayed BPM with tap tempo"
                    aria-label={`Use tap BPM of ${tapBpm}`}
                  >
                    Use
                  </button>
                )}
              </>
            )}
            {tapBpm === null && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Tap to the beat to measure tempo
              </span>
            )}
          </div>
        </div>

        {/* Confidence ring */}
        <div className="ml-auto flex flex-col items-center gap-1">
          <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
            <circle
              cx="28" cy="28" r="22"
              fill="none"
              strokeWidth="5"
              stroke="var(--bg-alt)"
            />
            <circle
              cx="28" cy="28" r="22"
              fill="none"
              strokeWidth="5"
              stroke="var(--accent-alt)"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - bpmEstimate.confidence)}`}
              transform="rotate(-90 28 28)"
            />
            <text
              x="28" y="33"
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fill="var(--accent-alt)"
            >
              {confidencePct}%
            </text>
          </svg>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Confidence
          </span>
        </div>
      </div>

      {/* Stats row: stacks on mobile, 3-columns on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Beats detected', value: beats.length.toString() },
          {
            label: 'Avg interval',
            value: avgInterval > 0 ? `${formatSeconds(avgInterval)} s` : '-',
          },
          {
            label: 'Duration',
            // Use Math.floor to avoid rounding 59.5s up to :60.
            value: `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p
              className="text-lg font-semibold tabular-nums"
              style={{ color: 'var(--text-heading)' }}
            >
              {value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Candidate tempos */}
      {bpmEstimate.candidates.length > 1 && (
        <div>
          <p className="ui-section-heading text-xs font-medium uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}>
            Tempo candidates
          </p>
          <div className="flex flex-wrap gap-2">
            {bpmEstimate.candidates.map(({ bpm, score }) => {
              // The multiplier needed to display this candidate as the primary BPM.
              const candidateMultiplier = bpmEstimate.bpm > 0 ? bpm / bpmEstimate.bpm : 1;
              const isSelected = Math.abs(candidateMultiplier - bpmMultiplier) < 0.01;
              return (
                <button
                  key={bpm}
                  onClick={() => onMultiplierChange?.(candidateMultiplier)}
                  disabled={!onMultiplierChange}
                  className="rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-alt)',
                    color: isSelected ? 'white' : 'var(--text-muted)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                    cursor: onMultiplierChange ? 'pointer' : 'default',
                  }}
                  title={`Use ${bpm} BPM as displayed tempo`}
                  aria-label={`Select ${bpm} BPM`}
                  aria-pressed={isSelected}
                >
                  {bpm} BPM
                  <span className="ml-1 text-xs opacity-70">
                    ({Math.round(score * 10) / 10})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>

    {/* Detection hints: fixed bottom-right toast, rendered via portal to escape
        the ui-animate-in ancestor (which uses a CSS transform and would otherwise
        create a containing block that traps position:fixed elements). */}
    {hints.length > 0 && hintsVisible && typeof document !== 'undefined' && createPortal(
      <div
        className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl p-4 shadow-xl"
        style={{
          backgroundColor: 'var(--bg-panel)',
          border: '1px solid var(--warning)',
        }}
        role="note"
        aria-label="Beat detection hints"
      >
        <div className="flex items-start gap-2">
          <AlertTriangle
            size={18}
            className="shrink-0 mt-0.5"
            style={{ color: 'var(--warning)' }}
            aria-hidden
          />
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
              Detection note
            </p>
            {hints.map((hint) => (
              <p key={hint.text} className="text-sm leading-snug" style={{ color: 'var(--text-body)' }}>
                {hint.text}
                {hint.url && (
                  <>
                    {' '}
                    <a
                      href={hint.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--warning)' }}
                    >
                      More info
                    </a>
                  </>
                )}
              </p>
            ))}
          </div>
          <CloseButton
            onClick={() => setDismissedResult(result)}
            label="Dismiss detection hint"
          />
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
