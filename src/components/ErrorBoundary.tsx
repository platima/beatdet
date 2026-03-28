/**
 * ErrorBoundary: catches render errors in child components and displays
 * a friendly fallback rather than crashing the entire page.
 *
 * Wrap individual result sections (BpmDisplay, BeatList, charts, etc.)
 * so that a bug in one component does not blank out the whole UI.
 */

'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  /** Label shown in the error fallback to help identify which section failed. */
  label?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[BeatDet] Render error in ${this.props.label ?? 'component'}:`, error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-start gap-3 rounded-xl p-4"
          style={{
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--warning)',
            color: 'var(--warning)',
          }}
        >
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">
              {this.props.label ? `${this.props.label} failed to render` : 'A component failed to render'}
            </p>
            <p className="text-xs mt-1 opacity-80">{this.state.message}</p>
            <button
              className="mt-2 text-xs underline"
              onClick={() => this.setState({ hasError: false, message: '' })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
