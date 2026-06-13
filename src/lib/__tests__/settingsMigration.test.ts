/**
 * Unit tests for the settings store schema migrations.
 *
 * migrateSettings must chain every step between the persisted version and
 * the current schema, fill any missing fields with defaults, preserve the
 * values a user had already set, and always land on settingsVersion 5.0.0.
 */

import { migrateSettings, DEFAULT_SETTINGS } from '@/store/settingsStore';
import type { AppSettings } from '@/types';

/** Convenience: run a persisted shape through migrate and unwrap settings. */
function migrate(persisted: unknown, fromVersion: number): AppSettings {
  const out = migrateSettings(persisted, fromVersion) as { settings: AppSettings };
  return out.settings;
}

describe('migrateSettings', () => {
  it('migrates a v1 user through every step to settingsVersion 5.0.0', () => {
    // v1 shape: no mp3Bitrate/format, no waveformZoom/waveformHeight,
    // no classicUi, no showKey.
    const v1 = {
      settings: {
        detection: { ...DEFAULT_SETTINGS.detection, bpmMin: 60 },
        display: {
          theme: 'dark',
          showBeatConfidence: false,
          histogramBins: 30,
          showOnsetCurve: true,
        },
        export: { mode: 'full', preRoll: 0.1, postRoll: 0.1, normalise: true },
        settingsVersion: '1.0.0',
      },
    };

    const settings = migrate(v1, 1);

    // Every step ran: version is current, not stuck at 2.0.0.
    expect(settings.settingsVersion).toBe('5.0.0');

    // New fields filled with defaults.
    expect(settings.export.mp3Bitrate).toBe(192);
    expect(settings.export.format).toBe('wav');
    expect(settings.display.waveformZoom).toBe(1);
    expect(settings.display.waveformHeight).toBe(120);
    expect(settings.display.classicUi).toBe(false);
    expect(settings.display.showKey).toBe(true);

    // User values preserved through the chain.
    expect(settings.display.theme).toBe('dark');
    expect(settings.display.showBeatConfidence).toBe(false);
    expect(settings.display.histogramBins).toBe(30);
    expect(settings.export.normalise).toBe(true);
    expect(settings.export.preRoll).toBe(0.1);
    expect(settings.detection.bpmMin).toBe(60);
  });

  it.each([2, 3, 4] as const)(
    'migrates a v%i user to settingsVersion 5.0.0 with all fields populated',
    (fromVersion) => {
      const persisted = {
        settings: {
          ...DEFAULT_SETTINGS,
          display: { ...DEFAULT_SETTINGS.display, theme: 'light' },
          settingsVersion: `${fromVersion}.0.0`,
        },
      };

      const settings = migrate(persisted, fromVersion);

      expect(settings.settingsVersion).toBe('5.0.0');
      expect(settings.display.theme).toBe('light');
      // All current display keys exist.
      for (const key of Object.keys(DEFAULT_SETTINGS.display)) {
        expect(settings.display).toHaveProperty(key);
      }
      for (const key of Object.keys(DEFAULT_SETTINGS.export)) {
        expect(settings.export).toHaveProperty(key);
      }
    }
  );

  it('preserves explicit user choices made in later schema versions', () => {
    const v4 = {
      settings: {
        ...DEFAULT_SETTINGS,
        display: { ...DEFAULT_SETTINGS.display, classicUi: true },
        settingsVersion: '4.0.0',
      },
    };

    const settings = migrate(v4, 4);

    expect(settings.display.classicUi).toBe(true);
    expect(settings.display.showKey).toBe(true);
    expect(settings.settingsVersion).toBe('5.0.0');
  });

  it('returns current-version state unchanged', () => {
    const v5 = { settings: { ...DEFAULT_SETTINGS } };
    expect(migrateSettings(v5, 5)).toBe(v5);
  });

  it('fills full defaults when the persisted state is empty or malformed', () => {
    const settings = migrate({}, 1);

    expect(settings.settingsVersion).toBe('5.0.0');
    expect(settings.display).toEqual(DEFAULT_SETTINGS.display);
    expect(settings.export).toEqual(DEFAULT_SETTINGS.export);
  });
});
