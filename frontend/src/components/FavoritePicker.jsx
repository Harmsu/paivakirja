// Suosikin valinta ruudun keskelle avautuvana ikkunana. Eniten käytetyt ensin
// (järjestys tulee backendistä). Suodatuskenttä näytetään, kun suosikkeja on paljon.
// Piirretään portaalilla suoraan bodyyn: lomakkeen sisällä fixed-paneeli ei näkynyt puhelimessa.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const FILTER_FROM = 8;

export default function FavoritePicker({ favorites, onPick, onClose }) {
  const [filter, setFilter] = useState('');
  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const f = filter.trim().toLowerCase();
  const shown = f
    ? favorites.filter(x => x.name.toLowerCase().includes(f) || (x.category || '').toLowerCase().includes(f))
    : favorites;

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Valitse suosikeista" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Valitse suosikeista</h2>
          <button type="button" className="link" onClick={onClose}>Sulje</button>
        </div>
        {favorites.length > FILTER_FROM && (
          // Enter ei saa lähettää ympäröivää paikkalomaketta
          <input placeholder="Suodata…" value={filter} onChange={e => setFilter(e.target.value)} autoFocus
                 onKeyDown={e => e.key === 'Enter' && e.preventDefault()} />
        )}
        <ul className="fav-list">
          {shown.map(x => (
            <li key={x.id}>
              <button type="button" className="fav-item" onClick={() => onPick(x)}>
                <span>
                  <strong>★ {x.name}</strong>
                  {x.category && <span className="muted"> · {x.category}</span>}
                </span>
                <span className="muted small">
                  {x.latitude === null ? 'ei sijaintia' : x.use_count ? `${x.use_count}×` : ''}
                </span>
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="muted center">Ei osumia</li>}
        </ul>
      </div>
    </div>,
    document.body
  );
}
