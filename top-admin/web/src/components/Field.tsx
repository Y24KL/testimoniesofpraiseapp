import type { ReactNode } from 'react';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="f">
      <span>{label}</span>
      {children}
      {hint ? <span className="small muted" style={{ marginTop: 4, fontWeight: 400 }}>{hint}</span> : null}
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

export function Message({ kind, children }: { kind: 'err' | 'ok'; children: ReactNode }) {
  return <div className={`msg ${kind}`} role={kind === 'err' ? 'alert' : 'status'}>{children}</div>;
}
