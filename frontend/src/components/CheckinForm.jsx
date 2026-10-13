// Paikan lisäys/muokkaus: (a) nimi käsin, (b) haku Nominatimista, (c) nykyinen sijainti.
import { useState } from 'react';
import { api } from '../api.js';
import { formatCoords } from '../format.js';

const EMPTY = { place_name: '', category: '', latitude: null, longitude: null };

export default function CheckinForm({ initial, onSave, onCancel }) {
  const [c, setC] = useState({ ...EMPTY, ...initial, category: initial?.category ?? '' });
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = patch => setC(prev => ({ ...prev, ...patch }));
  const hasCoords = c.latitude !== null && c.longitude !== null;

  async function search() {
    if (c.place_name.trim().length < 2) { setError('Kirjoita hakusana nimikenttään'); return; }
    setBusy('search'); setError('');
    try {
      const r = await api.geocode(c.place_name.trim(), c.latitude, c.longitude);
      setResults(r);
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  }

  function locate() {
    if (!navigator.geolocation) { setError('Selain ei tue sijaintia'); return; }
    setBusy('locate'); setError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        set({ latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) });
        setBusy('');
      },
      err => {
        setError(err.code === 1 ? 'Sijainnin käyttö estetty' : 'Sijaintia ei saatu');
        setBusy('');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (!c.place_name.trim()) { setError('Anna paikalle nimi'); return; }
    setBusy('save'); setError('');
    try {
      await onSave({ ...c, place_name: c.place_name.trim(), category: c.category.trim() || null });
    } catch (err) { setError(err.message); setBusy(''); }
  }

  return (
    <form className="subcard checkin-form" onSubmit={submit}>
      <div className="row">
        <input placeholder="Paikan nimi" value={c.place_name} onChange={e => set({ place_name: e.target.value })} />
        <button type="button" className="secondary" onClick={search} disabled={!!busy}>
          {busy === 'search' ? '…' : 'Hae'}
        </button>
      </div>
      {results && (
        <ul className="results">
          {results.length === 0 && <li className="muted">Ei tuloksia</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" className="result" onClick={() => {
                set({ place_name: r.name, category: c.category || r.category || '',
                  latitude: r.latitude, longitude: r.longitude });
                setResults(null);
              }}>
                <strong>{r.name}</strong>
                <span className="muted small">{r.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <input placeholder="Kategoria (valinnainen), esim. kahvila" value={c.category}
             onChange={e => set({ category: e.target.value })} />
      <div className="row coords">
        <span className="muted small">
          {hasCoords ? `📍 ${formatCoords(c.latitude, c.longitude)}` : 'Ei koordinaatteja'}
        </span>
        {hasCoords
          ? <button type="button" className="link" onClick={() => set({ latitude: null, longitude: null })}>Poista</button>
          : <button type="button" className="secondary" onClick={locate} disabled={!!busy}>
              {busy === 'locate' ? 'Haetaan…' : 'Käytä nykyistä sijaintia'}
            </button>}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="link" onClick={onCancel}>Peruuta</button>
        <button disabled={!!busy}>{busy === 'save' ? 'Tallennetaan…' : 'Tallenna paikka'}</button>
      </div>
    </form>
  );
}
