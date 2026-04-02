/**
 * PWA web app manifest.
 * Provides the metadata browsers need to make BeatDet installable as a
 * progressive web app (home-screen icon, splash colour, display mode, etc.).
 *
 * Icons are generated at build time from the icon convention files:
 *   app/apple-icon.tsx  -> /apple-icon.png (180x180)
 *   app/icon1.tsx       -> /icon1.png      (192x192)
 *   app/icon2.tsx       -> /icon2.png      (512x512)
 */

import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BeatDet: Audio Beat Detection',
    short_name: 'BeatDet',
    description:
      'Browser-based beat detection: BPM, waveform, onset charts, and audio export. No data leaves your browser.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    // Solarised Dark base03 for splash / background; accent blue for theme.
    background_color: '#002b36',
    theme_color: '#268bd2',
    categories: ['music', 'utilities'],
    icons: [
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon1.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon2.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
