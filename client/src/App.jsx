import { Suspense, lazy, useEffect, useState } from 'react';
import Datapad from './components/student/Datapad.jsx';

// The Command Center pulls in jsPDF + jspdf-autotable, which no student ever
// needs. Loading it lazily keeps that weight out of the far more common
// student page load.
const CommandCenter = lazy(() => import('./components/teacher/CommandCenter.jsx'));

/**
 * Root shell. Two surfaces:
 *  - Student game (default route — embed this URL on the public Wix page)
 *  - Teacher Command Center (#teacher — embed on a password-protected Wix page)
 */
export default function App() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (route.startsWith('#teacher')) {
    return (
      <Suspense fallback={<div className="app teacher-app"><p className="muted">Loading…</p></div>}>
        <CommandCenter />
      </Suspense>
    );
  }
  return <Datapad />;
}
