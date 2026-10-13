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
  // Hakutila refeissä: observerin takaisinkutsu voi ajautua ennen uutta renderöintiä, jolloin
  // sen sulkeuman entries/done-tila olisi vanha ja sama sivu haettaisiin kahdesti.
  const inFlight = useRef(false);
  const cursor = useRef(undefined); // viimeisimmän haetun päivän pvm
  const finished = useRef(false);

  async function loadMore() {
    if (inFlight.current || finished.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const page = await api.timeline(cursor.current, PAGE);
      if (page.length) cursor.current = page[page.length - 1].date;
      if (page.length < PAGE) { finished.current = true; setDone(true); }
      setEntries(prev => [...prev, ...page]);
    } catch (e) {
      setError(e.message);
      finished.current = true; // ei uudelleenyrityssilmukkaa observerin kautta
      setDone(true);
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
