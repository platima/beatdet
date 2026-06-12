/**
 * Unit tests for the session persistence helpers.
 *
 * Runs in the Node environment, so Web Storage is replaced with simple
 * in-memory fakes installed on globalThis before each test.
 */

import {
  saveSession,
  loadSessionMeta,
  loadSessionAudio,
  clearSession,
} from '@/lib/sessionStorage';
import type { AnalysisResult } from '@/types';

/** Minimal Storage fake backed by a Map. */
function makeStorageFake(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

function installStorage(name: 'localStorage' | 'sessionStorage', storage: Storage): void {
  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
    writable: true,
  });
}

/** Minimal AnalysisResult stand-in; the helpers treat it as opaque JSON. */
const fakeResult = {
  beats: [{ time: 0.5, confidence: 0.9 }],
  bpmEstimate: { bpm: 120, confidence: 0.8 },
  duration: 30,
} as unknown as AnalysisResult;

function makeFile(name = 'track.mp3'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'audio/mpeg' });
}

describe('sessionStorage helpers', () => {
  beforeEach(() => {
    installStorage('localStorage', makeStorageFake());
    installStorage('sessionStorage', makeStorageFake());
  });

  it('round-trips metadata and audio bytes', () => {
    const audio = new Uint8Array([10, 20, 30, 40, 250]).buffer;

    saveSession(makeFile('song.mp3'), fakeResult, audio);

    const meta = loadSessionMeta();
    expect(meta).not.toBeNull();
    expect(meta!.fileName).toBe('song.mp3');
    expect(meta!.fileType).toBe('audio/mpeg');
    expect(meta!.result).toEqual(fakeResult);
    expect(typeof meta!.createdAt).toBe('string');

    const restored = loadSessionAudio();
    expect(restored).not.toBeNull();
    expect(Array.from(new Uint8Array(restored!))).toEqual([10, 20, 30, 40, 250]);
  });

  it('skips audio persistence for oversize buffers but keeps metadata', () => {
    const oversize = new ArrayBuffer(25 * 1024 * 1024 + 1);

    saveSession(makeFile(), fakeResult, oversize);

    expect(loadSessionMeta()).not.toBeNull();
    expect(loadSessionAudio()).toBeNull();
  });

  it('returns null metadata when the stored JSON is corrupt', () => {
    localStorage.setItem('beatdet-session-meta', '{not valid json');
    expect(loadSessionMeta()).toBeNull();
  });

  it('returns null audio when the stored Base64 is corrupt', () => {
    sessionStorage.setItem('beatdet-session-audio', '!!!not-base64!!!');
    expect(loadSessionAudio()).toBeNull();
  });

  it('returns null when nothing has been saved', () => {
    expect(loadSessionMeta()).toBeNull();
    expect(loadSessionAudio()).toBeNull();
  });

  it('swallows quota errors without throwing and warns instead', () => {
    const throwing = makeStorageFake();
    throwing.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    installStorage('localStorage', throwing);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => saveSession(makeFile(), fakeResult, new ArrayBuffer(8))).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('clearSession removes both keys', () => {
    saveSession(makeFile(), fakeResult, new Uint8Array([1]).buffer);
    expect(loadSessionMeta()).not.toBeNull();

    clearSession();

    expect(loadSessionMeta()).toBeNull();
    expect(loadSessionAudio()).toBeNull();
  });
});
