import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Field, Message } from '../components/Field';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="center">
      <form className="card" style={{ width: 380 }} onSubmit={submit}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <img src="/logo.png" alt="Testimonies of Praise" style={{ width: 110 }} />
          <h2 style={{ marginTop: 6 }}>App admin</h2>
        </div>
        <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></Field>
        <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
        {err ? <Message kind="err">{err}</Message> : null}
        {info ? <Message kind="ok">{info}</Message> : null}
        <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'SIGN IN'}</button>
        <p style={{ textAlign: 'center', marginBottom: 0 }}><a href="#" onClick={(e) => { e.preventDefault(); void reset(); }} className="small">Forgot password?</a></p>
      </form>
    </div>
  );
}
