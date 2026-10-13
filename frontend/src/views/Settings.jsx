// Asetukset: datan vienti (zip) ja uloskirjautuminen.
import { useState } from 'react';
import { api } from '../api.js';

export default function Settings({ onLogout }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const { blob, filename } = await api.exportZip();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <a className="card link-card" href="#/favorites">
        <span>★ Suosikkipaikat</span><span className="muted">›</span>
      </a>
      <section className="card">
        <h2>Vie data</h2>
        <p className="muted">
          Lataa koko päiväkirja zip-tiedostona: tekstit, paikat ja kuvien tiedot (data.json)
          sekä kaikki kuvat. Tallenna tiedosto talteen omalle laitteelle tai pilveen.
        </p>
        <button onClick={handleExport} disabled={exporting}>
          {exporting ? 'Valmistellaan… (voi kestää hetken)' : 'Vie data'}
        </button>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="card">
        <button className="secondary" onClick={onLogout}>Kirjaudu ulos</button>
      </section>
    </>
  );
}
