/**
 * Home page: main beat detection interface.
 *
 * Flow:
 *   1. User uploads a WAV / MP3 / M4A file.
 *   2. File is analysed (beat detection).
 *   3. Results are shown: BPM, waveform player, beat list,
 *      onset chart, BPM histogram, and export panel.
 *
 * If a previous session exists in storage, it is automatically restored.
 */

'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AudioUploader } from '@/components/AudioUploader';
import { ProgressBar } from '@/components/ProgressBar';
import { BpmDisplay } from '@/components/BpmDisplay';
import { BeatList } from '@/components/BeatList';
import { BpmHistogram } from '@/components/BpmHistogram';
import { ExportPanel } from '@/components/ExportPanel';
import { Button } from '@/components/Button';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useSettingsStore } from '@/store/settingsStore';
import { RefreshCw, AlertCircle, History } from 'lucide-react';

// WaveformPlayer uses wavesurfer.js (browser-only), so load it dynamically
const WaveformPlayer = dynamic(
  () => import('@/components/WaveformPlayer').then((m) => m.WaveformPlayer),
  { ssr: false, loading: () => <WaveformSkeleton /> }
);

// OnsetChart is chart.js; load dynamically for bundle size
const OnsetChart = dynamic(
  () => import('@/components/OnsetChart').then((m) => m.OnsetChart),
  { ssr: false }
);

function WaveformSkeleton() {
  return (
    <div
      className="h-32 animate-pulse rounded-xl"
      style={{ backgroundColor: 'var(--bg-panel)' }}
    />
  );
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'loading': return 'Loading audio…';
    case 'analysing': return 'Detecting beats…';
    default: return 'Processing…';
  }
}

export default function HomePage() {
  const {
    status,
    progress,
    fileInfo,
    audioBuffer,
    result,
    error,
    analyseFile,
    clearAll,
    restoreSession,
  } = useAudioAnalysis();

  const showOnsetCurve = useSettingsStore(
    (s) => s.settings.display.showOnsetCurve
  );

  // Attempt to restore the last session on mount
  useEffect(() => {
    if (status === 'idle') restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isProcessing = status === 'loading' || status === 'analysing';

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-heading)' }}
        >
          Beat Detection
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Upload a WAV, MP3, or M4A file to detect beats, visualise the
          waveform, and export sliced audio.
        </p>
      </div>

      {/* Upload area */}
      <AudioUploader
        onFileSelect={analyseFile}
        onClear={status !== 'idle' ? clearAll : undefined}
        fileInfo={fileInfo}
        disabled={isProcessing}
      />

      {/* Error state */}
      {status === 'error' && error && (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
          }}
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Analysis failed</p>
            <p className="text-xs mt-1 opacity-80">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-auto shrink-0"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Progress */}
      {isProcessing && (
        <ProgressBar
          value={progress}
          label={getStatusLabel(status)}
        />
      )}

      {/* Results */}
      {status === 'complete' && result && fileInfo && (
        <>
          {/* Restored session banner - shown when audio was from storage */}
          {!fileInfo.objectUrl && (
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                backgroundColor: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              <History size={14} />
              <span>Restored from last session - {fileInfo.name}</span>
              <button
                onClick={clearAll}
                className="ml-auto font-medium hover:text-[var(--accent)] transition-colors"
              >
                Start fresh
              </button>
            </div>
          )}

          {/* Waveform player */}
          {fileInfo.objectUrl && (
            <WaveformPlayer audioUrl={fileInfo.objectUrl} result={result} />
          )}

          {/* BPM card */}
          <BpmDisplay result={result} />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {showOnsetCurve && <OnsetChart result={result} />}
            <BpmHistogram result={result} />
          </div>

          {/* Beat timeline */}
          <BeatList beats={result.beats} />

          {/* Export */}
          {audioBuffer && (
            <ExportPanel
              audioBuffer={audioBuffer}
              result={result}
              fileName={fileInfo.name}
            />
          )}

          {/* Re-analyse */}
          <div className="flex justify-end pt-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={clearAll}
            >
              New file
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
