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

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AudioUploader } from '@/components/AudioUploader';
import { ProgressBar } from '@/components/ProgressBar';
import { BpmDisplay } from '@/components/BpmDisplay';
import { BeatList } from '@/components/BeatList';
import { BpmHistogram } from '@/components/BpmHistogram';
import { ExportPanel } from '@/components/ExportPanel';
import { Button } from '@/components/Button';
import { WhatsNewBanner } from '@/components/WhatsNewBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useSettingsStore } from '@/store/settingsStore';
import { RefreshCw, AlertCircle, History, RotateCcw } from 'lucide-react';

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
    reanalyse,
    cancel,
  } = useAudioAnalysis();

  const showOnsetCurve = useSettingsStore(
    (s) => s.settings.display.showOnsetCurve
  );

  // Display-only BPM multiplier (×2 / ÷2 correction without re-analysis)
  const [bpmMultiplier, setBpmMultiplier] = useState(1);
  // Seek target propagated from BeatList row clicks to WaveformPlayer
  const [seekTime, setSeekTime] = useState<number | null>(null);
  // Loop region from WaveformPlayer, forwarded to ExportPanel for custom-range pre-fill
  const [loopRegion, setLoopRegion] = useState<{ start: number; end: number } | null>(null);

  // Attempt to restore the last session on mount
  useEffect(() => {
    if (status === 'idle') restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset BPM multiplier, seek target, and loop region when a new analysis completes.
  useEffect(() => {
    if (status === 'complete') {
      setBpmMultiplier(1);
      setSeekTime(null);
      setLoopRegion(null);
    }
  }, [status]);

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
          Upload a WAV, MP3, M4A, or AAC file to detect beats, visualise the
          waveform, and export sliced audio.
        </p>
      </div>

      {/* Upload area */}
      <AudioUploader
        onFileSelect={analyseFile}
        onClear={fileInfo ? clearAll : undefined}
        fileInfo={fileInfo}
        disabled={isProcessing}
      />

      {/* Error state */}
      {status === 'error' && error && (
        <div
          role="alert"
          aria-live="assertive"
          className="ui-panel flex items-start gap-3 rounded-xl p-4"
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

      {/* Progress + cancel */}
      {isProcessing && (
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar
              value={progress}
              label={getStatusLabel(status)}
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={cancel}
            className="shrink-0"
            aria-label="Cancel analysis"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Visually-hidden live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {status === 'analysing' && 'Analysing audio, please wait.'}
        {status === 'complete' && result
          ? `Analysis complete. Detected BPM: ${result.bpmEstimate.bpm > 0 ? result.bpmEstimate.bpm : 'unknown'}.`
          : ''}
      </div>

      {/* Results */}
      {status === 'complete' && result && fileInfo && (
        <div className="ui-animate-in space-y-6">
          {/* Anchor used by auto-scroll after analysis */}
          <div id="results" />

          {/* What's New banner - shown to returning users after an upgrade */}
          <WhatsNewBanner />

          {/* Restored session banner - shown when audio was not saved */}
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
              <span>
                Restored from last session: {fileInfo.name}. The audio was too large
                to save; re-upload the file to restore waveform playback.
              </span>
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
            <WaveformPlayer
              audioUrl={fileInfo.objectUrl}
              result={result}
              seekTo={seekTime}
              onRegionChange={setLoopRegion}
            />
          )}

          {/* BPM card */}
          <ErrorBoundary label="BPM display">
            <BpmDisplay
              result={result}
              bpmMultiplier={bpmMultiplier}
              onMultiplierChange={setBpmMultiplier}
            />
          </ErrorBoundary>

          {/* Charts: two-column only when both charts are visible */}
          <div className={`grid grid-cols-1 gap-6${
            showOnsetCurve ? ' lg:grid-cols-2' : ''
          }`}>
            {showOnsetCurve && (
              <ErrorBoundary label="Onset chart">
                <OnsetChart result={result} />
              </ErrorBoundary>
            )}
            <ErrorBoundary label="BPM histogram">
              <BpmHistogram result={result} />
            </ErrorBoundary>
          </div>

          {/* Beat timeline */}
          <ErrorBoundary label="Beat timeline">
            <BeatList
              beats={result.beats}
              onBeatClick={fileInfo.objectUrl ? setSeekTime : undefined}
              baseName={fileInfo.name.replace(/\.[^.]+$/, '')}
            />
          </ErrorBoundary>

          {/* Export */}
          {audioBuffer && (
            <ErrorBoundary label="Export panel">
              <ExportPanel
                audioBuffer={audioBuffer}
                result={result}
                fileName={fileInfo.name}
                loopRegion={loopRegion}
              />
            </ErrorBoundary>
          )}

          {/* Re-analyse / New file footer */}
          <div className="flex justify-end gap-2 pt-2">
            {reanalyse && (
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw size={14} />}
                onClick={() => { setBpmMultiplier(1); reanalyse(); }}
              >
                Re-analyse
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={clearAll}
            >
              New file
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
