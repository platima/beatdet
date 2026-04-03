/**
 * NavBar: top navigation bar with app title, version, theme toggle
 * and link to the settings page.
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Settings, Sun, Moon, Monitor, ScrollText, Keyboard } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

// Version is injected at build time from the VERSION file via next.config.ts.
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

export function NavBar() {
  const pathname = usePathname();
  const { preference, toggleTheme } = useTheme();
  const [showHelp, setShowHelp] = React.useState(false);

  const ThemeIcon =
    preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor;

  // Global '?' key toggles the shortcuts panel
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== '?') return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;
      setShowHelp((v) => !v);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <header
      className="ui-navbar sticky top-0 z-50 w-full border-b"
      style={{
        backgroundColor: 'var(--bg-alt)',
        borderColor: 'var(--border)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo + title */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[var(--text-heading)] hover:text-[var(--accent)] transition-colors"
        >
          <Activity size={22} strokeWidth={2} />
          <span className="text-lg font-semibold tracking-tight">BeatDet</span>
        </Link>
        {/* Version badge links to the in-app changelog */}
        <Link
          href="/changelog"
          title="View changelog"
          className="hidden rounded px-1.5 py-0.5 text-xs font-mono sm:inline transition-colors hover:border-[var(--accent)]"
          style={{
            backgroundColor: 'var(--bg)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border)',
          }}
        >
          v{VERSION}
        </Link>

        {/* Right-side actions */}
        <nav className="flex items-center gap-1">
          {/* Keyboard shortcuts help */}
          <button
            onClick={() => setShowHelp((v) => !v)}
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
            aria-expanded={showHelp}
            className={[
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              showHelp
                ? 'text-[var(--accent)] bg-[var(--bg)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg)]',
            ].join(' ')}
          >
            <Keyboard size={18} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch theme (currently ${preference})`}
            aria-label="Cycle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg)] transition-colors"
          >
            <ThemeIcon size={18} />
          </button>

          {/* Changelog link: goes back to home when already on the changelog page */}
          <Link
            href={pathname === '/changelog' ? '/' : '/changelog'}
            title={pathname === '/changelog' ? 'Back to home' : 'Changelog'}
            aria-label={pathname === '/changelog' ? 'Back to home' : 'Changelog'}
            className={[
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              pathname === '/changelog'
                ? 'text-[var(--accent)] bg-[var(--bg)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg)]',
            ].join(' ')}
          >
            <ScrollText size={18} />
          </Link>

          {/* Settings link: goes back to home when already on the settings page */}
          <Link
            href={pathname === '/settings' ? '/' : '/settings'}
            title={pathname === '/settings' ? 'Back to home' : 'Settings'}
            aria-label={pathname === '/settings' ? 'Back to home' : 'Settings'}
            className={[
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              pathname === '/settings'
                ? 'text-[var(--accent)] bg-[var(--bg)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg)]',
            ].join(' ')}
          >
            <Settings size={18} />
          </Link>
        </nav>
      </div>

      {/* Keyboard shortcuts panel */}
      {showHelp && (
        <>
          {/* Backdrop: click outside to close */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setShowHelp(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            className="absolute right-4 top-full z-50 mt-2 min-w-56 rounded-xl p-4 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-panel)',
              border: '1px solid var(--border)',
            }}
          >
            <p
              className="mb-3 text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Keyboard shortcuts
            </p>
            <table className="w-full text-sm" style={{ borderCollapse: 'separate', borderSpacing: '0 4px' }}>
              <tbody>
                {[
                  { key: 'Space', action: 'Play / pause' },
                  { key: 'R',     action: 'Restart playback' },
                  { key: 'L',     action: 'Toggle loop region' },
                  { key: '?',     action: 'Show / hide shortcuts' },
                ].map(({ key, action }) => (
                  <tr key={key}>
                    <td className="pr-3 align-middle">
                      <kbd
                        className="rounded px-1.5 py-0.5 text-xs font-mono"
                        style={{
                          backgroundColor: 'var(--bg-alt)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-heading)',
                        }}
                      >
                        {key}
                      </kbd>
                    </td>
                    <td style={{ color: 'var(--text-body)' }}>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </header>
  );
}
