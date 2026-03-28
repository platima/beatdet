/**
 * NavBar: top navigation bar with app title, version, theme toggle
 * and link to the settings page.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Settings, Sun, Moon, Monitor, ScrollText } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

// Version is injected at build time from the VERSION file via next.config.ts.
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';

export function NavBar() {
  const pathname = usePathname();
  const { preference, toggleTheme } = useTheme();

  const ThemeIcon =
    preference === 'dark' ? Moon : preference === 'light' ? Sun : Monitor;

  return (
    <header
      className="sticky top-0 z-50 w-full border-b"
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
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={`Switch theme (currently ${preference})`}
            aria-label="Cycle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg)] transition-colors"
          >
            <ThemeIcon size={18} />
          </button>

          {/* Changelog link */}
          <Link
            href="/changelog"
            title="Changelog"
            aria-label="Changelog"
            className={[
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              pathname === '/changelog'
                ? 'text-[var(--accent)] bg-[var(--bg)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg)]',
            ].join(' ')}
          >
            <ScrollText size={18} />
          </Link>

          {/* Settings link */}
          <Link
            href="/settings"
            title="Settings"
            aria-label="Settings"
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
    </header>
  );
}
