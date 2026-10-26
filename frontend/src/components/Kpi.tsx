import type { ReactNode } from 'react';

type KpiProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: 'accent' | 'actual' | 'danger' | 'good';
};

export function Kpi({ label, value, hint, tone }: KpiProps) {
  return (
    <div className={`card kpi${tone ? ` ${tone}` : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

type CardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, subtitle, children, className }: CardProps) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      <h3>{title}</h3>
      {subtitle && <p className="card-sub">{subtitle}</p>}
      {children}
    </section>
  );
}
