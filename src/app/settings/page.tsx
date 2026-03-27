/**
 * Settings page: all application configuration in one place.
 *
 * Organised into four sections:
 *   1. Appearance     - theme, colours, display options
 *   2. Beat Detection - algorithm parameters
 *   3. Export         - default export format and options
 *   4. About          - version information and reset
 */

'use client';

import React from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/Button';
import { Sun, Moon, Monitor, RotateCcw } from 'lucide-react';
import type { SolarisedAccent } from '@/types';

// Version is injected at build time from the VERSION file via next.config.ts.
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

/* ============================================================
   Section wrapper
   ============================================================ */

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-6 space-y-5"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--border)',
      }}
    >
      <div>
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-heading)' }}
        >
          {title}
        </h2>
        {description && (
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/* ============================================================
   Field helpers
   ============================================================ */

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="sm:w-52 sm:shrink-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-body)' }}>
          {label}
        </p>
        {hint && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full max-w-[140px] rounded-lg px-3 py-1.5 text-sm"
      style={{
        backgroundColor: 'var(--bg)',
        border: '1px solid var(--border)',
        color: 'var(--text-body)',
      }}
    />
  );
}

function SelectInput<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-lg px-3 py-1.5 text-sm"
      style={{
        backgroundColor: 'var(--bg)',
        border: '1px solid var(--border)',
        color: 'var(--text-body)',
      }}
    >
      {options.map((opt) => (
        <option key={String(opt.value)} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent',
        'transition-colors duration-200 ease-in-out focus-visible:outline-2',
        'focus-visible:outline-[var(--accent)]',
      ].join(' ')}
      style={{ backgroundColor: checked ? 'var(--accent)' : 'var(--border)' }}
    >
      <span
        className={[
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0',
          'transition duration-200 ease-in-out',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

/* ============================================================
   Colour swatch picker
   ============================================================ */

const SOLARISED_COLOURS: Array<{ name: SolarisedAccent; hex: string }> = [
  { name: 'yellow', hex: '#b58900' },
  { name: 'orange', hex: '#cb4b16' },
  { name: 'red', hex: '#dc322f' },
  { name: 'magenta', hex: '#d33682' },
  { name: 'violet', hex: '#6c71c4' },
  { name: 'blue', hex: '#268bd2' },
  { name: 'cyan', hex: '#2aa198' },
  { name: 'green', hex: '#859900' },
];

function ColourPicker({
  value,
  onChange,
}: {
  value: SolarisedAccent;
  onChange: (c: SolarisedAccent) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SOLARISED_COLOURS.map(({ name, hex }) => (
        <button
          key={name}
          onClick={() => onChange(name)}
          title={name}
          className={[
            'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
            value === name ? 'border-white scale-110 shadow-md' : 'border-transparent',
          ].join(' ')}
          style={{ backgroundColor: hex }}
          aria-label={`Beat marker colour: ${name}`}
          aria-pressed={value === name}
        />
      ))}
    </div>
  );
}

/* ============================================================
   Main settings page
   ============================================================ */

export default function SettingsPage() {
  const { settings, updateDetection, updateDisplay, updateExport, resetToDefaults } =
    useSettingsStore();
  const { preference, setTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="space-y-1">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: 'var(--text-heading)' }}
        >
          Settings
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Configure beat detection parameters, display preferences, and export options.
          All settings are saved automatically.
        </p>
      </div>

      {/* ── Appearance ──────────────────────────────────────────────── */}
      <SettingsSection
        title="Appearance"
        description="Theme, colours, and visual display options."
      >
        {/* Theme */}
        <FieldRow label="Theme" hint="Choose light, dark, or follow the system.">
          <div className="flex gap-2">
            {(
              [
                { value: 'light', label: 'Light', icon: <Sun size={14} /> },
                { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
                { value: 'system', label: 'System', icon: <Monitor size={14} /> },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                  preference === opt.value
                    ? 'ring-2 ring-[var(--accent)]'
                    : 'hover:bg-[var(--bg-alt)]',
                ].join(' ')}
                style={{
                  backgroundColor:
                    preference === opt.value ? 'var(--bg-alt)' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  color:
                    preference === opt.value
                      ? 'var(--accent)'
                      : 'var(--text-muted)',
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </FieldRow>

        {/* Beat marker colour */}
        <FieldRow label="Beat marker colour" hint="Colour used for beat markers in the waveform and charts.">
          <ColourPicker
            value={settings.display.beatMarkerColour}
            onChange={(c) => updateDisplay({ beatMarkerColour: c })}
          />
        </FieldRow>

        {/* Show beat confidence */}
        <FieldRow label="Show beat confidence" hint="Display confidence percentage in the beat timeline table.">
          <Toggle
            checked={settings.display.showBeatConfidence}
            onChange={(v) => updateDisplay({ showBeatConfidence: v })}
          />
        </FieldRow>

        {/* Show onset curve */}
        <FieldRow label="Show onset strength curve" hint="Display the onset strength chart on the main page.">
          <Toggle
            checked={settings.display.showOnsetCurve}
            onChange={(v) => updateDisplay({ showOnsetCurve: v })}
          />
        </FieldRow>

        {/* Histogram bins */}
        <FieldRow label="Histogram bins" hint="Number of buckets in the BPM distribution histogram (10–100).">
          <NumberInput
            value={settings.display.histogramBins}
            min={10}
            max={100}
            step={5}
            onChange={(v) => updateDisplay({ histogramBins: v })}
          />
        </FieldRow>
      </SettingsSection>

      {/* ── Beat Detection ──────────────────────────────────────────── */}
      <SettingsSection
        title="Beat Detection"
        description="Algorithm parameters - changes apply on the next analysis."
      >
        {/* Peak threshold */}
        <FieldRow
          label="Peak threshold"
          hint="Minimum onset strength to be considered a beat (0–1). Higher = fewer beats."
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0.05}
              max={0.9}
              step={0.01}
              value={settings.detection.peakThreshold}
              onChange={(e) =>
                updateDetection({ peakThreshold: parseFloat(e.target.value) })
              }
              className="w-40 accent-[var(--accent)]"
            />
            <span
              className="w-10 text-right text-sm tabular-nums font-mono"
              style={{ color: 'var(--accent)' }}
            >
              {settings.detection.peakThreshold.toFixed(2)}
            </span>
          </div>
        </FieldRow>

        {/* Min beat gap */}
        <FieldRow
          label="Minimum beat gap (s)"
          hint="Minimum time between beats in seconds. Prevents double-detections."
        >
          <NumberInput
            value={settings.detection.minBeatGap}
            min={0.1}
            max={2}
            step={0.05}
            onChange={(v) => updateDetection({ minBeatGap: v })}
          />
        </FieldRow>

        {/* Hop size */}
        <FieldRow
          label="Hop size (samples)"
          hint="Analysis window hop size. Smaller = finer time resolution, slower analysis."
        >
          <SelectInput
            value={settings.detection.hopSize}
            options={[
              { value: 256, label: '256 (fine)' },
              { value: 512, label: '512 (default)' },
              { value: 1024, label: '1024 (fast)' },
              { value: 2048, label: '2048 (fastest)' },
            ]}
            onChange={(v) => updateDetection({ hopSize: Number(v) as 256 | 512 | 1024 | 2048 })}
          />
        </FieldRow>

        {/* Spectral flux */}
        <FieldRow
          label="Use spectral flux"
          hint="Use spectral flux for onset detection (recommended). Disable to use raw energy envelope instead."
        >
          <Toggle
            checked={settings.detection.useSpectralFlux}
            onChange={(v) => updateDetection({ useSpectralFlux: v })}
          />
        </FieldRow>

        {/* Smoothing window */}
        <FieldRow
          label="Smoothing window (frames)"
          hint="Moving average window for the onset curve. Higher = smoother but less responsive."
        >
          <NumberInput
            value={settings.detection.smoothingWindow}
            min={1}
            max={32}
            step={1}
            onChange={(v) => updateDetection({ smoothingWindow: v })}
          />
        </FieldRow>

        {/* BPM range */}
        <FieldRow
          label="BPM range"
          hint="Expected tempo range. Beats outside this range are still detected but excluded from BPM estimation."
        >
          <div className="flex items-center gap-2">
            <NumberInput
              value={settings.detection.bpmMin}
              min={20}
              max={300}
              step={5}
              onChange={(v) => updateDetection({ bpmMin: v })}
            />
            <span style={{ color: 'var(--text-muted)' }} className="text-sm">to</span>
            <NumberInput
              value={settings.detection.bpmMax}
              min={20}
              max={360}
              step={5}
              onChange={(v) => updateDetection({ bpmMax: v })}
            />
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>BPM</span>
          </div>
        </FieldRow>
      </SettingsSection>

      {/* ── Export Defaults ─────────────────────────────────────────── */}
      <SettingsSection
        title="Export Defaults"
        description="Default settings pre-filled in the export panel."
      >
        {/* Default format */}
        <FieldRow label="Default format" hint="Output audio format.">
          <SelectInput
            value={settings.export.format}
            options={[
              { value: 'wav', label: 'WAV (lossless)' },
            ]}
            onChange={(v) => updateExport({ format: v as 'wav' | 'mp3' })}
          />
        </FieldRow>

        {/* Normalise by default */}
        <FieldRow label="Normalise by default" hint="Apply peak normalisation (–1 dBFS) to all exports.">
          <Toggle
            checked={settings.export.normalise}
            onChange={(v) => updateExport({ normalise: v })}
          />
        </FieldRow>

        {/* Default pre-roll */}
        <FieldRow label="Default pre-roll (s)" hint="Audio before each beat slice when cutting.">
          <NumberInput
            value={settings.export.preRoll}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => updateExport({ preRoll: v })}
          />
        </FieldRow>

        {/* Default post-roll */}
        <FieldRow label="Default post-roll (s)" hint="Audio after each beat slice when cutting.">
          <NumberInput
            value={settings.export.postRoll}
            min={0}
            max={2}
            step={0.01}
            onChange={(v) => updateExport({ postRoll: v })}
          />
        </FieldRow>
      </SettingsSection>

      {/* ── About ───────────────────────────────────────────────────── */}
      <SettingsSection title="About">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Version</span>
            <code
              className="rounded px-2 py-0.5 text-xs font-mono"
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--accent)',
              }}
            >
              v{VERSION}
            </code>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            BeatDet: open-source audio beat detection. No data leaves your browser;
            all analysis runs locally via the Web Audio API.
          </p>
        </div>

        <div
          className="flex items-center gap-3 rounded-lg p-4"
          style={{
            backgroundColor: 'var(--bg)',
            border: '1px solid var(--border)',
          }}
        >
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--text-heading)' }}>
              Reset all settings
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Restore every setting to the factory default. This cannot be undone.
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            icon={<RotateCcw size={14} />}
            onClick={() => {
              if (window.confirm('Reset all settings to defaults?')) {
                resetToDefaults();
              }
            }}
          >
            Reset
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
