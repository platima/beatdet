/**
 * 192x192 PNG icon generated at build time via ImageResponse.
 * Used in the PWA manifest for Android home-screen and Chrome install prompt.
 */

import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon192() {
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
