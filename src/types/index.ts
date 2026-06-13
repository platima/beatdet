/**
 * Core type definitions for BeatDet.
 *
 * Covers audio analysis results, application settings,
 * session state, and export options.
 */

/* ============================================================
   Audio analysis
   ============================================================ */

/** A single detected beat, identified by its timestamp in seconds. */
export interface Beat {
  /** Time in seconds from the start of the track. */
  time: number;
  /** Relative energy/confidence of this beat (0–1). */
  confidence: number;
}

/** BPM estimate with confidence metrics. */
export interface BpmEstimate {
  /** Primary tempo in beats per minute. */
  bpm: number;
  /** Secondary candidates (e.g. half/double tempo). */
  candidates: Array<{ bpm: number; score: number }>;
  /** Overall confidence of the primary estimate (0–1). */
  confidence: number;
  /**
   * The harmonic ratio applied to auto-correct the raw winner, if any.
   * e.g. 0.5 means the raw leader was halved; 1.5 means it was promoted.
   * undefined when no correction was applied.
   */
  correctionRatio?: number;
}

/** A single key candidate with its Camelot code and correlation confidence. */
export interface KeyCandidate {
  /** Note name, e.g. "C", "F#", "Bb". */
  key: string;
  mode: 'major' | 'minor';
  /** Normalised confidence (0–1; 1 = best match among all 24 candidates). */
  confidence: number;
  /** Camelot Wheel code, e.g. "8B" or "10A". */
  camelot: string;
}

/** Musical key estimate produced by the Krumhansl-Kessler algorithm. */
export interface KeyEstimate {
  /** Note name, e.g. "C", "F#", "Bb". */
  key: string;
  mode: 'major' | 'minor';
  /** Human-readable label, e.g. "C Major", "F# Minor". */
  display: string;
  /** Normalised confidence (0–1). */
  confidence: number;
  /** Camelot Wheel code, e.g. "8B". */
  camelot: string;
  /** Relative key as a human-readable string, e.g. "A Minor". */
  relativeKey: string;
  /** Top-5 key candidates ranked by confidence descending. */
  candidates: KeyCandidate[];
  /** True when confidence is too low to be reliable. */
  ambiguous: boolean;
  /**
   * Human-readable runner-up key (e.g. "E Minor") when its correlation is
   * within the close-call gap of the winner, signalling that the track could
   * plausibly be either key. Undefined when the winner is clear.
   */
  closeCall?: string;
}

/** Full result produced by the beat detection engine. */
export interface AnalysisResult {
  /** Detected beats, sorted by time ascending. */
  beats: Beat[];
  /** BPM estimate. */
  bpmEstimate: BpmEstimate;
  /** Key estimate (undefined if detection was skipped). */
  keyEstimate?: KeyEstimate;
  /** Onset strength over time (parallel arrays). */
  onsetTimes: number[];
  onsetStrengths: number[];
  /** Length of the analysed audio in seconds. */
  duration: number;
  /** Sample rate of the analysed audio. */
  sampleRate: number;
}

/** Status of an in-progress or completed analysis. */
export type AnalysisStatus =
  | 'idle'
  | 'loading'
  | 'analysing'
  | 'complete'
  | 'error';

/** File information captured at upload time. */
export interface AudioFileInfo {
  name: string;
  size: number;
  type: string;
  /** Object URL for playback (must be revoked when no longer needed). */
  objectUrl: string;
  /** Persisted session key - Base64 of the audio data. */
  sessionKey: string;
}

/* ============================================================
   Export / cut options
   ============================================================ */

/** Export format for audio output. */
export type ExportFormat = 'wav' | 'mp3';

/** How to slice the audio for export. */
export type ExportMode =
  /** Export the entire audio with beat markers embedded in metadata. */
  | 'full'
  /** Extract only the segments that contain beats. */
  | 'isolate-beats'
  /** Slice the audio at beat boundaries and download as a ZIP. */
  | 'cut-at-beats'
  /** Export a custom time range. */
  | 'custom-range';

export interface ExportOptions {
  format: ExportFormat;
  mode: ExportMode;
  /** Pre-roll before each beat slice in seconds (for cut-at-beats mode). */
  preRoll: number;
  /** Post-roll after each beat slice in seconds (for cut-at-beats mode). */
  postRoll: number;
  /** Custom start time in seconds (for custom-range mode). */
  rangeStart?: number;
  /** Custom end time in seconds (for custom-range mode). */
  rangeEnd?: number;
  /** Normalise output loudness to –1 dBFS peak. */
  normalise: boolean;
  /** Bitrate in kbps for MP3 export. */
  mp3Bitrate: 128 | 192 | 256 | 320;
}

/* ============================================================
   Settings
   ============================================================ */

/** Beat detection algorithm parameters: exposed in the Settings page. */
export interface DetectionSettings {
  /**
   * Minimum inter-beat gap in seconds.
   * Prevents double-detections at high tempo.
   */
  minBeatGap: number;
  /** Peak-picking threshold (0–1). Higher = fewer, stronger beats. */
  peakThreshold: number;
  /** Onset detection window size in samples (power of 2). */
  hopSize: 256 | 512 | 1024 | 2048;
  /** Whether to use spectral flux (vs. energy envelope) for onset detection. */
  useSpectralFlux: boolean;
  /** Smooth the onset strength curve with this window (in frames). */
  smoothingWindow: number;
  /**
   * BPM range to search; outside this range beats are still detected
   * but the BPM estimator ignores them for tempo clustering.
   */
  bpmMin: number;
  bpmMax: number;
}

/** Visual display preferences. */
export interface DisplaySettings {
  /** Which colour theme to use. */
  theme: 'light' | 'dark' | 'system';
  /** Show beat confidence values in the timeline view. */
  showBeatConfidence: boolean;
  /** Number of histogram bins for the BPM distribution chart. */
  histogramBins: number;
  /** Show onset strength curve on the waveform display. */
  showOnsetCurve: boolean;
  /** Waveform zoom level (1 = full track, higher = more zoomed in). */
  waveformZoom: number;
  /** Height of the waveform canvas in pixels. */
  waveformHeight: number;
  /** Colour used for beat markers (Solarised colour name). */
  beatMarkerColour: SolarisedAccent;
  /** Use the pre-v0.5.2 flat UI instead of the modern elevated style. */
  classicUi: boolean;
  /** Show the detected musical key in the results panel. */
  showKey: boolean;
}

/** All application settings, persisted to localStorage. */
export interface AppSettings {
  detection: DetectionSettings;
  display: DisplaySettings;
  export: ExportOptions;
  /** App version that last wrote this settings object. */
  settingsVersion: string;
}

/** The names of the Solarised accent colours available for UI customisation. */
export type SolarisedAccent =
  | 'yellow'
  | 'orange'
  | 'red'
  | 'magenta'
  | 'violet'
  | 'blue'
  | 'cyan'
  | 'green';

/* ============================================================
   Session state (persisted across page reloads)
   ============================================================ */

/** Minimal persisted session: holds enough to restore the last analysis. */
export interface PersistedSession {
  /** The file name displayed to the user. */
  fileName: string;
  /** File size in bytes. */
  fileSize: number;
  /** MIME type. */
  fileType: string;
  /** Base64-encoded audio data (may be large; stored in sessionStorage). */
  audioBase64: string;
  /** The completed analysis result for this file. */
  result: AnalysisResult;
  /** ISO timestamp of when this session was created. */
  createdAt: string;
}

/* ============================================================
   UI state (in-memory only, not persisted)
   ============================================================ */

/** Playback state passed between components. */
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}
