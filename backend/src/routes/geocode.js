// Paikkahaku Nominatimin (OpenStreetMap) kautta. Haku kulkee backendin läpi, jotta
// pyynnöissä on Nominatimin käyttöehtojen vaatima tunnistettava User-Agent.
// Käyttöehdot: max 1 pyyntö/s, ei hakua joka näppäilyllä (frontend hakee vain napista).
import { Router } from 'express';
import { placeTypeFi } from '../place-types.js';

export const geocodeRouter = Router();

let lastCall = 0;

geocodeRouter.get('/', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);

  const wait = lastCall + 1000 - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCall = Date.now();

  const params = new URLSearchParams({
    q, format: 'jsonv2', limit: '8', addressdetails: '0', extratags: '1', 'accept-language': 'fi',
  });
  // Haun painotus lähelle nykyistä sijaintia, jos se on annettu
  const lat = Number(req.query.lat); const lon = Number(req.query.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    params.set('viewbox', `${lon - 0.5},${lat + 0.5},${lon + 0.5},${lat - 0.5}`);
  }

  const r = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': process.env.NOMINATIM_USER_AGENT || 'paikka-ja-kuvapaivakirja/1.0' },
  });
  if (!r.ok) return res.status(502).json({ error: 'Paikkahaku ei vastannut' });
  const data = await r.json();
  res.json(data.map(p => ({
    name: p.name || p.display_name.split(',')[0],
    display_name: p.display_name,
    category: placeTypeFi(p.type, p.extratags),
    latitude: Number(p.lat),
    longitude: Number(p.lon),
  })));
});
