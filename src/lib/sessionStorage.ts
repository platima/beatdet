/**
 * Session persistence utilities.
 *
 * Audio blobs are stored in sessionStorage (cleared when the tab closes)
 * while analysis results are stored in localStorage so they survive full
 * page reloads. Base64 encoding is used to store binary data in Web Storage.
 *
 * Keys:
 *   beatdet-session-meta   — JSON metadata + analysis result (localStorage)
 *   beatdet-session-audio  — Base64-encoded audio bytes (sessionStorage)
 */

import type { PersistedSession, AnalysisResult } from '@/types';

const META_KEY = 'beatdet-session-meta';
const AUDIO_KEY = 'beatdet-session-audio';

/** Maximum audio file size we'll attempt to persist (25 MB). */
const MAX_PERSIST_BYTES = 25 * 1024 * 1024;

/* ============================================================
   Save session
   ============================================================ */

/**
 * Persist an analysis session.
 *
 * @param file    The original File object.
 * @param result  The completed analysis result.
 * @param buffer  The raw ArrayBuffer of audio data.
 */
export function saveSession(
  file: File,
  result: AnalysisResult,
  buffer: ArrayBuffer
): void {
  try {
    // Persist metadata + result in localStorage
    const meta: Omit<PersistedSession, 'audioBase64'> = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      result,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(META_KEY, JSON.stringify(meta));

    // Persist audio in sessionStorage if small enough
    if (buffer.byteLength <= MAX_PERSIST_BYTES) {
      const base64 = arrayBufferToBase64(buffer);
      sessionStorage.setItem(AUDIO_KEY, base64);
    } else {
      sessionStorage.removeItem(AUDIO_KEY);
    }
  } catch {
    // Storage quota exceeded or private browsing — silently ignore.
    console.warn('[BeatDet] Could not persist session to storage.');
  }
}

/* ============================================================
   Load session
   ============================================================ */

/** Metadata stored without the audio blob. */
export interface SessionMeta {
  fileName: string;
  fileSize: number;
  fileType: string;
  result: AnalysisResult;
  createdAt: string;
}

/**
 * Load the persisted session metadata and analysis result.
 * Returns null if no session has been saved or data is corrupt.
 */
export function loadSessionMeta(): SessionMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionMeta;
  } catch {
    return null;
  }
}

/**
 * Load the persisted audio bytes.
 * Returns null if no audio was stored (file was too large) or tab was closed.
 */
export function loadSessionAudio(): ArrayBuffer | null {
  try {
    const base64 = sessionStorage.getItem(AUDIO_KEY);
    if (!base64) return null;
    return base64ToArrayBuffer(base64);
  } catch {
    return null;
  }
}

/* ============================================================
   Clear session
   ============================================================ */

/** Remove all persisted session data. */
export function clearSession(): void {
  localStorage.removeItem(META_KEY);
  sessionStorage.removeItem(AUDIO_KEY);
}

/* ============================================================
   Binary ↔ Base64 helpers
   ============================================================ */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process in chunks to stay within call stack limits
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
