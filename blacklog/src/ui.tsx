import React from 'react';
import { cn } from './lib/util';

/* ── Button ────────────────────────────────────────────── */
type BtnVariant = 'primary' | 'default' | 'ghost' | 'danger' | 'sea';
export function Button(
  { variant = 'default', className, children, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant },
) {
  const base = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold uppercase tracking-wide border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed select-none';
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-gold text-ink border-gold hover:bg-gold/80',
    default: 'bg-panel text-parch border-edge hover:border-gold/70 hover:text-gold',
    ghost: 'bg-transparent text-fog border-edge hover:text-parch hover:border-fog',
    danger: 'bg-transparent text-rust border-rust/70 hover:bg-rust hover:text-parch',
    sea: 'bg-sead text-parch border-sea hover:bg-sea hover:text-ink',
  };
  return <button className={cn(base, styles[variant], className)} {...rest}>{children}</button>;
}

/* ── Panel ─────────────────────────────────────────────── */
export function Panel(
  { title, icon, right, children, className }:
  { title?: React.ReactNode; icon?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string },
) {
  return (
    <section className={cn('bg-panel/80 border-2 border-edge', className)}>
      {(title || right) && (
        <header className="flex items-center gap-2 px-3 py-2 border-b-2 border-edge bg-ink2">
          {icon && <span className="text-gold">{icon}</span>}
          <h2 className="text-gold text-base font-title tracking-wider flex-1 leading-none">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

/* ── Card ──────────────────────────────────────────────── */
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('bg-ink2 border border-edge p-3', className)}>{children}</div>;
}

/* ── Inputs ────────────────────────────────────────────── */
const fieldBase = 'w-full bg-ink border-2 border-edge px-2 py-1.5 text-parch placeholder:text-fog/60 focus:outline-none focus:border-gold/70';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldBase, 'min-h-[64px] resize-y scrollbar-thin', props.className)} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldBase, props.className)} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mb-2">
      <span className="block text-xs uppercase tracking-widest text-fog mb-1">{label}</span>
      {children}
    </label>
  );
}

/* ── Modal ─────────────────────────────────────────────── */
export function Modal(
  { open, onClose, title, children, actions }:
  { open: boolean; onClose: () => void; title: string; children: React.ReactNode; actions?: React.ReactNode },
) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75" onMouseDown={onClose}>
      <div
        className="w-full max-w-lg bg-panel border-2 border-edge shadow-plate max-h-[90vh] overflow-y-auto scrollbar-thin"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-center px-4 py-2.5 border-b-2 border-edge bg-ink2">
          <h2 className="text-gold font-title text-xl tracking-wide flex-1">{title}</h2>
          <button className="text-fog hover:text-parch text-xl leading-none" onClick={onClose}>×</button>
        </header>
        <div className="p-4">{children}</div>
        {actions && <footer className="flex flex-wrap gap-2 justify-end px-4 py-3 border-t-2 border-edge bg-ink2">{actions}</footer>}
      </div>
    </div>
  );
}

/* ── Stat stepper ──────────────────────────────────────── */
export function Stepper(
  { label, value, onChange, min = 0, max = 999, accent }:
  { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; accent?: string },
) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs uppercase tracking-wider text-fog w-16">{label}</span>
      <button className="w-6 h-6 border border-edge text-fog hover:text-rust hover:border-rust" onClick={() => onChange(clamp(value - 1))}>−</button>
      <span className={cn('w-9 text-center font-title text-lg', accent)}>{value}</span>
      <button className="w-6 h-6 border border-edge text-fog hover:text-gold hover:border-gold" onClick={() => onChange(clamp(value + 1))}>+</button>
    </div>
  );
}

/* ── Pip clock ─────────────────────────────────────────── */
export function Pips({ current, max, onTick }: { current: number; max: number; onTick?: (n: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < current;
        return (
          <button
            key={i}
            onClick={() => onTick?.(i + 1 === current ? i : i + 1)}
            title={`${i + 1}/${max}`}
            className={cn(
              'w-4 h-4 border-2 rounded-sm transition-colors',
              filled ? 'bg-rust border-rust' : 'bg-transparent border-edge hover:border-gold',
            )}
          />
        );
      })}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-fog/70 text-sm italic py-1">{children}</p>;
}

export function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-block text-[10px] uppercase tracking-wider bg-ink border border-edge px-1.5 py-0.5 text-fog">{children}</span>;
}
