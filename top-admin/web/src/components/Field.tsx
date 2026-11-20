import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './Icon';

export function Field({ label, hint, children, style }: { label: string; hint?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label className="f" style={style}>
      <span>{label}</span>
      {children}
      {hint ? <span className="f-hint">{hint}</span> : null}
    </label>
  );
}

export function Check({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <div>
        <div>{label}</div>
        {hint ? <div className="small muted">{hint}</div> : null}
      </div>
    </label>
  );
}

export function Message({ kind, children }: { kind: 'err' | 'ok' | 'warn'; children: ReactNode }) {
  const icon = kind === 'err' ? 'alert' : kind === 'ok' ? 'checkCircle' : 'info';
  return (
    <div className={`msg ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} className="msg-ic" />
      <div className="msg-body">{children}</div>
    </div>
  );
}
