// Yhden päivän kirjaus: lisää, muokkaa, poista ja järjestä tekstit, kuvat ja paikat.
// Päivän entry syntyy backendissä automaattisesti ensimmäisestä lisäyksestä.
import { useEffect, useRef, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { go } from '../router.js';
import { addDays, formatLongDate, todayISO } from '../format.js';
import CheckinForm from '../components/CheckinForm.jsx';
import Lightbox from '../components/Lightbox.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

function MoveButtons({ list, index, onMove }) {
  return (
    <span className="move">
      <button className="icon" disabled={index === 0} onClick={() => onMove(index, -1)} aria-label="Ylös">↑</button>
      <button className="icon" disabled={index === list.length - 1} onClick={() => onMove(index, 1)} aria-label="Alas">↓</button>
    </span>
  );
}

function TextItem({ t, onSave, onDelete, children }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(t.content);
  if (editing) {
    return (
      <div className="subcard">
        <textarea rows={5} value={value} onChange={e => setValue(e.target.value)} autoFocus />
        <div className="row end">
          <button className="link" onClick={() => { setValue(t.content); setEditing(false); }}>Peruuta</button>
          <button onClick={async () => { await onSave(value); setEditing(false); }}>Tallenna</button>
        </div>
      </div>
    );
  }
  return (
    <div className="subcard">
      <p className="text-block">{t.content}</p>
      <div className="row item-actions">
        {children}
        <span>
          <button className="link" onClick={() => setEditing(true)}>Muokkaa</button>
          <button className="link danger" onClick={onDelete}>Poista</button>
        </span>
      </div>
    </div>
  );
}

function PhotoItem({ p, onCaption, onDelete, onOpen, children }) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(p.caption ?? '');
  return (
    <div className="photo-item">
      <button className="thumb" onClick={onOpen}><img src={imgUrl(p.thumb_url)} alt={p.caption || ''} /></button>
      {editing ? (
        <div className="row">
          <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Kuvateksti" autoFocus />
          <button onClick={async () => { await onCaption(caption); setEditing(false); }}>OK</button>
        </div>
      ) : (
        <button className="caption link" onClick={() => setEditing(true)}>{p.caption || '+ kuvateksti'}</button>
      )}
      <div className="row item-actions">
        {children}
        <button className="link danger" onClick={onDelete}>Poista</button>
      </div>
    </div>
  );
}

