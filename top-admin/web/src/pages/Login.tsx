import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Field, Message } from '../components/Field';
import { Icon } from '../components/Icon';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setInfo('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setErr('Unable to sign in. Please check your email and password.');
    }
    setBusy(false);
  };

  const reset = async () => {
    setErr('');
    if (!email.trim()) return setErr('Enter your email first.');
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      /* never reveal whether the account exists */
    }
    setInfo('If an account exists for that email, a reset link has been sent.');
  };

  return (
    <div className="auth-screen">
      <form className="card auth-card" onSubmit={submit} aria-labelledby="login-title">
        <img className="logo" src="/logo.png" alt="Testimonies of Praise" />
        <div className="brand-t1">TESTIMONIES OF PRAISE</div>
        <div className="brand-t2" id="login-title">ADMIN CONTROL CENTRE</div>

        <Field label="Email">
          <div className="input-with-icon">
            <Icon name="user" size={16} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required placeholder="you@example.com" />
          </div>
        </Field>
        <Field label="Password">
          <div className="input-with-action">
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="button" className="icon-btn" style={{ width: 34, height: 34 }} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow((s) => !s)}>
              <Icon name={show ? 'eyeOff' : 'eye'} size={16} />
            </button>
          </div>
        </Field>

        {err ? <Message kind="err">{err}</Message> : null}
        {info ? <Message kind="ok">{info}</Message> : null}

        <button className="btn primary block" disabled={busy} style={{ marginTop: 6 }}>
          {busy ? <><span className="spin" style={{ width: 16, height: 16, borderWidth: 2 }} aria-hidden="true" />Signing in…</> : <><Icon name="lock" size={16} />Sign in</>}
        </button>
        <p className="foot">
          <a href="#" onClick={(e) => { e.preventDefault(); void reset(); }} className="small">Forgot password?</a>
        </p>
      </form>
    </div>
  );
}
