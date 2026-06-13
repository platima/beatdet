/**
 * WhatsNewBanner: shown once to returning users after a version upgrade.
 *
 * Compares the version stored in localStorage under 'beatdet-last-seen-version'
 * with NEXT_PUBLIC_APP_VERSION. If they differ (and a previous version was
 * stored, i.e. not a first-time visitor), shows a dismissible banner
 * summarising what's new. Dismissing saves the current version so the banner
 * won't show again until the next upgrade.
 */

'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { CloseButton } from './Button';

const STORAGE_KEY = 'beatdet-last-seen-version';
const CURRENT = process.env.NEXT_PUBLIC_APP_VERSION ?? '';

// Short summary of what's new; update alongside each release. Entries are
// keyed by the version that introduced them; the banner shows the newest
// entry at or below the running version that the user has not yet seen, so
// patch releases without their own entry still surface the latest summary.
const WHATS_NEW: Record<string, string[]> = {
  '0.7.15': [
    'Musical key detection with Camelot code and top candidates',
    'Key accuracy improved via HPSS and retuned chroma analysis',
    'Settings now migrate reliably from any older version',
    'Fresh offline cache for returning PWA users',
  ],
  '0.7.5': [
    'What\'s New banner now appears at the top of the page',
    'Drop a new file onto the loaded-file area to replace it',
    'Playback speed and zoom controls spacing fix',
    'Detection notes toast now anchored to the viewport',
  ],
  '0.3.0': [
    'MP3 export with selectable bitrate',
    'Cut-at-beats now downloads a single ZIP',
    'CSV / JSON beat list export',
    'Waveform zoom slider',
    'In-app changelog (you\'re reading it!)',
    'File size guard and error boundary',
  ],
  '0.2.0': [
    'Space bar plays / pauses the waveform',
    'Click any beat row to seek to that time',
    'BPM ÷2 / ×2 quick-correct buttons',
    'Re-analyse button (no re-upload needed)',
    'Export errors now shown in the panel',
    'Dark / light theme updates waveform colours live',
  ],
};

/**
 * Compare two dotted semver strings numerically.
 * Returns negative when a < b, positive when a > b, zero when equal.
 * Exported for unit testing.
 */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Pick the newest WHATS_NEW entry at or below the running version that is
 * newer than the version the user last saw. Returns null when the user has
 * already seen everything (or the versions cannot be parsed).
 * Exported for unit testing.
 */
export function latestUnseenEntry(
  current: string,
  lastSeen: string,
  entries: Record<string, string[]> = WHATS_NEW
): string[] | null {
  let bestKey: string | null = null;
  for (const key of Object.keys(entries)) {
    const cmpCurrent = compareSemver(key, current);
    const cmpSeen = compareSemver(key, lastSeen);
    // NaN comparisons (unparseable versions) skip the entry, so corrupt
    // stored values degrade to the changelog fallback instead of guessing.
    if (!(cmpCurrent <= 0) || !(cmpSeen > 0)) continue;
    if (bestKey === null || compareSemver(key, bestKey) > 0) bestKey = key;
  }
  return bestKey ? entries[bestKey] : null;
}

export function WhatsNewBanner() {
  const [visible, setVisible] = useState(false);
  const [lastSeen, setLastSeen] = useState('');

  // Reading from localStorage (external system) and conditionally setting
  // visibility is the textbook use case for useEffect + setState.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      // Only show to returning users who have a stored version that differs
      if (last && last !== CURRENT && CURRENT) {
        setLastSeen(last);
        setVisible(true);
      }
      // Always update stored version to current
      if (CURRENT) localStorage.setItem(STORAGE_KEY, CURRENT);
    } catch {
      // localStorage unavailable; skip silently
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!visible) return null;

  const items = latestUnseenEntry(CURRENT, lastSeen);

  return (
    <div
      role="status"
      className="rounded-xl p-4 space-y-2"
      style={{
        backgroundColor: 'var(--bg-panel)',
        border: '1px solid var(--accent)',
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <p className="text-sm font-semibold" style={{ color: 'var(--text-heading)' }}>
          What&apos;s new in v{CURRENT}
        </p>
        <CloseButton
          onClick={() => setVisible(false)}
          label="Dismiss what's new"
          className="ml-auto"
        />
      </div>

      {items && items.length > 0 ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0.5 pl-1">
          {items.map((item) => (
            <li key={item} className="flex gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent)' }}>–</span>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          See the <a href="/changelog" className="underline" style={{ color: 'var(--accent)' }}>changelog</a> for details.
        </p>
      )}
    </div>
  );
}
