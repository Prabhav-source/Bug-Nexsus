import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';

/* ---------------- Button ---------------- */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover active:scale-[0.98] shadow-[0_2px_16px_rgba(255,23,68,0.25)] hover:shadow-[0_2px_22px_rgba(255,23,68,0.38)] font-semibold disabled:bg-primary-dark disabled:shadow-none',
  secondary:
    'bg-surface-elevated text-text-primary hover:bg-surface-hover active:scale-[0.98] border border-border hover:border-[#3a3440]',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover active:scale-[0.98]',
  danger: 'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/[0.16] active:scale-[0.98]',
  outline: 'border border-border text-text-secondary hover:text-text-primary hover:border-border-accent hover:bg-primary/[0.04] active:scale-[0.98]',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9.5 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-lg transition-all duration-150 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 size={size === 'sm' ? 13 : 16} className="animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/* ---------------- Card ---------------- */
export function Card({ className = '', children, ...props }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.25)] transition-colors ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-border">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-surface-hover/70 ${className}`} style={style}>
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
        style={{ animation: 'shimmer-slide 1.8s ease-in-out infinite' }}
      />
    </div>
  );
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3 w-full rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

/* ---------------- Badge ---------------- */
export function Badge({
  children,
  color,
  dot = true,
  className = '',
}: {
  children: ReactNode;
  color?: string;
  dot?: boolean;
  className?: string;
}) {
  const style = color
    ? { backgroundColor: `${color}14`, color, borderColor: `${color}40` }
    : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium font-mono tracking-tight whitespace-nowrap ${className}`}
      style={style}
    >
      {dot && color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />}
      {children}
    </span>
  );
}

/* ---------------- Form ---------------- */
const fieldBase =
  'w-full rounded-lg border border-border bg-surface-elevated text-sm text-text-primary placeholder:text-text-muted hover:border-[#3a3440] focus:border-primary/60 focus:ring-2 focus:ring-primary/15 focus:outline-none transition-[border-color,box-shadow] duration-150 disabled:opacity-50 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`h-9.5 px-3 ${fieldBase} ${className}`}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`px-3 py-2.5 resize-y min-h-[90px] leading-relaxed ${fieldBase} ${className}`}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...props }, ref) => (
    <select
      ref={ref}
      className={`h-9.5 pl-3 pr-8 cursor-pointer truncate ${fieldBase} ${className}`}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.6rem center',
        appearance: 'none',
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-text-secondary mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-text-muted mt-1">{hint}</span>}
    </label>
  );
}

/* ---------------- Avatar ---------------- */
export function Avatar({ name, color, size = 'md' }: { name?: string | null; color?: string; size?: 'xs' | 'sm' | 'md' | 'lg' }) {
  const sizes = { xs: 'w-5 h-5 text-[9px]', sm: 'w-7 h-7 text-[11px]', md: 'w-8 h-8 text-xs', lg: 'w-11 h-11 text-sm' };
  const initials = (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const bg = color ?? '#FF1744';
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${sizes[size]}`}
      style={{ backgroundColor: bg }}
      title={name ?? undefined}
    >
      {initials}
    </span>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center animate-fade-in px-4">
      {icon && (
        <div className="w-12 h-12 rounded-xl border border-border bg-surface-elevated flex items-center justify-center text-text-muted mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description && <p className="text-xs text-text-muted mt-1.5 max-w-sm leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Modal ---------------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl border border-border bg-surface shadow-elevated animate-slide-up`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Spinner ---------------- */
export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 size={20} className={`animate-spin text-primary ${className}`} />;
}

/* ---------------- Progress bar ---------------- */
export function ProgressBar({ value, color = '#FF1744', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-full bg-surface-hover overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}
