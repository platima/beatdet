/**
 * WaveformPlayer: interactive waveform display with playback controls,
 * built on wavesurfer.js. Beat markers are drawn as vertical lines.
 *
 * Renders only on the client side (wavesurfer.js requires the DOM).
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import { Play, Pause, SkipBack, Volume2, VolumeX, ZoomIn, Repeat, Gauge } from 'lucide-react';
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
  /**
   * Called whenever the loop region is created, updated, or cleared.
   * Used by ExportPanel to pre-fill custom-range inputs from the region.
   */
  onRegionChange?: (region: { start: number; end: number } | null) => void;
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

export function WaveformPlayer({ audioUrl, result, seekTo, onRegionChange }: WaveformPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  // RegionsPlugin instance — recreated alongside WaveSurfer
  const regionsPluginRef = useRef<RegionsPlugin | null>(null);
  // Current loop region bounds in seconds
  const regionRef = useRef<{ start: number; end: number } | null>(null);
  // Ref so the audioprocess closure always reads the current loop state
  const loopEnabledRef = useRef(false);
  // Stable ref for onRegionChange so event handlers do not capture stale props
  const onRegionChangeRef = useRef(onRegionChange);
  useEffect(() => { onRegionChangeRef.current = onRegionChange; }, [onRegionChange]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(result.duration);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [loopEnabled, setLoopEnabled] = useState(false);

  const displaySettings = useSettingsStore((s) => s.settings.display);
  const { updateDisplay } = useSettingsStore();
  const beatColour = SOLARISED_ACCENT[displaySettings.beatMarkerColour] ?? '#cb4b16';
  // Re-create WaveSurfer when theme changes so it picks up new CSS variable values
  const { preference: theme } = useTheme();

  // Waveform canvas height driven by the display setting.
  const waveformHeight = displaySettings.waveformHeight ?? 120;

  // Local zoom state mirrors the persisted display setting
  const [zoom, setZoom] = useState(displaySettings.waveformZoom);

  // Initialise WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    // Tracks hover listener cleanup so we can tear it down with the effect.
    let hoverCleanup: (() => void) | undefined;

    // Determine theme colours from CSS variables
    const style = getComputedStyle(document.documentElement);
    const waveColour = style.getPropertyValue('--sol-blue').trim() || '#268bd2';
    const progressColour = style.getPropertyValue('--sol-cyan').trim() || '#2aa198';

    // RegionsPlugin enables draggable/resizable loop regions on the waveform
    const regionsPlugin = RegionsPlugin.create();
    regionsPluginRef.current = regionsPlugin;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveColour,
      progressColor: progressColour,
      cursorColor: '#dc322f',
      cursorWidth: 2,
      height: waveformHeight,
      normalize: true,
      interact: true,
      dragToSeek: true,
      url: audioUrl,
      // Hide the scrollbar via WaveSurfer's own shadow-DOM mechanism; the
      // hover listeners below reveal it only while the pointer is over the
      // waveform section.
      hideScrollbar: true,
      plugins: [regionsPlugin],
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      ws.setVolume(volume);
      // Apply persisted zoom level
      ws.zoom(zoom * 50);

      // Reveal the scrollbar on hover by toggling the shadow-DOM class that
      // WaveSurfer uses for its hideScrollbar option.
      const host = containerRef.current?.firstElementChild;
      const scrollEl = host?.shadowRoot?.querySelector('.scroll') as HTMLElement | null;
      const area = scrollAreaRef.current;
      if (scrollEl && area) {
        const reveal = () => scrollEl.classList.remove('noScrollbar');
        const conceal = () => scrollEl.classList.add('noScrollbar');
        area.addEventListener('mouseenter', reveal);
        area.addEventListener('mouseleave', conceal);
        hoverCleanup = () => {
          area.removeEventListener('mouseenter', reveal);
          area.removeEventListener('mouseleave', conceal);
        };
      }
    });

    ws.on('audioprocess', (t) => {
      setCurrentTime(t);
      // Loop region: when loop is active, seek back to region start when
      // playback reaches or passes the region end.
      if (loopEnabledRef.current) {
        const r = regionRef.current;
        if (r && t >= r.end) {
          ws.seekTo(r.start / ws.getDuration());
        }
      }
    });
    ws.on('seeking', (t) => setCurrentTime(t));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    // Region events: keep regionRef current and notify parent via stable ref
    regionsPlugin.on('region-created', (region) => {
      regionRef.current = { start: region.start, end: region.end };
      onRegionChangeRef.current?.({ start: region.start, end: region.end });
    });
    regionsPlugin.on('region-updated', (region) => {
      regionRef.current = { start: region.start, end: region.end };
      onRegionChangeRef.current?.({ start: region.start, end: region.end });
    });
    regionsPlugin.on('region-removed', () => {
      regionRef.current = null;
      onRegionChangeRef.current?.(null);
    });

    return () => {
      hoverCleanup?.();
      ws.destroy();
      wsRef.current = null;
      regionsPluginRef.current = null;
      regionRef.current = null;
      setIsReady(false);
      setLoopEnabled(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, theme]);

  // Volume / mute
  useEffect(() => {
    wsRef.current?.setVolume(muted ? 0 : volume);
  }, [volume, muted]);

  // Apply waveform height when the setting changes (no full recreation needed).
  useEffect(() => {
    if (isReady) wsRef.current?.setOptions({ height: waveformHeight });
  }, [waveformHeight, isReady]);

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

  // Keep loopEnabledRef in sync with state for use in the audioprocess closure
  useEffect(() => { loopEnabledRef.current = loopEnabled; }, [loopEnabled]);

  // Apply playback rate when it changes
  useEffect(() => {
    if (isReady) wsRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate, isReady]);

  // Create or clear the waveform loop region when loopEnabled / isReady changes
  useEffect(() => {
    const regionsPlugin = regionsPluginRef.current;
    if (!regionsPlugin || !isReady) return;

    if (!loopEnabled) {
      regionsPlugin.clearRegions();
      regionRef.current = null;
      onRegionChangeRef.current?.(null);
      return;
    }

    // Create a default region (25%–75% of track) if none exists yet
    if (!regionRef.current && duration > 0) {
      regionsPlugin.addRegion({
        start: duration * 0.25,
        end:   duration * 0.75,
        color: 'rgba(38, 139, 210, 0.15)',
        drag:   true,
        resize: true,
      });
    }
  }, [loopEnabled, isReady, duration]);

  // Keyboard shortcuts: Space = play/pause, R = restart, L = toggle loop
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isReady) return;
      // Do not intercept when focus is on an editable or button element
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      ) return;

      if (e.key === ' ') {
        e.preventDefault();
        wsRef.current?.playPause();
      } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        // Guard against intercepting Ctrl+R / Cmd+R (browser refresh)
        e.preventDefault();
        wsRef.current?.seekTo(0);
        setCurrentTime(0);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        setLoopEnabled((v) => !v);
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
      <div ref={scrollAreaRef} className="relative px-4 pt-4">
        {!isReady && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className="text-sm">Loading waveform…</span>
          </div>
        )}
        {/*
         * Relative wrapper scopes the beat-marker overlay to the waveform
         * canvas only (height determined by waveformHeight setting). Without this, the overlay's
         * h-full would extend into the WaveSurfer horizontal scrollbar zone
         * when zoomed in, obscuring it.
         */}
        <div className="relative" style={{ height: waveformHeight }}>
          <div ref={containerRef} className="w-full" />

          {/* Beat markers overlay - drawn as absolute vertical lines */}
          {isReady && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
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
      </div>

      {/* Controls — split into two rows for comfortable mobile layout */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        {/* Primary transport row: time, restart, play, loop, mute, volume */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          {/* Time display */}
          <span
            className="shrink-0 whitespace-nowrap text-xs font-mono tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Restart */}
          <button
            onClick={restart}
            disabled={!isReady}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-40 hover:bg-[var(--bg-alt)]"
            style={{ color: 'var(--text-muted)' }}
            title="Return to start (R)"
            aria-label="Restart"
          >
            <SkipBack size={16} />
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            disabled={!isReady}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all disabled:opacity-40 hover:brightness-110 shrink-0"
            style={{ backgroundColor: 'var(--accent)' }}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          {/* Loop region toggle */}
          <button
            onClick={() => setLoopEnabled((v) => !v)}
            disabled={!isReady}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors disabled:opacity-40"
            style={{
              color: loopEnabled ? 'var(--accent)' : 'var(--text-muted)',
              backgroundColor: loopEnabled ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
            }}
            title={loopEnabled ? 'Disable loop (L)' : 'Enable loop region (L)'}
            aria-label={loopEnabled ? 'Disable loop region' : 'Enable loop region'}
            aria-pressed={loopEnabled}
          >
            <Repeat size={16} />
          </button>

          {/* Mute */}
          <button
            onClick={() => setMuted((m) => !m)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-alt)]"
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
            className="h-1.5 w-16 accent-[var(--accent)] cursor-pointer"
            title="Volume"
            aria-label="Volume"
          />
        </div>

        {/* Secondary row: playback speed, zoom, beats badge */}
        <div
          className="flex flex-wrap items-center gap-2 px-4 py-2.5"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          {/* Speed label */}
          <Gauge size={13} style={{ color: 'var(--text-muted)' }} aria-hidden />
          {/* Speed buttons */}
          {([0.5, 0.75, 1, 1.5] as const).map((rate) => (
            <button
              key={rate}
              onClick={() => setPlaybackRate(rate)}
              disabled={!isReady}
              title={`${rate}× speed`}
              aria-label={`Set playback speed to ${rate}×`}
              aria-pressed={playbackRate === rate}
              className="rounded px-1.5 py-0.5 text-xs font-mono transition-colors disabled:opacity-40"
              style={{
                backgroundColor: playbackRate === rate ? 'var(--accent)' : 'var(--bg)',
                color: playbackRate === rate ? 'white' : 'var(--text-muted)',
                border: `1px solid ${playbackRate === rate ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {rate}×
            </button>
          ))}

          {/* Zoom slider + numeric readout */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
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
              className="h-1.5 w-28 accent-[var(--accent)] cursor-pointer"
              title={`Zoom: ${zoom}×`}
              aria-label="Waveform zoom"
            />
            <input
              type="number"
              min={1}
              max={8}
              step={0.5}
              value={zoom}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                if (!isNaN(raw)) {
                  // Snap to nearest 0.5, clamp to [1, 8]
                  const v = Math.max(1, Math.min(8, Math.round(raw * 2) / 2));
                  setZoom(v);
                  updateDisplay({ waveformZoom: v });
                }
              }}
              className="w-12 rounded px-1 py-0.5 text-xs font-mono text-center tabular-nums"
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-body)',
              }}
              title="Zoom level"
              aria-label="Waveform zoom level"
            />
          </div>

          {/* Beat count badge */}
          <span
            className="rounded px-2 py-0.5 text-xs font-medium"
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
    </div>
  );
}
