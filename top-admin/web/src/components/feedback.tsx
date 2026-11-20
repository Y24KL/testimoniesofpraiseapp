import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

/* =============================================================================================
   Confirmation dialogs and toast notifications, shared by every page.
   confirm() returns a promise, so an existing `if (!confirm(...)) return` becomes
   `if (!(await confirm({...}))) return` without changing the page's logic.
   ============================================================================================= */

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red styling and a warning icon, for actions that delete or send. */
  danger?: boolean;
  /** When set, the confirm button stays disabled until this exact text is typed. */
  requireText?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
type ToastKind = 'ok' | 'err' | 'info';
interface Toast { id: number; kind: ToastKind; text: string }
interface ToastApi { ok: (t: string) => void; err: (t: string) => void; info: (t: string) => void }

const ConfirmCtx = createContext<ConfirmFn | null>(null);
const ToastCtx = createContext<ToastApi | null>(null);

export function useConfirm(): ConfirmFn {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error('useConfirm must be used inside FeedbackProvider');
  return c;
}

export function useToast(): ToastApi {
  const t = useContext(ToastCtx);
  if (!t) throw new Error('useToast must be used inside FeedbackProvider');
  return t;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const confirm = useCallback<ConfirmFn>((opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), []);

  const push = useCallback((kind: ToastKind, text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 8000 : 4500);
  }, []);
  const toastApi = useMemo<ToastApi>(() => ({ ok: (t) => push('ok', t), err: (t) => push('err', t), info: (t) => push('info', t) }), [push]);

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toastApi}>
        {children}
        {pending ? <ConfirmDialog opts={pending} onClose={close} /> : null}
        <div className="toast-stack" aria-live="polite" aria-atomic="false">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'err' ? 'alert' : 'status'}>
              <Icon name={t.kind === 'ok' ? 'checkCircle' : t.kind === 'err' ? 'alert' : 'info'} />
              <span>{t.text}</span>
              <button type="button" className="x" aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}><Icon name="x" size={16} /></button>
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}

function ConfirmDialog({ opts, onClose }: { opts: ConfirmOptions; onClose: (v: boolean) => void }) {
  const [typed, setTyped] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<Element | null>(document.activeElement);
  const blocked = Boolean(opts.requireText) && typed !== opts.requireText;

  useEffect(() => {
    // Destructive dialogs start on Cancel, so a stray Enter never confirms them.
    (opts.requireText ? inputRef.current : opts.danger ? cancelRef.current : confirmRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    const back = returnFocus.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      if (back instanceof HTMLElement) back.focus();
    };
  }, [opts.danger, opts.requireText, onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div className={`modal ${opts.danger ? 'danger' : ''}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <div className="modal-ic"><Icon name={opts.danger ? 'alert' : 'info'} size={22} /></div>
        <h2 id="confirm-title">{opts.title}</h2>
        {opts.message ? <div id="confirm-body" className="modal-body">{opts.message}</div> : <div id="confirm-body" />}
        {opts.requireText ? (
          <label className="f">
            <span>Type <b className="gold">{opts.requireText}</b> to confirm</span>
            <input ref={inputRef} type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
          </label>
        ) : null}
        <div className="modal-actions">
          <button ref={cancelRef} type="button" className="btn ghost" onClick={() => onClose(false)}>{opts.cancelLabel ?? 'Cancel'}</button>
          <button ref={confirmRef} type="button" className={`btn ${opts.danger ? 'danger' : 'primary'}`} disabled={blocked} onClick={() => onClose(true)}>
            {opts.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
