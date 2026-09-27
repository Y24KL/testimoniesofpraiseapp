import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, configured, db } from './firebase';
import type { Route } from './types';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Testimonies } from './pages/Testimonies';
import { TestimonyEditor } from './pages/TestimonyEditor';
import { Live } from './pages/Live';
import { Submissions } from './pages/Submissions';
import { Announcements } from './pages/Announcements';
import { Sponsorships } from './pages/Sponsorships';

type Gate = { state: 'loading' } | { state: 'out' } | { state: 'denied'; user: User } | { state: 'admin'; user: User };

export default function App() {
  const [gate, setGate] = useState<Gate>({ state: 'loading' });
  const [route, setRoute] = useState<Route>({ name: 'dashboard' });

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, async (user) => {
      if (!user) return setGate({ state: 'out' });
      setGate({ state: 'loading' });
      try {
        // Admins are the users that have a document at admins/{uid}
        const snap = await getDoc(doc(db, 'admins', user.uid));
        setGate(snap.exists() ? { state: 'admin', user } : { state: 'denied', user });
      } catch {
        setGate({ state: 'denied', user });
      }
    });
  }, []);

  if (!configured) {
    return (
      <div className="center"><div className="card" style={{ maxWidth: 520 }}>
        <h2>Firebase isn’t configured</h2>
        <p className="muted">Copy <code>.env.example</code> to <code>.env</code>, fill in the Firebase web config, then run <code>npm run dev</code> again.</p>
      </div></div>
    );
  }
  if (gate.state === 'loading') return <div className="center muted">Loading…</div>;
  if (gate.state === 'out') return <Login />;
  if (gate.state === 'denied') {
    return (
      <div className="center"><div className="card" style={{ maxWidth: 520 }}>
        <h2>Not authorised</h2>
        <p className="muted">{gate.user.email} is signed in but isn’t an admin. Ask an existing admin to add your user ID:</p>
        <p><code>{gate.user.uid}</code></p>
        <button className="btn ghost" onClick={() => void signOut(auth)}>Sign out</button>
      </div></div>
    );
  }

  return (
    <Layout route={route} go={setRoute}>
      {route.name === 'dashboard' && <Dashboard />}
      {route.name === 'testimonies' && <Testimonies go={setRoute} />}
      {route.name === 'editor' && <TestimonyEditor key={route.id ?? 'new'} id={route.id} prefill={route.prefill} go={setRoute} />}
      {route.name === 'live' && <Live />}
      {route.name === 'submissions' && <Submissions go={setRoute} />}
      {route.name === 'announcements' && <Announcements />}
      {route.name === 'sponsorships' && <Sponsorships />}
    </Layout>
  );
}
