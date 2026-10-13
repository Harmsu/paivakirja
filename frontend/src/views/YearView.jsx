// Vuosi-koonti: vuoden luvut, eniten käydyt paikat ja kuukausikortit kansikuvineen.
import { useEffect, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { go } from '../router.js';
import { MONTHS, pad } from '../format.js';

export default function YearView({ param }) {
  const y = Number(param) || new Date().getFullYear();
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDays(null);
    api.summaryDays({ from: `${y}-01-01`, to: `${y}-12-31` }).then(setDays).catch(e => setError(e.message));
  }, [y]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const list = (days ?? []).filter(d => Number(d.date.slice(5, 7)) === i + 1);
    return {
      m: i + 1,
      days: list.length,
      photos: list.reduce((s, d) => s + d.photos, 0),
      checkins: list.reduce((s, d) => s + d.checkins, 0),
      cover: list.find(d => d.thumb_url)?.thumb_url,
    };
  });

  const placeCounts = new Map();
  for (const d of days ?? []) for (const p of d.places) placeCounts.set(p, (placeCounts.get(p) || 0) + 1);
  const topPlaces = [...placeCounts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const sum = k => months.reduce((s, x) => s + x[k], 0);

  return (
    <>
      <div className="period-nav">
        <button className="icon" onClick={() => go(`/year/${y - 1}`)} aria-label="Edellinen vuosi">‹</button>
        <h2>{y}</h2>
        <button className="icon" onClick={() => go(`/year/${y + 1}`)} aria-label="Seuraava vuosi">›</button>
      </div>
      {error && <p className="error">{error}</p>}
      {days && (
        <>
          <div className="stats">
            <div><strong>{days.length}</strong><span>päivää</span></div>
            <div><strong>{sum('photos')}</strong><span>kuvaa</span></div>
            <div><strong>{sum('checkins')}</strong><span>käyntiä</span></div>
            <div><strong>{placeCounts.size}</strong><span>paikkaa</span></div>
          </div>
          <div className="month-grid">
            {months.map(x => (
              <a key={x.m} href={`#/month/${y}-${pad(x.m)}`} className={`month-card${x.days ? '' : ' empty'}`}
                 style={x.cover ? { backgroundImage: `url("${imgUrl(x.cover)}")` } : undefined}>
                <span className="month-name">{MONTHS[x.m - 1]}</span>
                {x.days > 0 && <span className="month-meta">{x.days} pv · {x.photos} 📷 · {x.checkins} 📍</span>}
              </a>
            ))}
          </div>
          {topPlaces.length > 0 && (
            <section className="card">
              <h2>Eniten käydyt paikat</h2>
              <ol className="top-places">
                {topPlaces.map(([name, n]) => <li key={name}><span>{name}</span><span className="muted">{n} pv</span></li>)}
              </ol>
            </section>
          )}
        </>
      )}
    </>
  );
}
