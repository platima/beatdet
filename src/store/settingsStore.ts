/**
 * Global settings store: backed by Zustand with localStorage persistence.
 *
 * Default values follow modern beat-detection best-practice presets
 * and Australian English spelling conventions in comments.
 */

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, DetectionSettings, DisplaySettings, ExportOptions } from '@/types';

/* ============================================================
   Defaults
   ============================================================ */

const DEFAULT_DETECTION: DetectionSettings = {
  minBeatGap: 0.3,
  peakThreshold: 0.15,
  hopSize: 512,
  useSpectralFlux: true,
  smoothingWindow: 8,
  bpmMin: 55,
  bpmMax: 200,
};

const DEFAULT_DISPLAY: DisplaySettings = {
  theme: 'system',
  showBeatConfidence: true,
  histogramBins: 40,
  showOnsetCurve: true,
  waveformZoom: 1,
  waveformHeight: 120,
  beatMarkerColour: 'orange',
  classicUi: false,
  showKey: true,
};

const DEFAULT_EXPORT: ExportOptions = {
  format: 'wav',
  mode: 'full',
  preRoll: 0.05,
  postRoll: 0.05,
  normalise: false,
  mp3Bitrate: 192,
};

export const DEFAULT_SETTINGS: AppSettings = {
  detection: DEFAULT_DETECTION,
  display: DEFAULT_DISPLAY,
  export: DEFAULT_EXPORT,
  settingsVersion: '5.0.0',
};

/* ============================================================
   Store definition
   ============================================================ */

interface SettingsStore {
  settings: AppSettings;

  /** Replace an individual detection sub-setting. */
  updateDetection: (patch: Partial<DetectionSettings>) => void;
  /** Replace an individual display sub-setting. */
  updateDisplay: (patch: Partial<DisplaySettings>) => void;
  /** Replace an individual export sub-setting. */
  updateExport: (patch: Partial<ExportOptions>) => void;
  /** Restore all settings to factory defaults. */
  resetToDefaults: () => void;
}

/* ============================================================
   Migrations
   ============================================================ */

/**
 * Migrate persisted settings from older schema versions so returning users
 * don't lose their preferences when new keys are added.
 *
 * Each step applies in sequence (no early returns), so a user arriving from
 * any old version passes through every intermediate migration and always
 * lands on the current settingsVersion. Exported for unit testing.
 */
export function migrateSettings(persisted: unknown, fromVersion: number): unknown {
  if (fromVersion >= 5) return persisted;

  const prev = persisted as Partial<{ settings: Partial<AppSettings> }>;
  let settings: Partial<AppSettings> = prev?.settings ?? {};

  if (fromVersion < 2) {
    // v1 → v2: add mp3Bitrate and format fields to export, waveformZoom to
    // display. Spreading the defaults first fills any missing keys while
    // preserving values the user had already set.
    settings = {
      ...settings,
      export: { ...DEFAULT_EXPORT, ...(settings.export ?? {}) },
      display: { ...DEFAULT_DISPLAY, ...(settings.display ?? {}) },
      settingsVersion: '2.0.0',
    };
  }

  if (fromVersion < 3) {
    // v2 → v3: waveformHeight gets a medium (120 px) default for returning
    // users who were on v0.4.2 before this default was introduced.
    settings = {
      ...settings,
      display: {
        ...DEFAULT_DISPLAY,
        ...(settings.display ?? {}),
        waveformHeight: settings.display?.waveformHeight ?? 120,
      },
      settingsVersion: '3.0.0',
    };
  }

  if (fromVersion < 4) {
    // v3 → v4: classicUi toggle for returning users who prefer the flat
    // look; defaults to false (modern UI enabled).
    settings = {
      ...settings,
      display: {
        ...DEFAULT_DISPLAY,
        ...(settings.display ?? {}),
        classicUi: settings.display?.classicUi ?? false,
      },
      settingsVersion: '4.0.0',
    };
  }

  // v4 → v5: showKey enables the key detection panel for returning users.
  settings = {
    ...settings,
    display: {
      ...DEFAULT_DISPLAY,
      ...(settings.display ?? {}),
      showKey: settings.display?.showKey ?? true,
    },
    settingsVersion: '5.0.0',
  };

  return { ...prev, settings };
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,

      updateDetection: (patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            detection: { ...state.settings.detection, ...patch },
          },
        })),

      updateDisplay: (patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            display: { ...state.settings.display, ...patch },
          },
        })),

      updateExport: (patch) =>
        set((state) => ({
          settings: {
            ...state.settings,
            export: { ...state.settings.export, ...patch },
          },
        })),

      resetToDefaults: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'beatdet-settings',
      version: 5,
      migrate: migrateSettings,
    }
  )
);
