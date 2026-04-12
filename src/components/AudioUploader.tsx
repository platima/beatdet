/**
 * AudioUploader: drag-and-drop / click-to-browse file input for audio files.
 *
 * Accepts WAV, MP3, and M4A. Displays file information once a file is
 * selected and provides a clear button to remove the current file.
 */

'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, Music, X, FileAudio } from 'lucide-react';
import { Button } from './Button';
import type { AudioFileInfo } from '@/types';

interface AudioUploaderProps {
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  fileInfo: AudioFileInfo | null;
  disabled?: boolean;
}

const ACCEPTED = '.wav,.mp3,.m4a,.aac';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioUploader({
  onFileSelect,
  onClear,
  fileInfo,
  disabled = false,
}: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file || disabled) return;
      onFileSelect(file);
    },
    [onFileSelect, disabled]
  );

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear the drag state when the pointer actually leaves this element,
    // not when it moves over a child element (which fires a spurious dragleave).
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    // Reset input value so the same file can be re-selected after clearing
    e.target.value = '';
  };

  // ─── File selected state ───────────────────────────────────────────────────

  if (fileInfo) {
    return (
      <div
        className="ui-panel relative flex items-center gap-4 rounded-xl p-4"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          backgroundColor: isDragging ? 'var(--bg-alt)' : 'var(--bg-panel)',
          border: `1px solid ${isDragging ? 'var(--accent)' : 'var(--border)'}`,
        }}
      >
        {/* Overlay hint shown while dragging a replacement file */}
        {isDragging && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none"
            style={{ backgroundColor: 'color-mix(in srgb, var(--bg-alt) 80%, transparent)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>Drop to replace</p>
          </div>
        )}
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: 'var(--bg)', color: 'var(--accent)' }}
        >
          <FileAudio size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-medium"
            style={{ color: 'var(--text-heading)' }}
          >
            {fileInfo.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {formatBytes(fileInfo.size)} · {fileInfo.type || 'audio'}
          </p>
        </div>

        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            icon={<X size={16} />}
            title="Remove file"
            aria-label="Remove file"
          />
        )}
      </div>
    );
  }

  // ─── Empty / drag-drop state ───────────────────────────────────────────────

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label="Upload audio file"
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          inputRef.current?.click();
        }
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        'ui-upload-zone flex flex-col items-center justify-center gap-4 rounded-xl p-10',
        'border-2 border-dashed cursor-pointer',
        'transition-all duration-200 select-none',
        isDragging ? 'drop-active scale-[1.01]' : '',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-[var(--accent)]',
      ].join(' ')}
      style={{
        borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
        backgroundColor: isDragging ? 'var(--bg-alt)' : 'var(--bg-panel)',
        color: 'var(--text-muted)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="sr-only"
        onChange={handleInputChange}
        disabled={disabled}
        aria-hidden="true"
      />

      <div
        className="flex h-16 w-16 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--bg)', color: 'var(--accent)' }}
      >
        {isDragging ? (
          <Music size={30} />
        ) : (
          <Upload size={30} />
        )}
      </div>

      <div className="text-center">
        <p className="text-base font-medium" style={{ color: 'var(--text-body)' }}>
          {isDragging ? 'Drop your audio file here' : 'Upload an audio file'}
        </p>
        <p className="mt-1 text-sm">
          Drag and drop, or{' '}
          <span style={{ color: 'var(--accent)' }} className="font-medium">
            click to browse
          </span>
        </p>
        <p className="mt-2 text-xs">Supports WAV · MP3 · M4A · AAC</p>
      </div>
    </div>
  );
}
