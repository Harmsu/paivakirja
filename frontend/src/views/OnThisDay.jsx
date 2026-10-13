// Tänä päivänä: sama päivä (tai sama kuukausi) eri vuosilta rinnakkain.
import { useEffect, useState } from 'react';
import { api, imgUrl } from '../api.js';
import { go } from '../router.js';
import { MONTHS, addDays, pad, todayISO } from '../format.js';
import EntryCard from '../components/EntryCard.jsx';

export default function OnThisDay({ param }) {
  // param: 'MM-DD' (päivä) tai 'MM' (koko kuukausi)
  const [tm, td] = todayISO().slice(5).split('-');
  const [mm, dd] = param ? param.split('-') : [tm, td];
  const month = Number(mm);
  const day = dd ? Number(dd) : null;
  // Data tallennetaan avaimen kanssa: tilaa vaihdettaessa (päivä <-> kuukausi) edellisen tilan
  // eri muotoista dataa ei saa renderöidä ennen kuin uusi on haettu.
  const key = day ? `${month}-${day}` : `${month}`;
  const [loaded, setLoaded] = useState({ key: null, rows: null });
  const data = loaded.key === key ? loaded.rows : null;
  const [error, setError] = useState('');

  useEffect(() => {
    const p = day ? api.onThisDay(month, day) : api.summaryDays({ month });
    p.then(rows => setLoaded({ key, rows })).catch(e => setError(e.message));
  }, [month, day]);

  const shiftDay = n => {
    const s = addDays(`2024-${pad(month)}-${pad(day)}`, n); // karkausvuosi, jotta 29.2. on mukana
    go(`/otd/${s.slice(5)}`);
  };
  const shiftMonth = n => go(`/otd/${pad(((month - 1 + n + 12) % 12) + 1)}`);

  // Ryhmittely vuosittain, uusin ensin
  const years = new Map();
  for (const x of data ?? []) {
    const y = x.date.slice(0, 4);
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(x);
  }
  const sortedYears = [...years].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <>
      <div className="tabs">
        <button className={day ? 'active' : ''} onClick={() => go(`/otd/${pad(month)}-${pad(day || Number(td))}`)}>Sama päivä</button>
        <button className={day ? '' : 'active'} onClick={() => go(`/otd/${pad(month)}`)}>Sama kuukausi</button>
      </div>
      <div className="period-nav">
        <button className="icon" onClick={() => (day ? shiftDay(-1) : shiftMonth(-1))} aria-label="Edellinen">‹</button>
        <h2>{day ? `${day}. ${MONTHS[month - 1]}ta` : MONTHS[month - 1]}</h2>
        <button className="icon" onClick={() => (day ? shiftDay(1) : shiftMonth(1))} aria-label="Seuraava">›</button>
      </div>
      {error && <p className="error">{error}</p>}
      {data && data.length === 0 && <p className="empty muted">Ei kirjauksia tältä ajalta aiempina vuosina.</p>}

      {day && <div className="side-by-side">{data?.map(e => <EntryCard key={e.id} entry={e} showYear />)}</div>}

      {!day && (
        <div className="side-by-side">
          {sortedYears.map(([y, list]) => (
            <section key={y} className="card">
              <h2><a href={`#/month/${y}-${pad(month)}`}>{y}</a></h2>
              <p className="muted small">
                {list.length} pv · {list.reduce((s, d) => s + d.photos, 0)} kuvaa · {list.reduce((s, d) => s + d.checkins, 0)} käyntiä
              </p>
              <div className="mini-thumbs">
                {list.filter(d => d.thumb_url).slice(0, 9).map(d => (
                  <a key={d.date} href={`#/day/${d.date}`}><img src={imgUrl(d.thumb_url)} alt="" loading="lazy" /></a>
                ))}
              </div>
              <ul className="month-list compact">
                {list.filter(d => d.places.length).slice(0, 6).map(d => (
                  <li key={d.date}><a href={`#/day/${d.date}`}><strong>{Number(d.date.slice(8))}.</strong> <span>📍 {d.places.join(', ')}</span></a></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
