/**
 * Apple touch icon (180x180 PNG) generated at build time via ImageResponse.
 * Used by iOS for the home-screen icon when the user adds BeatDet to their
 * home screen, and referenced in the PWA manifest.
 */

import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#268bd2',
        }}
      >
        {/* Waveform polyline matching src/app/icon.svg */}
        <svg
          viewBox="0 0 32 32"
          width="68%"
          height="68%"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="2,16 7,16 9,8 12,24 15,12 18,20 21,16 30,16" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
