// Suosikkipaikkojen hallinta: lisäys, muokkaus (nimi, kategoria, koordinaatit) ja poisto.
// Poisto ei vaikuta aiempiin kirjauksiin, koska checkin on kopio suosikin tiedoista.
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatCoords } from '../format.js';
import CheckinForm from '../components/CheckinForm.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// Lomake käsittelee paikkaa checkinin kentillä (place_name); suosikissa kenttä on name
const toForm = f => ({ place_name: f.name, category: f.category, latitude: f.latitude, longitude: f.longitude });
const fromForm = v => ({ name: v.place_name, category: v.category, latitude: v.latitude, longitude: v.longitude });

export default function FavoritesView() {
  const [favorites, setFavorites] = useState(null);
  const [editing, setEditing] = useState(null); // id tai 'new'
  const [confirm, setConfirm] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.favorites().then(setFavorites).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  async function save(id, values) {
    if (id === 'new') await api.addFavorite(fromForm(values));
    else await api.updateFavorite(id, fromForm(values));
    setEditing(null);
    await load();
  }

  async function remove(f) {
    setConfirm(null);
    setError('');
    try { await api.deleteFavorite(f.id); } catch (e) { setError(e.message); }
    await load();
  }

  if (!favorites) return <p className="muted center">{error || 'Ladataan…'}</p>;

  return (
    <>
      <div className="period-nav"><h2>★ Suosikkipaikat</h2></div>
      {error && <p className="error">{error}</p>}

      {editing === 'new' ? (
        <section className="card">
          <h2>Uusi suosikki</h2>
          <CheckinForm forFavorite saveLabel="Tallenna suosikki"
            onCancel={() => setEditing(null)} onSave={v => save('new', v)} />
        </section>
      ) : (
        <button className="secondary block" onClick={() => setEditing('new')}>+ Lisää suosikki</button>
      )}

      {favorites.length === 0 && editing !== 'new' && (
        <div className="empty">
          <p>Ei vielä suosikkipaikkoja.</p>
          <p className="muted">
            Lisää paikka suosikiksi napauttamalla ☆-tähteä päivän paikan vieressä, valitsemalla
            "Tallenna myös suosikkeihin" paikkaa lisätessä, tai yllä olevasta napista.
            Suosikin voi sen jälkeen valita yhdellä napautuksella uutta paikkaa lisätessä.
          </p>
        </div>
      )}

      {favorites.map(f => editing === f.id ? (
        <section key={f.id} className="card">
          <CheckinForm forFavorite initial={toForm(f)} saveLabel="Tallenna muutokset"
            onCancel={() => setEditing(null)} onSave={v => save(f.id, v)} />
        </section>
      ) : (
        <div key={f.id} className="card fav-row">
          <div>
            <strong>★ {f.name}</strong>
            {f.category && <span className="muted"> · {f.category}</span>}
            <div className="muted small">
              {f.latitude !== null ? `📍 ${formatCoords(f.latitude, f.longitude)}` : 'Ei koordinaatteja'}
              {' · '}{f.use_count ? `käytetty ${f.use_count} kertaa` : 'ei vielä käytetty'}
            </div>
          </div>
          <div className="row end">
            <button className="link" onClick={() => setEditing(f.id)}>Muokkaa</button>
            <button className="link danger" onClick={() => setConfirm(f)}>Poista</button>
          </div>
        </div>
      ))}

      {confirm && (
        <ConfirmDialog
          message={`Poistetaanko ${confirm.name} suosikeista? Aiemmat kirjaukset säilyvät.`}
          onCancel={() => setConfirm(null)} onConfirm={() => remove(confirm)} />
      )}
    </>
  );
}
