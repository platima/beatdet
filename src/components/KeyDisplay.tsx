/**
 * KeyDisplay: prominent key detection readout with Camelot code,
 * relative key, and top candidate list.
 *
 * Displays:
 *   - Primary key (large, prominent) with mode badge
 *   - Camelot Wheel code for DJ mixing compatibility
 *   - Relative key (relative major or relative minor)
 *   - Normalised confidence bar
 *   - Top-5 alternative candidate keys
 */

'use client';

import React from 'react';
import type { KeyEstimate } from '@/types';

interface KeyDisplayProps {
  keyEstimate: KeyEstimate;
}

/** Render a visual confidence bar (0ÔÇô1 filled portion). */
function ConfidenceBar({ value, ambiguous }: { value: number; ambiguous: boolean }) {
  const pct = Math.round(value * 100);
  const fillColour = ambiguous ? 'var(--warning)' : 'var(--accent)';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Confidence</span>
        <span>{pct}%</span>
      </div>
      <div
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-alt)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: fillColour }}
        />
      </div>
    </div>
  );
}

export function KeyDisplay({ keyEstimate }: KeyDisplayProps) {
  const {
    key,
    mode,
    display,
    confidence,
    camelot,
    relativeKey,
    candidates,
    ambiguous,
    closeCall,
  } = keyEstimate;

  const modeLabel = mode === 'major' ? 'Major' : 'Minor';

  return (
    <div
      className="ui-panel ui-key-card rounded-xl p-6 space-y-5"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Primary key */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p
            className="ui-section-heading text-xs font-medium uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Detected Key
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className="text-6xl font-bold leading-none tabular-nums"
              style={{ color: 'var(--accent)' }}
            >
              {key}
            </span>
            <span
              className="text-xl font-semibold"
              style={{ color: 'var(--text-heading)' }}
            >
              {modeLabel}
            </span>
          </div>
          {ambiguous && (
            <p className="mt-1 text-xs" style={{ color: 'var(--warning)' }}>
              Low confidence - key may be ambiguous
            </p>
          )}
          {closeCall && (
            <p className="mt-1 text-xs" style={{ color: 'var(--warning)' }}>
              Close call - could also be {closeCall}
            </p>
          )}
        </div>

        {/* Camelot code badge */}
        <div className="flex flex-col items-center shrink-0">
          <span
            className="text-xs font-medium uppercase tracking-widest mb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Camelot
          </span>
          <span
            className="text-2xl font-bold tabular-nums px-3 py-1 rounded-lg"
            style={{
              backgroundColor: 'var(--bg-alt)',
              color: 'var(--accent)',
              border: '1px solid var(--border)',
              letterSpacing: '0.05em',
            }}
          >
            {camelot}
          </span>
        </div>
      </div>

      {/* Confidence bar */}
      <ConfidenceBar value={confidence} ambiguous={ambiguous} />

      {/* Relative key */}
      <div
        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
        style={{
          backgroundColor: 'var(--bg-alt)',
          border: '1px solid var(--border)',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>Relative key</span>
        <span className="font-medium" style={{ color: 'var(--text-base)' }}>
          {relativeKey}
        </span>
      </div>

      {/* Candidate keys */}
      {candidates.length > 1 && (
        <div>
          <p
            className="ui-section-heading text-xs font-medium uppercase tracking-widest mb-2"
            style={{ color: 'var(--text-muted)' }}
          >
            Other candidates
          </p>
          <div className="space-y-1.5">
            {candidates.slice(1).map((c, i) => {
              const width = Math.round(c.confidence * 100);
              return (
                <div key={`${c.key}-${c.mode}-${i}`} className="flex items-center gap-2">
                  <span
                    className="w-28 text-xs font-medium shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {c.key} {c.mode === 'major' ? 'Major' : 'Minor'}
                  </span>
                  <span
                    className="w-10 text-right text-xs tabular-nums shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {c.camelot}
                  </span>
                  <div
                    className="flex-1 h-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'var(--bg-alt)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${width}%`,
                        backgroundColor: 'var(--text-muted)',
                        opacity: 0.5,
                      }}
                    />
                  </div>
                  <span
                    className="w-8 text-right text-xs tabular-nums shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {width}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Aria live announcement for screen readers */}
      <p className="sr-only" aria-live="polite">
        Detected key: {display}. Camelot: {camelot}. Relative key: {relativeKey}.
        {closeCall ? ` Close call: could also be ${closeCall}.` : ''}
      </p>
    </div>
  );
}
