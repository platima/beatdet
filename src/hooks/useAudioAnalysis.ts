/**
 * useAudioAnalysis: manages the full lifecycle of audio analysis.
 *
 * Handles:
 *   - File selection and validation.
 *   - AudioBuffer decoding and beat detection.
 *   - Progress reporting.
 *   - Session persistence.
 *   - Error handling.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { analyseAudio } from '@/lib/beatDetection';
import { saveSession, loadSessionMeta, loadSessionAudio, clearSession } from '@/lib/sessionStorage';
import type { AnalysisResult, AnalysisStatus, AudioFileInfo } from '@/types';
import { useSettingsStore } from '@/store/settingsStore';

const ACCEPTED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac'];
const ACCEPTED_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.aac'];
// Maximum file size before prompting the user (200 MB)
const MAX_FILE_BYTES = 200 * 1024 * 1024;

export interface UseAudioAnalysisReturn {
  status: AnalysisStatus;
  progress: number;
  fileInfo: AudioFileInfo | null;
  audioBuffer: ArrayBuffer | null;
  result: AnalysisResult | null;
  error: string | null;
  analyseFile: (file: File) => Promise<void>;
  clearAll: () => void;
  restoreSession: () => boolean;
  /** Re-run analysis on the last uploaded file using current settings. */
  reanalyse: (() => Promise<void>) | null;
}

export function useAudioAnalysis(): UseAudioAnalysisReturn {
  const settings = useSettingsStore((s) => s.settings.detection);

  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [fileInfo, setFileInfo] = useState<AudioFileInfo | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<ArrayBuffer | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the current object URL so we can revoke it on clear
  const objectUrlRef = useRef<string | null>(null);
  // Keep a reference to the last uploaded File for re-analysis
  const lastFileRef = useRef<File | null>(null);

  const clearAll = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setStatus('idle');
    setProgress(0);
    setFileInfo(null);
    setAudioBuffer(null);
    setResult(null);
    setError(null);
    clearSession();
  }, []);

  /**
   * Attempt to restore the last session from storage.
   * Returns true if a session was found and restored.
   */
  const restoreSession = useCallback((): boolean => {
    const meta = loadSessionMeta();
    const audio = loadSessionAudio();

    if (!meta) return false;

    // Restore metadata (without audio if it was too large to persist)
    const objectUrl = audio
      ? URL.createObjectURL(new Blob([audio], { type: meta.fileType }))
      : '';

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = objectUrl;

    setFileInfo({
      name: meta.fileName,
      size: meta.fileSize,
      type: meta.fileType,
      objectUrl,
      sessionKey: '',
    });
    setAudioBuffer(audio);
    setResult(meta.result);
    setStatus('complete');
    setError(null);
    setProgress(1);

    return true;
  }, []);

  const analyseFile = useCallback(
    async (file: File): Promise<void> => {
      // Validate file type
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const validType = ACCEPTED_TYPES.some((t) => file.type.includes(t.split('/')[1]));
      const validExt = ACCEPTED_EXTENSIONS.includes(`.${ext}`);

      if (!validType && !validExt) {
        setError(
          `Unsupported file type. Accepted formats: WAV, MP3, M4A, AAC.`
        );
        setStatus('error');
        return;
      }

      // Guard against very large files that may OOM the browser tab
      if (file.size > MAX_FILE_BYTES) {
        setError(
          `File is too large (${(file.size / (1024 * 1024)).toFixed(0)} MB). Maximum supported size is 200 MB.`
        );
        setStatus('error');
        return;
      }

      // Revoke any previous object URL
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;

      setStatus('loading');
      // Emit -1 as sentinel during file-read phase (indeterminate progress)
      setProgress(-1);
      setError(null);
      setResult(null);

      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type || `audio/${ext}`,
        objectUrl,
        sessionKey: '',
      });

      // Store reference so the user can re-analyse with updated settings
      lastFileRef.current = file;

      try {
        // Read file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        setAudioBuffer(arrayBuffer);
        setStatus('analysing');

        // Run beat detection
        const analysisResult = await analyseAudio(
          arrayBuffer,
          settings,
          (p) => setProgress(p)
        );

        setResult(analysisResult);
        setStatus('complete');

        // Persist session
        saveSession(file, analysisResult, arrayBuffer);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'An unexpected error occurred.';
        setError(`Analysis failed: ${message}`);
        setStatus('error');
        console.error('[BeatDet] Analysis error:', err);
      }
    },
    [settings]
  );

  return {
    status,
    progress,
    fileInfo,
    audioBuffer,
    result,
    error,
    analyseFile,
    clearAll,
    restoreSession,
    reanalyse: lastFileRef.current ? () => analyseFile(lastFileRef.current!) : null,
  };
}
