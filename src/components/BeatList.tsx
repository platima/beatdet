/**
 * BeatList: scrollable table of all detected beats with timestamps and
 * confidence values (if enabled in display settings).
 */

'use client';

import type { Beat } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';

interface BeatListProps {
  beats: Beat[];
  /** Optional callback fired when a row is clicked; receives the beat time in seconds. */
  onBeatClick?: (time: number) => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3);
  return `${m}:${sec.padStart(6, '0')}`;
}

/** Render a confidence bar (0–1). */
function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-20 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: 'var(--bg-alt)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: pct > 70 ? 'var(--sol-green)' : pct > 40 ? 'var(--sol-yellow)' : 'var(--sol-orange)',
          }}
        />
      </div>
      <span
        className="w-8 text-right text-xs tabular-nums"
        style={{ color: 'var(--text-muted)' }}
      >
        {pct}%
      </span>
    </div>
  );
}

export function BeatList({ beats, onBeatClick }: BeatListProps) {
  const showConfidence = useSettingsStore(
    (s) => s.settings.display.showBeatConfidence
  );

  if (beats.length === 0) {
    return (
      <div
        className="flex h-32 items-center justify-center rounded-xl text-sm"
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
      >
        No beats detected.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="px-4 py-3" style={{ backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}>
          Beat Timeline - {beats.length} beats
        </p>
      </div>

      <div
        className="max-h-64 overflow-x-auto overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-panel)' }}
      >
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr
              className="sticky top-0 text-left text-xs font-medium uppercase tracking-wider"
              style={{
                backgroundColor: 'var(--bg-alt)',
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <th className="px-4 py-2 w-12">#</th>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2 text-right">Seconds</th>
              {showConfidence && <th className="px-4 py-2">Confidence</th>}
            </tr>
          </thead>
          <tbody>
            {beats.map((beat, i) => (
              <tr
                key={beat.time}
                className={[
                  'border-b transition-colors',
                  onBeatClick
                    ? 'cursor-pointer hover:bg-[var(--bg-alt)]'
                    : 'hover:bg-[var(--bg-alt)]',
                ].join(' ')}
                style={{ borderColor: 'var(--border)' }}
                onClick={() => onBeatClick?.(beat.time)}
                title={onBeatClick ? `Seek to ${beat.time.toFixed(3)} s` : undefined}
              >
                <td className="px-4 py-1.5 font-mono tabular-nums text-xs"
                  style={{ color: 'var(--text-muted)' }}>
                  {i + 1}
                </td>
                <td className="px-4 py-1.5 font-mono tabular-nums text-xs"
                  style={{ color: 'var(--text-body)' }}>
                  {formatTime(beat.time)}
                </td>
                <td className="px-4 py-1.5 font-mono tabular-nums text-xs text-right"
                  style={{ color: 'var(--accent)' }}>
                  {beat.time.toFixed(4)}
                </td>
                {showConfidence && (
                  <td className="px-4 py-1.5 w-36">
                    <ConfidenceBar value={beat.confidence} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
