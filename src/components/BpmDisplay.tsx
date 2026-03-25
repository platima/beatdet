/**
 * BpmDisplay — prominent BPM readout with confidence meter and candidate list.
 *
 * Displays:
 *   - Primary BPM estimate (large, prominent)
 *   - Confidence percentage
 *   - Alternative tempo candidates
 *   - Beat count and average interval
 */

'use client';

import type { AnalysisResult } from '@/types';

interface BpmDisplayProps {
  result: AnalysisResult;
}

function formatSeconds(s: number): string {
  return s.toFixed(3);
}

export function BpmDisplay({ result }: BpmDisplayProps) {
  const { bpmEstimate, beats, duration } = result;
  const avgInterval =
    beats.length > 1
      ? (beats[beats.length - 1].time - beats[0].time) / (beats.length - 1)
      : 0;

  const confidencePct = Math.round(bpmEstimate.confidence * 100);

  return (
    <div
      className="rounded-xl p-6 space-y-5"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Primary BPM */}
      <div className="flex items-end gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)' }}>
            Detected BPM
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className="text-6xl font-bold tabular-nums leading-none"
              style={{ color: 'var(--accent)' }}
            >
              {bpmEstimate.bpm > 0 ? bpmEstimate.bpm : '—'}
            </span>
            <span className="text-xl font-medium" style={{ color: 'var(--text-muted)' }}>
              BPM
            </span>
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

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Beats detected', value: beats.length.toString() },
          {
            label: 'Avg interval',
            value: avgInterval > 0 ? `${formatSeconds(avgInterval)} s` : '—',
          },
          {
            label: 'Duration',
            value: `${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}`,
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
          <p className="text-xs font-medium uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}>
            Tempo candidates
          </p>
          <div className="flex flex-wrap gap-2">
            {bpmEstimate.candidates.map(({ bpm, score }, i) => (
              <div
                key={bpm}
                className="rounded-lg px-3 py-1.5 text-sm font-mono tabular-nums"
                style={{
                  backgroundColor: i === 0 ? 'var(--accent)' : 'var(--bg-alt)',
                  color: i === 0 ? 'white' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {bpm} BPM
                <span className="ml-1 text-xs opacity-70">
                  ({Math.round(score * 10) / 10})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
