/**
 * WaveformPlayer: interactive waveform display with playback controls,
 * built on wavesurfer.js. Beat markers are drawn as vertical lines.
 *
 * Renders only on the client side (wavesurfer.js requires the DOM).
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, SkipBack, Volume2, VolumeX, ZoomIn } from 'lucide-react';
import type { AnalysisResult } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';

interface WaveformPlayerProps {
  audioUrl: string;
  result: AnalysisResult;
  /**
   * When this value changes and is non-null, the waveform seeks to that
   * time in seconds. Used by BeatList click-to-seek.
   */
  seekTo?: number | null;
}

const SOLARISED_ACCENT: Record<string, string> = {
  yellow:  '#b58900',
  orange:  '#cb4b16',
  red:     '#dc322f',
  magenta: '#d33682',
  violet:  '#6c71c4',
  blue:    '#268bd2',
  cyan:    '#2aa198',
  green:   '#859900',
};

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WaveformPlayer({ audioUrl, result, seekTo }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(result.duration);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const displaySettings = useSettingsStore((s) => s.settings.display);
  const { updateDisplay } = useSettingsStore();
  const beatColour = SOLARISED_ACCENT[displaySettings.beatMarkerColour] ?? '#cb4b16';
  // Re-create WaveSurfer when theme changes so it picks up new CSS variable values
  const { preference: theme } = useTheme();

  // Local zoom state mirrors the persisted display setting
  const [zoom, setZoom] = useState(displaySettings.waveformZoom);

  // Initialise WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    // Determine theme colours from CSS variables
    const style = getComputedStyle(document.documentElement);
    const waveColour = style.getPropertyValue('--sol-blue').trim() || '#268bd2';
    const progressColour = style.getPropertyValue('--sol-cyan').trim() || '#2aa198';

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveColour,
      progressColor: progressColour,
      cursorColor: '#dc322f',
      cursorWidth: 2,
      height: 80,
      normalize: true,
      interact: true,
      url: audioUrl,
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      ws.setVolume(volume);
      // Apply persisted zoom level
      ws.zoom(zoom * 50);
    });

    ws.on('audioprocess', (t) => setCurrentTime(t));
    ws.on('seeking', (t) => setCurrentTime(t));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    return () => {
      ws.destroy();
      wsRef.current = null;
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, theme]);

  // Volume / mute
  useEffect(() => {
    wsRef.current?.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  // Apply zoom to WaveSurfer when slider changes (only once ready)
  useEffect(() => {
    if (isReady) wsRef.current?.zoom(zoom * 50);
  }, [zoom, isReady]);

  // Seek to a specific time (driven by BeatList click-to-seek)
  useEffect(() => {
    if (seekTo !== null && seekTo !== undefined && isReady && duration > 0) {
      wsRef.current?.seekTo(Math.max(0, Math.min(1, seekTo / duration)));
    }
  }, [seekTo, isReady, duration]);

  // Space bar global shortcut to play/pause
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isReady) return;
      if (
        e.key === ' ' &&
        // Do not intercept when focus is on an interactive element
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        wsRef.current?.playPause();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isReady]);

  const togglePlay = useCallback(() => wsRef.current?.playPause(), []);
  const restart = useCallback(() => {
    wsRef.current?.seekTo(0);
    setCurrentTime(0);
  }, []);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Waveform canvas */}
      <div className="relative px-4 pt-4">
        {!isReady && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="text-sm">Loading waveform…</span>
          </div>
        )}
        <div ref={containerRef} className="w-full" />

        {/* Beat markers overlay - drawn as absolute vertical lines */}
        {isReady && (
          <div className="absolute inset-x-4 top-0 h-full pointer-events-none">
            {result.beats.map((beat) => (
              <div
                key={beat.time}
                className="absolute top-0 bottom-0 w-0.5 opacity-60"
                style={{
                  left: `${(beat.time / duration) * 100}%`,
                  backgroundColor: beatColour,
                }}
                title={`Beat at ${beat.time.toFixed(3)} s`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ borderTop: '1px solid var(--border)' }}>
        {/* Time */}
        <span
          className="w-24 text-xs font-mono tabular-nums shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Restart */}
        <button
          onClick={restart}
          disabled={!isReady}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-40"
          style={{ color: 'var(--text-muted)' }}
          title="Return to start"
          aria-label="Restart"
        >
          <SkipBack size={16} />
        </button>

        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          disabled={!isReady}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all disabled:opacity-40 hover:brightness-110"
          style={{ backgroundColor: 'var(--accent)' }}
          title={isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>

        {/* Volume */}
        <button
          onClick={() => setMuted((m) => !m)}
          className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title={muted ? 'Unmute' : 'Mute'}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            setVolume(v);
            setMuted(v === 0);
          }}
          className="h-1.5 w-20 accent-[var(--accent)] cursor-pointer"
          title="Volume"
          aria-label="Volume"
        />

        {/* Zoom slider */}
        <div className="ml-2 flex items-center gap-1.5 shrink-0">
          <ZoomIn size={14} style={{ color: 'var(--text-muted)' }} aria-hidden />
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={zoom}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setZoom(v);
              updateDisplay({ waveformZoom: v });
            }}
            className="h-1.5 w-20 accent-[var(--accent)] cursor-pointer"
            title={`Zoom: ${zoom}×`}
            aria-label="Waveform zoom"
          />
        </div>

        {/* Beat count badge */}
        <span
          className="ml-auto rounded px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg)',
            color: 'var(--highlight)',
            border: '1px solid var(--border)',
          }}
        >
          {result.beats.length} beats
        </span>
      </div>
    </div>
  );
}
