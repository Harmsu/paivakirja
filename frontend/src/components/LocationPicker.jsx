// Paikan sijainnin valinta kartalta napauttamalla. Avautuu ruudun keskelle portaalilla
// (kuten suosikkivalikko). Merkkiä voi siirtää napauttamalla uutta kohtaa tai raahaamalla.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatCoords } from '../format.js';

const FINLAND = { center: [64.5, 26], zoom: 5 };
const round = n => +n.toFixed(6);

// start = { latitude, longitude } aiempi valinta tai null; fallback = kohta, johon kartta keskitetään ilman valintaa
export default function LocationPicker({ start, fallback, onPick, onClose }) {
  const el = useRef(null);
  const marker = useRef(null);
  const [point, setPoint] = useState(start);

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const center = start ?? fallback;
    const map = L.map(el.current).setView(
      center ? [center.latitude, center.longitude] : FINLAND.center,
      start ? 16 : center ? 13 : FINLAND.zoom
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    function place(lat, lng) {
      const p = { latitude: round(lat), longitude: round(lng) };
      if (!marker.current) {
        // divIcon: Leafletin oletuskuvakkeen kuvat eivät löydy Viten buildista
        marker.current = L.marker([lat, lng], {
          draggable: true,
          icon: L.divIcon({ className: 'pick-marker', iconSize: [26, 26], iconAnchor: [13, 13] }),
        }).addTo(map);
        marker.current.on('dragend', () => {
          const ll = marker.current.getLatLng();
          setPoint({ latitude: round(ll.lat), longitude: round(ll.lng) });
        });
      } else {
        marker.current.setLatLng([lat, lng]);
      }
      setPoint(p);
    }
    if (start) place(start.latitude, start.longitude);
    map.on('click', e => place(e.latlng.lat, e.latlng.lng));
    // Kartta mitoitetaan vasta, kun ikkuna on piirretty
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => { clearTimeout(t); marker.current = null; map.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet map-sheet" role="dialog" aria-label="Valitse sijainti kartalta" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>Valitse kartalta</h2>
          <button type="button" className="link" onClick={onClose}>Sulje</button>
        </div>
        <p className="muted small">Napauta paikan kohtaa kartalla. Merkkiä voi myös raahata.</p>
        <div ref={el} className="pick-map" data-testid="pick-map" />
        <div className="row">
          <span className="muted small">{point ? `📍 ${formatCoords(point.latitude, point.longitude)}` : 'Ei valittua kohtaa'}</span>
          <button type="button" disabled={!point} onClick={() => onPick(point)}>Valitse tämä kohta</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
