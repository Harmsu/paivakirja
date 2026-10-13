// Päivän kirjaus luettavassa muodossa: tekstit, kuvat ja paikat yhdessä.
import { useState } from 'react';
import { imgUrl } from '../api.js';
import { formatLongDate, formatDate } from '../format.js';
import Lightbox from './Lightbox.jsx';

export function CheckinLine({ c }) {
  return (
    <li className="checkin">
      <span className="pin">📍</span>
      <span>
        <strong>{c.place_name}</strong>
        {c.category && <span className="muted"> · {c.category}</span>}
      </span>
    </li>
  );
}

export default function EntryCard({ entry, showYear = false }) {
  const [open, setOpen] = useState(null);
  return (
    <article className="card entry">
      <a className="entry-date" href={`#/day/${entry.date}`}>
        {showYear ? formatDate(entry.date).split('.').pop() : formatLongDate(entry.date)}
        <span className="edit-hint">Muokkaa ›</span>
      </a>
      {entry.checkins.length > 0 && (
        <ul className="checkins">{entry.checkins.map(c => <CheckinLine key={c.id} c={c} />)}</ul>
      )}
      {entry.photos.length > 0 && (
        <div className={`photo-grid n${Math.min(entry.photos.length, 3)}`}>
          {entry.photos.map(p => (
            <button key={p.id} className="thumb" onClick={() => setOpen(p)}>
              <img src={imgUrl(p.thumb_url)} alt={p.caption || ''} loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {entry.text_blocks.map(t => <p key={t.id} className="text-block">{t.content}</p>)}
      {open && <Lightbox photo={open} onClose={() => setOpen(null)} />}
    </article>
  );
}
