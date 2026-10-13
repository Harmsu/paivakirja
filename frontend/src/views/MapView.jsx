// Kartta: paikkakirjaukset, joilla on koordinaatit, suodatettuna ajanjaksolla.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api.js';
import { addDays, formatDate, todayISO } from '../format.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function presetRange(key) {
  const today = todayISO();
  switch (key) {
    case '30': return [addDays(today, -30), today];
    case 'year': return [`${today.slice(0, 4)}-01-01`, today];
    case '365': return [addDays(today, -365), today];
    default: return ['', ''];
  }
}

export default function MapView() {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const [preset, setPreset] = useState('all');
  const [range, setRange] = useState(['', '']);
  const [count, setCount] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    map.current = L.map(el.current).setView([60.17, 24.94], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map.current);
    layer.current = L.featureGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);

  useEffect(() => {
    const [from, to] = range;
    api.mapPoints(from, to).then(points => {
      layer.current.clearLayers();
      // Sama paikka samalla nimellä ja koordinaateilla -> yksi merkki, lista päivistä
      const groups = new Map();
      for (const p of points) {
        const k = `${p.place_name}|${p.latitude}|${p.longitude}`;
        if (!groups.has(k)) groups.set(k, { ...p, dates: [] });
        groups.get(k).dates.push(p.date);
      }
      for (const g of groups.values()) {
        const dates = g.dates.slice(0, 10)
          .map(d => `<a href="#/day/${d}">${formatDate(d)}</a>`).join('<br>');
        const more = g.dates.length > 10 ? `<br>… ja ${g.dates.length - 10} muuta` : '';
        L.circleMarker([g.latitude, g.longitude], {
          radius: 7 + Math.min(g.dates.length, 8), color: '#9a4a06', weight: 1.5,
          fillColor: '#f28c28', fillOpacity: 0.85,
        }).bindPopup(
          `<strong>${esc(g.place_name)}</strong>${g.category ? `<br><em>${esc(g.category)}</em>` : ''}<br>${dates}${more}`
        ).addTo(layer.current);
      }
      setCount(points.length);
      if (points.length) map.current.fitBounds(layer.current.getBounds(), { padding: [30, 30], maxZoom: 14 });
    }).catch(e => setError(e.message));
  }, [range]);

  return (
    <div className="map-view">
      <div className="filters">
        <select value={preset} onChange={e => {
          setPreset(e.target.value);
          if (e.target.value !== 'custom') setRange(presetRange(e.target.value));
        }}>
          <option value="all">Kaikki</option>
          <option value="30">Viimeiset 30 päivää</option>
          <option value="year">Tämä vuosi</option>
          <option value="365">Viimeiset 12 kk</option>
          <option value="custom">Oma aikaväli</option>
        </select>
        {preset === 'custom' && (
          <span className="row">
            <input type="date" value={range[0]} onChange={e => setRange([e.target.value, range[1]])} />
            <input type="date" value={range[1]} onChange={e => setRange([range[0], e.target.value])} />
          </span>
        )}
        {count !== null && <span className="muted small">{count} käyntiä</span>}
      </div>
      {error && <p className="error">{error}</p>}
      <div ref={el} className="map" />
    </div>
  );
}
