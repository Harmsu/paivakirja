const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'paikka-ja-kuvapaivakirja_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = t => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Paikallisessa kehityksessä kuvien osoitteet ovat suhteellisia backendiin
export const imgUrl = u => (u && u.startsWith('/') ? `${BASE}${u}` : u);

async function raw(path, options = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    // Selaimen oma viesti ("Failed to fetch") on englanniksi
    throw new Error('Palvelimeen ei saada yhteyttä. Tarkista verkkoyhteys ja yritä uudelleen.');
  }
  // Ei automaattista uudelleenlatausta 401:llä (aiheutti silmukan uintisovelluksessa):
  // siivotaan token ja annetaan App-komponentin näyttää kirjautuminen.
  if (res.status === 401 && path !== '/api/auth/login') {
    clearToken();
    window.dispatchEvent(new Event('auth-expired'));
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Virhe ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

async function request(path, options) {
  const res = await raw(path, options);
  return res.status === 204 ? null : res.json();
}

const json = (method, body) => ({ method, body: JSON.stringify(body) });
const qs = params => new URLSearchParams(
  Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
).toString();

export const api = {
  login: (username, password) => request('/api/auth/login', json('POST', { username, password })),

  timeline: (before, limit = 15) => request(`/api/entries?${qs({ before, limit })}`),
  onThisDay: (month, day) => request(`/api/entries/on-this-day?${qs({ month, day })}`),
  getDay: date => request(`/api/entries/${date}`),
  deleteDay: date => request(`/api/entries/${date}`, { method: 'DELETE' }),
  reorder: (date, order) => request(`/api/entries/${date}/order`, json('PUT', order)),

  addText: (date, content) => request(`/api/entries/${date}/texts`, json('POST', { content })),
  updateText: (id, content) => request(`/api/texts/${id}`, json('PUT', { content })),
  deleteText: id => request(`/api/texts/${id}`, { method: 'DELETE' }),

  addCheckin: (date, c) => request(`/api/entries/${date}/checkins`, json('POST', c)),
  updateCheckin: (id, c) => request(`/api/checkins/${id}`, json('PUT', c)),
  deleteCheckin: id => request(`/api/checkins/${id}`, { method: 'DELETE' }),

  addPhoto: (date, file, caption) => {
    const form = new FormData();
    form.append('file', file);
    if (caption) form.append('caption', caption);
    return request(`/api/entries/${date}/photos`, { method: 'POST', body: form });
  },
  updatePhoto: (id, caption) => request(`/api/photos/${id}`, json('PUT', { caption })),
  deletePhoto: id => request(`/api/photos/${id}`, { method: 'DELETE' }),

  favorites: () => request('/api/favorites'),
  addFavorite: f => request('/api/favorites', json('POST', f)),
  updateFavorite: (id, f) => request(`/api/favorites/${id}`, json('PUT', f)),
  deleteFavorite: id => request(`/api/favorites/${id}`, { method: 'DELETE' }),

  summaryDays: params => request(`/api/summary/days?${qs(params)}`),
  mapPoints: (from, to) => request(`/api/summary/map?${qs({ from, to })}`),
  geocode: (q, lat, lon) => request(`/api/geocode?${qs({ q, lat, lon })}`),

  exportZip: async () => {
    const res = await raw('/api/export');
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="(.+)"/);
    return { blob: await res.blob(), filename: match ? match[1] : 'paivakirja.zip' };
  },
};
