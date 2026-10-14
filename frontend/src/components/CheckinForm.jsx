// Paikan lisäys/muokkaus: (a) nimi käsin, (b) haku Nominatimista, (c) nykyinen sijainti,
// (d) valinta suosikeista, (e) sijainti kartalta. Käytetään myös suosikin muokkaukseen (forFavorite).
// Suosikista valittaessa tiedot kopioidaan lomakkeelle, ja niitä voi vielä muokata.
import { useState } from 'react';
import { api } from '../api.js';
import { formatCoords } from '../format.js';
import FavoritePicker from './FavoritePicker.jsx';
import LocationPicker from './LocationPicker.jsx';

const EMPTY = { place_name: '', category: '', latitude: null, longitude: null };

export default function CheckinForm({
  initial, onSave, onCancel, favorites = [], forFavorite = false, saveLabel = 'Tallenna paikka',
}) {
  const [c, setC] = useState({ ...EMPTY, ...initial, category: initial?.category ?? '' });
  const [favoriteId, setFavoriteId] = useState(null);
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickingMap, setPickingMap] = useState(false);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const set = patch => setC(prev => ({ ...prev, ...patch }));
  const hasCoords = c.latitude !== null && c.longitude !== null;
  const isKnownFavorite = favorites.some(f => f.name.toLowerCase() === c.place_name.trim().toLowerCase());

  function pickFavorite(f) {
    set({ place_name: f.name, category: f.category ?? '', latitude: f.latitude, longitude: f.longitude });
    setFavoriteId(f.id);
    setSaveAsFavorite(false);
    setResults(null);
    setPicking(false);
  }

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
      await onSave(
        { ...c, place_name: c.place_name.trim(), category: c.category.trim() || null,
          ...(favoriteId ? { favorite_id: favoriteId } : {}) },
        { saveAsFavorite: saveAsFavorite && !isKnownFavorite }
      );
    } catch (err) { setError(err.message); setBusy(''); }
  }

  return (
    <form className="subcard checkin-form" onSubmit={submit}>
      {!forFavorite && favorites.length > 0 && (
        <button type="button" className="secondary fav-open" onClick={() => setPicking(true)}>
          ★ Valitse suosikeista
        </button>
      )}
      <div className="row">
        <input placeholder="Paikan nimi" maxLength={200} value={c.place_name} onChange={e => set({ place_name: e.target.value })} />
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
                set({ place_name: r.name.slice(0, 200), category: c.category || r.category || '',
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
          ? <span className="coord-actions">
              <button type="button" className="link" onClick={() => setPickingMap(true)}>Muuta kartalla</button>
              <button type="button" className="link" onClick={() => set({ latitude: null, longitude: null })}>Poista</button>
            </span>
          : <span className="coord-actions">
              <button type="button" className="secondary" onClick={locate} disabled={!!busy}>
                {busy === 'locate' ? 'Haetaan…' : 'Käytä nykyistä sijaintia'}
              </button>
              <button type="button" className="secondary" onClick={() => setPickingMap(true)} disabled={!!busy}>
                Valitse kartalta
              </button>
            </span>}
      </div>
      {!forFavorite && (
        isKnownFavorite
          ? <p className="muted small">★ Tämä paikka on suosikeissa</p>
          : (
            <label className="check">
              <input type="checkbox" checked={saveAsFavorite} onChange={e => setSaveAsFavorite(e.target.checked)} />
              <span>☆ Tallenna myös suosikkeihin</span>
            </label>
          )
      )}
      {error && <p className="error">{error}</p>}
      <div className="row end">
        <button type="button" className="link" onClick={onCancel}>Peruuta</button>
        <button disabled={!!busy}>{busy === 'save' ? 'Tallennetaan…' : saveLabel}</button>
      </div>
      {picking && <FavoritePicker favorites={favorites} onPick={pickFavorite} onClose={() => setPicking(false)} />}
      {pickingMap && (
        <LocationPicker
          start={hasCoords ? { latitude: c.latitude, longitude: c.longitude } : null}
          // Ilman valintaa kartta keskitetään eniten käytettyyn suosikkiin, jolla on sijainti
          fallback={favorites.find(f => f.latitude !== null) ?? null}
          onPick={p => { set(p); setPickingMap(false); }}
          onClose={() => setPickingMap(false)}
        />
      )}
    </form>
  );
}
