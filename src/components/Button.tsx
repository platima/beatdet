/**
 * Reusable Button component: styled with Solarised CSS variables.
 * Supports primary, secondary, danger and ghost variants.
 */

'use client';

import React from 'react';
import { Loader2, X } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary: [
    'bg-[var(--accent)] text-white',
    'hover:brightness-110 active:brightness-90',
  ].join(' '),
  secondary: [
    'bg-[var(--bg-panel)] text-[var(--text-body)]',
    'border border-[var(--border)]',
    'hover:border-[var(--accent)] hover:text-[var(--accent)]',
  ].join(' '),
  danger: [
    'bg-[var(--danger)] text-white',
    'hover:brightness-110 active:brightness-90',
  ].join(' '),
  ghost: [
    'bg-transparent text-[var(--text-muted)]',
    'hover:text-[var(--text-body)] hover:bg-[var(--bg-alt)]',
  ].join(' '),
};

const sizeStyles: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        'ui-btn inline-flex items-center justify-center rounded-lg font-medium',
        'transition-all duration-150 focus-visible:outline-2',
        'focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantStyles[variant],
        sizeStyles[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
}

interface CloseButtonProps {
  onClick: () => void;
  /** Accessible label describing what is being dismissed. */
  label: string;
  /** Icon size in pixels. Default: 15. */
  size?: number;
  className?: string;
}

/**
 * Consistent dismiss / close button used across notification banners and toasts.
 * Uses the ui-btn class so it inherits the modern-UI hover lift in globals.css.
 */
export function CloseButton({ onClick, label, size = 15, className = '' }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'ui-btn inline-flex items-center justify-center',
        'rounded-full p-1 transition-all duration-150',
        'text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--bg-alt)]',
        'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
        className,
      ].join(' ')}
      aria-label={label}
    >
      <X size={size} />
    </button>
  );
}
