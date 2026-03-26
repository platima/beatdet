/**
 * ExportPanel: UI for configuring and triggering audio export.
 *
 * Provides controls for:
 *   - Export mode (full, isolate beats, cut at beats, custom range)
 *   - Output format (WAV only; MP3 via native encoder if available)
 *   - Pre/post-roll for beat slicing
 *   - Custom time range selection
 *   - Normalisation toggle
 *   - Download trigger
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Download, Scissors, Music2, FileAudio, AlignJustify } from 'lucide-react';
import { Button } from './Button';
import { exportAudio, downloadBlob } from '@/lib/audioExport';
import { useSettingsStore } from '@/store/settingsStore';
import type { AnalysisResult, ExportMode } from '@/types';

interface ExportPanelProps {
  audioBuffer: ArrayBuffer;
  result: AnalysisResult;
  fileName: string;
}

const MODES: Array<{ value: ExportMode; label: string; description: string; icon: React.ReactNode }> = [
  {
    value: 'full',
    label: 'Full track',
    description: 'Export the complete audio, unchanged.',
    icon: <Music2 size={16} />,
  },
  {
    value: 'isolate-beats',
    label: 'Isolate beats',
    description: 'Export only audio around detected beats, merged into one file.',
    icon: <FileAudio size={16} />,
  },
  {
    value: 'cut-at-beats',
    label: 'Cut at beats',
    description: 'Slice the audio at each beat boundary; exports one file per slice.',
    icon: <Scissors size={16} />,
  },
  {
    value: 'custom-range',
    label: 'Custom range',
    description: 'Export a specific time range.',
    icon: <AlignJustify size={16} />,
  },
];

export function ExportPanel({ audioBuffer, result, fileName }: ExportPanelProps) {
  const { settings, updateExport } = useSettingsStore();
  const exportOptions = settings.export;

  const [exporting, setExporting] = useState(false);
  const [exportedCount, setExportedCount] = useState<number | null>(null);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportedCount(null);

    try {
      const slices = await exportAudio(
        audioBuffer,
        result.beats,
        exportOptions,
        fileName
      );

      for (const slice of slices) {
        downloadBlob(slice.blob, slice.filename);
        // Small delay between downloads to avoid browser blocking
        await new Promise((r) => setTimeout(r, 150));
      }

      setExportedCount(slices.length);
    } catch (err) {
      console.error('[BeatDet] Export failed:', err);
    } finally {
      setExporting(false);
    }
  }, [audioBuffer, result.beats, exportOptions, fileName]);

  return (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      <p className="text-xs font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-muted)' }}>
        Export Audio
      </p>

      {/* Mode selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
          Export mode
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => updateExport({ mode: mode.value })}
              className={[
                'flex items-start gap-3 rounded-lg p-3 text-left transition-all',
                exportOptions.mode === mode.value
                  ? 'ring-2 ring-[var(--accent)]'
                  : 'hover:bg-[var(--bg-alt)]',
              ].join(' ')}
              style={{
                backgroundColor: exportOptions.mode === mode.value
                  ? 'var(--bg-alt)' : 'var(--bg)',
                border: '1px solid var(--border)',
              }}
            >
              <span className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }}>
                {mode.icon}
              </span>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-body)' }}>
                  {mode.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {mode.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Options row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Pre-roll */}
        {(exportOptions.mode === 'isolate-beats' || exportOptions.mode === 'cut-at-beats') && (
          <label className="space-y-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Pre-roll (s)
            </span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={exportOptions.preRoll}
              onChange={(e) => updateExport({ preRoll: parseFloat(e.target.value) })}
              className="w-full rounded-lg px-3 py-1.5 text-sm"
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-body)',
              }}
            />
          </label>
        )}

        {/* Post-roll */}
        {(exportOptions.mode === 'isolate-beats' || exportOptions.mode === 'cut-at-beats') && (
          <label className="space-y-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Post-roll (s)
            </span>
            <input
              type="number"
              min={0}
              max={2}
              step={0.01}
              value={exportOptions.postRoll}
              onChange={(e) => updateExport({ postRoll: parseFloat(e.target.value) })}
              className="w-full rounded-lg px-3 py-1.5 text-sm"
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-body)',
              }}
            />
          </label>
        )}

        {/* Custom range */}
        {exportOptions.mode === 'custom-range' && (
          <>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                Start (s)
              </span>
              <input
                type="number"
                min={0}
                max={result.duration}
                step={0.1}
                value={exportOptions.rangeStart ?? 0}
                onChange={(e) => updateExport({ rangeStart: parseFloat(e.target.value) })}
                className="w-full rounded-lg px-3 py-1.5 text-sm"
                style={{
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-body)',
                }}
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                End (s)
              </span>
              <input
                type="number"
                min={0}
                max={result.duration}
                step={0.1}
                value={exportOptions.rangeEnd ?? result.duration}
                onChange={(e) => updateExport({ rangeEnd: parseFloat(e.target.value) })}
                className="w-full rounded-lg px-3 py-1.5 text-sm"
                style={{
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-body)',
                }}
              />
            </label>
          </>
        )}

        {/* Normalise toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={exportOptions.normalise}
            onChange={(e) => updateExport({ normalise: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)] rounded cursor-pointer"
          />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-body)' }}>
              Normalise
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Peak at –1 dBFS
            </p>
          </div>
        </label>
      </div>

      {/* Export button */}
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          loading={exporting}
          icon={<Download size={16} />}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Exporting…' : 'Download'}
        </Button>

        {exportedCount !== null && (
          <span className="text-sm" style={{ color: 'var(--success)' }}>
            ✓ Exported {exportedCount} file{exportedCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
