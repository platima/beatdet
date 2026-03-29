/**
 * ServiceWorkerRegistrar: registers the BeatDet service worker on mount.
 *
 * Rendered at the root layout level; returns null (no visible output).
 * Registration is skipped in environments that do not support service workers.
 */

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          console.warn('[BeatDet] Service worker registration failed:', err);
        });
    }
  }, []);

  return null;
}
