// Kuukausi-koonti: kalenteriruudukko pienoiskuvineen + kuukauden luvut.
import { useEffect, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { go } from '../router.js';
import { MONTHS, WEEKDAYS_SHORT, daysInMonth, monthRange, pad, todayISO } from '../format.js';

export default function MonthView({ param }) {
  const now = new Date();
  const [y, m] = param ? param.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  const [days, setDays] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setDays(null);
    const [from, to] = monthRange(y, m);
    api.summaryDays({ from, to }).then(setDays).catch(e => setError(e.message));
  }, [y, m]);

  const shift = d => {
    const dt = new Date(y, m - 1 + d, 1);
    go(`/month/${dt.getFullYear()}-${pad(dt.getMonth() + 1)}`);
  };

  const byDate = new Map((days ?? []).map(d => [d.date, d]));
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // maanantai ensin
  const cells = [...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth(y, m) }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)];
  const total = k => (days ?? []).reduce((s, d) => s + d[k], 0);
  const places = new Set((days ?? []).flatMap(d => d.places));
  const today = todayISO();

  return (
    <>
      <div className="period-nav">
        <button className="icon" onClick={() => shift(-1)} aria-label="Edellinen kuukausi">‹</button>
        <h2><a href={`#/year/${y}`}>{MONTHS[m - 1]} {y}</a></h2>
        <button className="icon" onClick={() => shift(1)} aria-label="Seuraava kuukausi">›</button>
      </div>
      {error && <p className="error">{error}</p>}
      {days && (
        <div className="stats">
          <div><strong>{days.length}</strong><span>päivää</span></div>
          <div><strong>{total('photos')}</strong><span>kuvaa</span></div>
          <div><strong>{total('checkins')}</strong><span>käyntiä</span></div>
          <div><strong>{places.size}</strong><span>paikkaa</span></div>
        </div>
      )}
      <div className="calendar">
        {WEEKDAYS_SHORT.map(w => <div key={w} className="wd">{w}</div>)}
        {cells.map((date, i) => {
          if (!date) return <div key={`x${i}`} />;
          const d = byDate.get(date);
          return (
            <a key={date} href={`#/day/${date}`}
               className={`cal-day${d ? ' has' : ''}${date === today ? ' today' : ''}`}
               style={d?.thumb_url ? { backgroundImage: `url("${imgUrl(d.thumb_url)}")` } : undefined}>
              <span className="num">{Number(date.slice(8))}</span>
              {d && d.checkins > 0 && <span className="badge">📍{d.checkins}</span>}
            </a>
          );
        })}
      </div>
      {days && days.length === 0 && (
        <div className="empty">
          <p>Ei kirjauksia tässä kuussa.</p>
          <p className="muted">Napauta kalenterin päivää lisätäksesi kirjauksen, tai siirry nuolilla toiseen kuukauteen.</p>
        </div>
      )}
      {days && days.length > 0 && (
        <ul className="month-list">
          {[...days].reverse().map(d => (
            <li key={d.date}>
              <a href={`#/day/${d.date}`}>
                <strong>{Number(d.date.slice(8))}.</strong>
                <span>
                  {d.places.length > 0 && <span className="places">📍 {d.places.join(', ')}</span>}
                  {d.excerpt && <span className="muted excerpt">{d.excerpt}</span>}
                  {!d.places.length && !d.excerpt && <span className="muted">{d.photos} kuvaa</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
