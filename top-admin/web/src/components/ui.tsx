import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

/* =============================================================================================
   Shared building blocks for every admin page. Pages compose these instead of styling themselves,
   so spacing, typography and states stay identical across the portal.
   ============================================================================================= */

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({ icon, title, hint, actions, as = 'h2' }: { icon?: IconName; title: string; hint?: ReactNode; actions?: ReactNode; as?: 'h2' | 'h3' }) {
  const H = as;
  return (
    <div className="section-head">
      <div>
        <H>{icon ? <Icon name={icon} /> : null}{title}</H>
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function GlassCard({ children, className = '', style, tight, flush, as = 'section', ...aria }: { children: ReactNode; className?: string; style?: CSSProperties; tight?: boolean; flush?: boolean; as?: 'section' | 'div' | 'article'; 'aria-label'?: string; 'aria-labelledby'?: string }) {
  const Tag = as;
  return (
    <Tag className={`card ${tight ? 'tight' : ''} ${flush ? 'flush' : ''} ${className}`.trim()} style={style} {...aria}>
      {children}
    </Tag>
  );
}

/** A counter that may still be loading, or may have failed. A failure is never shown as a verified zero. */
export type Metric = { state: 'loading' } | { state: 'ready'; value: number } | { state: 'error'; message: string };

export function StatCard({ icon, label, metric, note, gold }: { icon: IconName; label: string; metric: Metric; note?: ReactNode; gold?: boolean }) {
  return (
    <div className={`card stat-card ${gold ? 'gold' : ''}`} role="group" aria-label={label}>
      <div className="head">
        <span className="label">{label}</span>
        <span className="ic"><Icon name={icon} size={18} /></span>
      </div>
      {metric.state === 'loading' ? (
        <span className="skeleton value" aria-label="Loading" />
      ) : metric.state === 'error' ? (
        <span className="value unavailable" title={metric.message}>Unavailable</span>
      ) : (
        <span className="value">{metric.value.toLocaleString()}</span>
      )}
      {note ? <span className="note">{metric.state === 'error' ? 'Could not load this figure.' : note}</span> : null}
    </div>
  );
}

export type BadgeKind = 'ok' | 'warn' | 'bad' | 'draft' | 'live' | 'info';
export function StatusBadge({ kind, children, plain }: { kind: BadgeKind; children: ReactNode; plain?: boolean }) {
  return <span className={`badge ${kind} ${plain ? 'plain' : ''}`}>{children}</span>;
}

export function FilterTabs<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={`tab ${value === o.id ? 'on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
          {typeof o.count === 'number' ? <span className="tab-count">{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return (
    <div className="input-with-icon grow">
      <Icon name="search" size={16} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
    </div>
  );
}

export function EmptyState({ icon = 'inbox', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="ic"><Icon name={icon} size={22} /></span>
      <b>{title}</b>
      {children ? <div className="small">{children}</div> : null}
      {action ? <div style={{ marginTop: 8 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: { title?: string; message: ReactNode; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <Icon name="alert" />
      <div style={{ flex: 1 }}>
        <b>{title}</b>
        <div className="small muted">{message}</div>
      </div>
      {onRetry ? <button type="button" className="btn ghost small" onClick={onRetry}><Icon name="refresh" size={14} />Retry</button> : null}
    </div>
  );
}

export function Skeleton({ kind = 'line', width, count = 1 }: { kind?: 'line' | 'value' | 'block'; width?: string; count?: number }) {
  return (
    <div aria-label="Loading" role="status">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`skeleton ${kind}`} style={width ? { width } : undefined} />
      ))}
    </div>
  );
}

export function LoadingList({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="row" style={{ padding: '10px 0' }}>
          <span className="skeleton" style={{ width: 64, height: 40 }} />
          <div style={{ flex: 1 }}>
            <span className="skeleton line" style={{ width: `${70 - i * 8}%` }} />
            <span className="skeleton line" style={{ width: '30%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UploadProgress({ label, pct, status }: { label: string; pct: number; status?: ReactNode }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="upload" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}>
      <div className="top"><span>{label}</span><b>{v}%</b></div>
      <div className="bar"><i style={{ width: `${v}%` }} /></div>
      {status ? <div className="small muted">{status}</div> : null}
    </div>
  );
}

/** Horizontal bars. Values are plotted as given; nothing is invented or smoothed. */
export function BarChart({ rows, gold, empty = 'No data yet.' }: { rows: { label: string; value: number }[]; gold?: boolean; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.every((r) => r.value === 0)) return <p className="muted small" style={{ margin: 0 }}>{empty}</p>;
  return (
    <div className="chart-bars">
      {rows.map((r) => (
        <div key={r.label} className={`chart-row ${gold ? 'gold' : ''}`}>
          <span className="name" title={r.label}>{r.label}</span>
          <span className="track" aria-hidden="true"><span className="fill" style={{ width: `${(r.value / max) * 100}%`, display: 'block' }} /></span>
          <span className="val">{r.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/** A ring split between a few segments, with a readable legend and totals. */
export function Donut({ segments, centre }: { segments: { label: string; value: number; color: string }[]; centre?: ReactNode }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 140 140" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="16" />
        {total > 0 &&
          segments.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle key={s.label} cx="70" cy="70" r={r} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform="rotate(-90 70 70)" strokeLinecap="butt" />
            );
            offset += len;
            return el;
          })}
        <text x="70" y="66" textAnchor="middle" fill="#fff" fontSize="22" fontWeight="800">{total.toLocaleString()}</text>
        <text x="70" y="86" textAnchor="middle" fill="#C9B5D9" fontSize="11">{centre ?? 'total'}</text>
      </svg>
      <div className="stack-sm">
        {segments.map((s) => (
          <div key={s.label} className="row small">
            <i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="muted">{s.label}</span>
            <b>{s.value.toLocaleString()}</b>
            <span className="muted">{total ? `${Math.round((s.value / total) * 100)}%` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
