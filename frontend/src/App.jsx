import { useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';
import { useRoute, go } from './router.js';
import { todayISO } from './format.js';
import Timeline from './views/Timeline.jsx';
import DayView from './views/DayView.jsx';
import MonthView from './views/MonthView.jsx';
import YearView from './views/YearView.jsx';
import OnThisDay from './views/OnThisDay.jsx';
import MapView from './views/MapView.jsx';
import Settings from './views/Settings.jsx';
import FavoritesView from './views/FavoritesView.jsx';

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { token } = await api.login(username, password);
      setToken(token);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Päiväkirja</h1>
      <input placeholder="Käyttäjätunnus" autoComplete="username" value={username}
             onChange={e => setUsername(e.target.value)} />
      <input type="password" placeholder="Salasana" autoComplete="current-password" value={password}
             onChange={e => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Kirjaudutaan…' : 'Kirjaudu'}</button>
    </form>
  );
}

const NAV = [
  { key: '', label: 'Päivät', icon: '☰' },
  { key: 'month', label: 'Kuukausi', icon: '▦' },
  { key: 'year', label: 'Vuosi', icon: '◷' },
  { key: 'otd', label: 'Tänä päivänä', icon: '↺' },
  { key: 'map', label: 'Kartta', icon: '⌖' },
];

function Shell({ onLogout }) {
  const [view = '', param] = useRoute();

  let content;
  switch (view) {
    case 'day': content = <DayView date={param || todayISO()} />; break;
    case 'month': content = <MonthView param={param} />; break;
    case 'year': content = <YearView param={param} />; break;
    case 'otd': content = <OnThisDay param={param} />; break;
    case 'map': content = <MapView />; break;
    case 'favorites': content = <FavoritesView />; break;
    case 'settings': content = <Settings onLogout={onLogout} />; break;
    default: content = <Timeline />;
  }

  return (
    <>
      <header className="topbar">
        <a href="#/" className="brand">Päiväkirja</a>
        <span>
          <a href="#/favorites" className="icon-btn" aria-label="Suosikkipaikat">★</a>
          <a href="#/settings" className="icon-btn" aria-label="Asetukset">⚙</a>
        </span>
      </header>
      <main className="container">{content}</main>
      {view !== 'day' && (
        <button className="fab" aria-label="Kirjaa tänään" onClick={() => go(`/day/${todayISO()}`)}>+</button>
      )}
      <nav className="bottomnav">
        {NAV.map(n => (
          <a key={n.key} href={`#/${n.key}`} className={view === n.key ? 'active' : ''}>
            <span className="nav-icon">{n.icon}</span>
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  useEffect(() => {
    const onExpired = () => setAuthed(false);
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);
  // Dataa ei haeta ennen kirjautumista: näkymät renderöidään vasta, kun token on olemassa
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return <Shell onLogout={() => { clearToken(); setAuthed(false); }} />;
}
