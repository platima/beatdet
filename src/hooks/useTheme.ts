/**
 * useTheme — manages light/dark/system theme switching.
 *
 * Applies the theme as a data-theme attribute on the <html> element
 * so Solarised CSS variables activate correctly. System preference
 * changes are tracked via a MediaQueryList listener.
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

type EffectiveTheme = 'light' | 'dark';

/** Return the effective theme (resolving 'system' to light or dark). */
function resolveTheme(
  preference: 'light' | 'dark' | 'system'
): EffectiveTheme {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(effective: EffectiveTheme): void {
  document.documentElement.setAttribute('data-theme', effective);
}

export function useTheme() {
  const preference = useSettingsStore((s) => s.settings.display.theme);
  const updateDisplay = useSettingsStore((s) => s.updateDisplay);

  // Apply theme whenever preference changes
  useEffect(() => {
    const effective = resolveTheme(preference);
    applyTheme(effective);

    if (preference !== 'system') return;

    // Track system preference changes while in 'system' mode
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      applyTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [preference]);

  const toggleTheme = useCallback(() => {
    const effective = resolveTheme(preference);
    updateDisplay({ theme: effective === 'dark' ? 'light' : 'dark' });
  }, [preference, updateDisplay]);

  const setTheme = useCallback(
    (t: 'light' | 'dark' | 'system') => updateDisplay({ theme: t }),
    [updateDisplay]
  );

  return {
    preference,
    effective: typeof window !== 'undefined' ? resolveTheme(preference) : 'light',
    toggleTheme,
    setTheme,
  };
}
