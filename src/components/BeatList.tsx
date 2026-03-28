/**
 * BeatList: virtualised scrollable table of all detected beats with timestamps
 * and confidence values (if enabled in display settings).
 *
 * Uses TanStack Virtual to render only the visible rows, keeping DOM node count
 * low even for tracks with hundreds or thousands of beats.
 *
 * Includes CSV and JSON download buttons in the header.
 */

'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Beat } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';
import { FileDown } from 'lucide-react';

interface BeatListProps {
  beats: Beat[];
  /** Optional callback fired when a row is clicked; receives the beat time in seconds. */
  onBeatClick?: (time: number) => void;
  /** Base filename (without extension) used for exported CSV/JSON downloads. */
  baseName?: string;
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

/** Trigger a browser download for text/blob data. */
function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function BeatList({ beats, onBeatClick, baseName = 'beats' }: BeatListProps) {
  const showConfidence = useSettingsStore(
    (s) => s.settings.display.showBeatConfidence
  );

  // Ref for the scrollable container, required by useVirtualizer
  const scrollRef = useRef<HTMLDivElement>(null);

  // Number of columns changes when confidence column is shown
  const colCount = showConfidence ? 4 : 3;

  // Virtual row renderer — only mounts visible rows + overscan buffer
  const rowVirtualizer = useVirtualizer({
    count: beats.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 33, // approximate row height in px
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const topPad = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const bottomPad = virtualItems.length > 0
    ? totalSize - virtualItems[virtualItems.length - 1].end
    : 0;

  const handleDownloadCsv = () => {
    const header = 'index,time_formatted,seconds,confidence\n';
    const rows = beats
      .map((b, i) => `${i + 1},${formatTime(b.time)},${b.time.toFixed(4)},${b.confidence.toFixed(4)}`)
      .join('\n');
    downloadText(header + rows, `${baseName}_beats.csv`, 'text/csv;charset=utf-8;');
  };

  const handleDownloadJson = () => {
    const data = {
      beats: beats.map((b, i) => ({
        index: i + 1,
        time: formatTime(b.time),
        seconds: parseFloat(b.time.toFixed(4)),
        confidence: parseFloat(b.confidence.toFixed(4)),
      })),
    };
    downloadText(JSON.stringify(data, null, 2), `${baseName}_beats.json`, 'application/json');
  };

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
      <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-panel)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-muted)' }}>
          Beat Timeline - {beats.length} beats
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-alt)]"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title="Download beats as CSV"
            aria-label="Download beats as CSV"
          >
            <FileDown size={12} />
            CSV
          </button>
          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-[var(--bg-alt)]"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title="Download beats as JSON"
            aria-label="Download beats as JSON"
          >
            <FileDown size={12} />
            JSON
          </button>
        </div>
      </div>

      {/* Scroll container — ref required by useVirtualizer */}
      <div
        ref={scrollRef}
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
            {/* Top spacer — fills the gap above the first visible row */}
            {topPad > 0 && (
              <tr><td colSpan={colCount} style={{ height: topPad }} /></tr>
            )}
            {virtualItems.map((virtualRow) => {
              const beat = beats[virtualRow.index];
              const i = virtualRow.index;
              return (
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
              );
            })}
            {/* Bottom spacer — fills the gap below the last visible row */}
            {bottomPad > 0 && (
              <tr><td colSpan={colCount} style={{ height: bottomPad }} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
