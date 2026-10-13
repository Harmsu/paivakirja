// Päivä-näkymä: aikajana tästä päivästä taaksepäin (Momento-tyyliin).
import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import EntryCard from '../components/EntryCard.jsx';

const PAGE = 15;

export default function Timeline() {
  const [entries, setEntries] = useState([]);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sentinel = useRef(null);
  const inFlight = useRef(false); // estää tuplahaun, kun observer ja ensimmäinen haku osuvat yhteen

  async function loadMore() {
    if (inFlight.current || done) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const before = entries.length ? entries[entries.length - 1].date : undefined;
      const page = await api.timeline(before, PAGE);
      setEntries(prev => [...prev, ...page]);
      if (page.length < PAGE) setDone(true);
    } catch (e) {
      setError(e.message);
      setDone(true); // ei uudelleenyrityssilmukkaa observerin kautta
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  useEffect(() => { loadMore(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Lataa lisää automaattisesti, kun sivun loppu tulee näkyviin
  useEffect(() => {
    if (!sentinel.current) return;
    const obs = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { rootMargin: '400px' });
    obs.observe(sentinel.current);
    return () => obs.disconnect();
  });

  return (
    <>
      {error && <p className="error">{error}</p>}
      {!loading && done && entries.length === 0 && (
        <div className="empty">
          <p>Ei vielä kirjauksia.</p>
          <p className="muted">Aloita painamalla +-nappia.</p>
        </div>
      )}
      {entries.map(e => <EntryCard key={e.id} entry={e} />)}
      {!done && <div ref={sentinel} className="muted center">{loading ? 'Ladataan…' : ''}</div>}
    </>
  );
}