export default function DayView({ date }) {
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [newText, setNewText] = useState('');
  const [addingPlace, setAddingPlace] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null);
  const [upload, setUpload] = useState(null);
  const [open, setOpen] = useState(null);
  const [confirm, setConfirm] = useState(null); // { message, fn }
  const [favorites, setFavorites] = useState([]);
  const [notice, setNotice] = useState('');
  const fileInput = useRef(null);

  const reload = () => api.getDay(date).then(setEntry).catch(e => setError(e.message));
  useEffect(() => {
    setEntry(null); setError(''); setNotice(''); setAddingPlace(false); setEditingPlace(null);
    reload();
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFavorites = () => api.favorites().then(setFavorites).catch(() => {});
  useEffect(() => { loadFavorites(); }, []);
  const favoriteNames = new Set(favorites.map(f => f.name.toLowerCase()));

  // Paikka suosikiksi. Tuplaa ei synny: backend vastaa 409, ja kerrotaan siitä käyttäjälle.
  async function addToFavorites(p) {
    setNotice('');
    try {
      await api.addFavorite({ name: p.place_name, category: p.category, latitude: p.latitude, longitude: p.longitude });
      setNotice(`★ ${p.place_name} lisätty suosikkeihin`);
    } catch (e) {
      if (e.status === 409) setNotice(`★ ${e.message}`); else setError(e.message);
    }
    await loadFavorites();
  }

  // Checkinin tallennus lomakkeelta; tarvittaessa samalla suosikiksi
  async function saveCheckin(save, values, { saveAsFavorite }) {
    await save(values);
    setAddingPlace(false); setEditingPlace(null);
    if (saveAsFavorite) await addToFavorites(values);
    else if (values.favorite_id) await loadFavorites(); // käyttökerrat päivittyivät
    await reload();
  }

  // Kaikki muutokset: suorita, näytä virhe, lataa päivä uudelleen
  async function run(fn) {
    setError('');
    try { await fn(); } catch (e) { setError(e.message); }
    await reload();
  }

  async function move(type, list, index, dir) {
    const ids = list.map(x => x.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    await run(() => api.reorder(date, { [type]: ids }));
  }

  async function uploadFiles(files) {
    const list = [...files];
    if (!list.length) return;
    setError('');
    for (const [i, f] of list.entries()) {
      setUpload(`Ladataan kuvaa ${i + 1}/${list.length}…`);
      try { await api.addPhoto(date, f); } catch (e) { setError(`${f.name}: ${e.message}`); }
    }
    setUpload(null);
    fileInput.current.value = '';
    await reload();
  }

  const confirmDelete = (message, fn) => setConfirm({ message, fn });

  if (!entry) return <p className="muted center">{error || 'Ladataan…'}</p>;
  const isEmpty = !entry.text_blocks.length && !entry.photos.length && !entry.checkins.length;

  return (
    <>
      <div className="day-nav">
        <button className="icon" onClick={() => go(`/day/${addDays(date, -1)}`)} aria-label="Edellinen päivä">‹</button>
        <label className="day-title">
          <span>{formatLongDate(date)}</span>
          <input type="date" value={date} max={todayISO()} onChange={e => e.target.value && go(`/day/${e.target.value}`)} />
        </label>
        <button className="icon" onClick={() => go(`/day/${addDays(date, 1)}`)} aria-label="Seuraava päivä">›</button>
      </div>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Paikat</h2>
        {notice && <p className="notice" onClick={() => setNotice('')}>{notice}</p>}
        {entry.checkins.map((c, i) => editingPlace === c.id ? (
          <CheckinForm key={c.id} initial={c} favorites={favorites} onCancel={() => setEditingPlace(null)}
            onSave={(v, opts) => saveCheckin(x => api.updateCheckin(c.id, x), v, opts)} />
        ) : (
          <div key={c.id} className="subcard row">
            <span>📍 <strong>{c.place_name}</strong>{c.category && <span className="muted"> · {c.category}</span>}
              {c.latitude === null && <span className="muted small"> (ei sijaintia)</span>}</span>
            <span className="item-actions">
              <button className={`icon star${favoriteNames.has(c.place_name.toLowerCase()) ? ' on' : ''}`}
                aria-label="Lisää suosikkeihin" onClick={() => addToFavorites(c)}>
                {favoriteNames.has(c.place_name.toLowerCase()) ? '★' : '☆'}
              </button>
              <MoveButtons list={entry.checkins} index={i} onMove={(ix, d) => move('checkins', entry.checkins, ix, d)} />
              <button className="link" onClick={() => setEditingPlace(c.id)}>Muokkaa</button>
              <button className="link danger" onClick={() => confirmDelete(`Poistetaanko ${c.place_name}?`, () => api.deleteCheckin(c.id))}>Poista</button>
            </span>
          </div>
        ))}
        {addingPlace ? (
          <CheckinForm favorites={favorites} onCancel={() => setAddingPlace(false)}
            onSave={(v, opts) => saveCheckin(x => api.addCheckin(date, x), v, opts)} />
        ) : (
          <button className="secondary" onClick={() => setAddingPlace(true)}>+ Lisää paikka</button>
        )}
      </section>

      <section className="card">
        <h2>Kuvat</h2>
        {entry.photos.length > 0 && (
          <div className="photo-edit-grid">
            {entry.photos.map((p, i) => (
              <PhotoItem key={p.id} p={p} onOpen={() => setOpen(p)}
                onCaption={cap => run(() => api.updatePhoto(p.id, cap))}
                onDelete={() => confirmDelete('Poistetaanko kuva?', () => api.deletePhoto(p.id))}>
                <MoveButtons list={entry.photos} index={i} onMove={(ix, d) => move('photos', entry.photos, ix, d)} />
              </PhotoItem>
            ))}
          </div>
        )}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden
               onChange={e => uploadFiles(e.target.files)} />
        <button className="secondary" disabled={!!upload} onClick={() => fileInput.current.click()}>
          {upload || '+ Lisää kuvia'}
        </button>
      </section>

      <section className="card">
        <h2>Teksti</h2>
        {entry.text_blocks.map((t, i) => (
          <TextItem key={t.id} t={t}
            onSave={v => run(() => api.updateText(t.id, v))}
            onDelete={() => confirmDelete('Poistetaanko tekstilohko?', () => api.deleteText(t.id))}>
            <MoveButtons list={entry.text_blocks} index={i} onMove={(ix, d) => move('text_blocks', entry.text_blocks, ix, d)} />
          </TextItem>
        ))}
        <textarea rows={4} placeholder="Mitä tänään tapahtui?" value={newText} onChange={e => setNewText(e.target.value)} />
        <button disabled={!newText.trim()} onClick={() => run(async () => { await api.addText(date, newText); setNewText(''); })}>
          Lisää teksti
        </button>
      </section>

      {!isEmpty && (
        <button className="link danger center-block"
          onClick={() => confirmDelete('Poistetaanko koko päivän kirjaus kuvineen?', async () => { await api.deleteDay(date); go('/'); })}>
          Poista koko päivä
        </button>
      )}
      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
      {confirm && (
        <ConfirmDialog message={confirm.message} onCancel={() => setConfirm(null)}
          onConfirm={() => { const { fn } = confirm; setConfirm(null); run(fn); }} />
      )}
    </>
  );
}
