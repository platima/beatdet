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
  beatMarkerColour: 'orange',
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
  settingsVersion: '2.0.0',
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
      // Migrate persisted settings from older schema versions so returning
      // users don't lose their preferences when new keys are added.
      version: 2,
      migrate: (persisted: unknown, fromVersion: number) => {
        const prev = persisted as Partial<{ settings: Partial<AppSettings> }>;
        const settings = prev?.settings ?? {};

        if (fromVersion < 2) {
          // v1 → v2: add mp3Bitrate and format fields to export, waveformZoom to display
          return {
            ...prev,
            settings: {
              ...settings,
              export: {
                ...DEFAULT_EXPORT,
                ...(settings.export ?? {}),
                mp3Bitrate: (settings.export as Partial<typeof DEFAULT_EXPORT>)?.mp3Bitrate ?? 192,
                format: (settings.export as Partial<typeof DEFAULT_EXPORT>)?.format ?? 'wav',
              },
              display: {
                ...DEFAULT_DISPLAY,
                ...(settings.display ?? {}),
                waveformZoom: (settings.display as Partial<typeof DEFAULT_DISPLAY>)?.waveformZoom ?? 1,
              },
              settingsVersion: '2.0.0',
            },
          };
        }

        return persisted;
      },
    }
  )
);
